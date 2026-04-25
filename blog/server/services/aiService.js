const OpenAI = require('openai');
const config = require('../config');
const { pool, query } = require('../db');
const aiUsageService = require('./aiUsageService');
const markdownProfile = require('../../client/src/config/markdownProfile.json');

const configuredHeadingLevels = (markdownProfile.headings?.allowedLevels || [2, 3])
  .filter((level) => Number.isInteger(level) && level >= 1 && level <= 6);
const headingLevels = configuredHeadingLevels.length ? configuredHeadingLevels : [2, 3];
const minHeadingLevel = Math.min(...headingLevels);
const maxHeadingLevel = Math.max(...headingLevels);
const headingTokens = headingLevels.map((level) => '#'.repeat(level));

const configuredUnorderedMarkers = (markdownProfile.lists?.unorderedMarkers || ['-', '*'])
  .filter((marker) => typeof marker === 'string' && marker.length > 0);
const unorderedMarkers = configuredUnorderedMarkers.length ? configuredUnorderedMarkers : ['-', '*'];

const orderedPattern = markdownProfile.lists?.orderedPattern || '1.';
const blockquoteMarker = markdownProfile.blockquote?.marker || '>';
const inlineCodeDelimiter = markdownProfile.inlineCode?.delimiter || '`';
const inlineCodeToolbarLabel = markdownProfile.inlineCode?.toolbarLabel || '</>';
const codeFence = markdownProfile.codeBlock?.fence || '```';
const codeBlockToolbarLabel = markdownProfile.codeBlock?.toolbarLabel || '{ }';
const tablesEnabled = Boolean(markdownProfile.tables?.enabled);
const tableMarkdownExample = Array.isArray(markdownProfile.tables?.markdownExample)
  ? markdownProfile.tables.markdownExample.join('\n')
  : '| Coluna A | Coluna B |\n| --- | --- |\n| Valor 1 | Valor 2 |';

const headingsLabel = headingTokens.map((token) => `"${token}"`).join(' e ');
const unorderedMarkersLabel = unorderedMarkers.map((marker) => `"${marker}"`).join(' ou ');

const supportedEditorSyntaxLine =
  `Use apenas recursos do editor: ${headingTokens.join(', ')}, listas (${unorderedMarkers.join(' / ')} e ${orderedPattern}), ` +
  `citação "${blockquoteMarker}", **negrito**, *itálico*, ~~riscado~~, código inline ${inlineCodeDelimiter}...${inlineCodeDelimiter} (botão "${inlineCodeToolbarLabel}") ` +
  `e bloco de código ${codeFence}...${codeFence} (botão "${codeBlockToolbarLabel}")` +
  `${tablesEnabled ? ', além de tabela em Markdown pipe.' : ''}.`;

const formattingRules = [
  'Use apenas Markdown compatível com o editor.',
  `Títulos permitidos: apenas ${headingsLabel}.`,
  `Não use níveis de título fora dessa faixa (H${minHeadingLevel} até H${maxHeadingLevel}).`,
  'Ênfase permitida: **negrito**, *itálico* e ~~riscado~~.',
  `Listas permitidas: ${unorderedMarkersLabel} e "${orderedPattern}".`,
  `Citação permitida com "${blockquoteMarker}".`,
  `Código inline permitido com ${inlineCodeDelimiter} ... ${inlineCodeDelimiter} (botão "${inlineCodeToolbarLabel}").`,
  `Bloco de código permitido com ${codeFence} ... ${codeFence} (botão "${codeBlockToolbarLabel}").`,
  ...(tablesEnabled
    ? [
        'Tabela permitida no formato Markdown pipe.',
        `Exemplo de tabela:\n${tableMarkdownExample}`,
      ]
    : ['Não use tabelas.']),
  'Não use HTML ou outros formatos fora dessas opções.',
].join('\n');

const systemPrompt = [
  'Você é o assistente de escrita do autor.',
  'Reescreva mantendo voz pessoal, clareza, coesão e ritmo.',
  'Não invente fatos. Preserve ideias do rascunho.',
  'Entregue respostas completas, com fechamento claro.',
  'Não termine com reticências (...) ou frases incompletas.',
  '',
  'Regras obrigatórias de formatação:',
  formattingRules,
].join('\n');

const openaiClient = config.openai.apiKey
  ? new OpenAI({
      apiKey: config.openai.apiKey,
    })
  : null;

const CONTINUE_GENERATION_PROMPT =
  'Continue exatamente de onde parou, sem repetir conteúdo já escrito, e finalize o texto por completo. Não termine com reticências.';
const COMPLETED_ENDING_PATTERN = /(?:[.!?]["')\]]?|```)\s*$/;

function shouldContinueGeneration(text, finishReason) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return false;
  }

  if (finishReason === 'length') {
    return true;
  }

  if (/\.{3}$|…$/.test(trimmed)) {
    return true;
  }

  return trimmed.length >= 240 && !COMPLETED_ENDING_PATTERN.test(trimmed);
}

function aggregateUsage(usages) {
  const valid = usages.filter(Boolean);
  if (!valid.length) {
    return null;
  }

  const sum = (field) =>
    valid.reduce((total, usage) => total + (Number.isFinite(usage?.[field]) ? usage[field] : 0), 0);

  return {
    prompt_tokens: sum('prompt_tokens'),
    completion_tokens: sum('completion_tokens'),
    total_tokens: sum('total_tokens'),
  };
}

function isUnsupportedMaxTokensError(error) {
  const param = typeof error?.error?.param === 'string' ? error.error.param : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  return param === 'max_tokens' || message.includes("'max_tokens' is not supported");
}

function isUnsupportedTemperatureError(error) {
  const param = typeof error?.error?.param === 'string' ? error.error.param : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  return (
    param === 'temperature'
    || (message.includes('temperature') && message.includes('only the default'))
  );
}

function isUnsupportedReasoningEffortError(error) {
  const param = typeof error?.error?.param === 'string' ? error.error.param : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  return param === 'reasoning_effort' || message.includes('reasoning_effort');
}

async function createChatCompletion(messages) {
  const normalizedModel = String(config.openai.model || '').trim().toLowerCase();
  const isGpt5Family = normalizedModel.startsWith('gpt-5');

  let useMaxCompletionTokens = isGpt5Family;
  let includeTemperature = !(isGpt5Family && config.openai.temperature !== 1);
  let includeReasoningEffort = typeof config.openai.reasoningEffort === 'string' && config.openai.reasoningEffort.length > 0;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payload = {
      model: config.openai.model,
      messages,
      [useMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens']: config.openai.maxTokens,
    };

    if (includeTemperature) {
      payload.temperature = config.openai.temperature;
    }
    if (includeReasoningEffort) {
      payload.reasoning_effort = config.openai.reasoningEffort;
    }

    try {
      return await openaiClient.chat.completions.create(payload);
    } catch (error) {
      lastError = error;

      if (isUnsupportedMaxTokensError(error) && !useMaxCompletionTokens) {
        useMaxCompletionTokens = true;
        continue;
      }

      if (isUnsupportedTemperatureError(error) && includeTemperature) {
        includeTemperature = false;
        continue;
      }

      if (isUnsupportedReasoningEffortError(error) && includeReasoningEffort) {
        includeReasoningEffort = false;
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

async function createCompletionWithAutoContinue(baseMessages) {
  const allMessages = [...baseMessages];
  const parts = [];
  const usageSnapshots = [];
  const configuredContinuations = Number.isFinite(config.openai.maxContinuations)
    ? Math.floor(config.openai.maxContinuations)
    : 1;
  const maxContinuations = Math.max(0, configuredContinuations);
  let continuationCount = 0;

  while (true) {
    const completion = await createChatCompletion(allMessages);

    usageSnapshots.push(completion.usage || null);
    const choice = completion.choices?.[0] || null;
    const finishReason = choice?.finish_reason || null;
    const generatedText = choice?.message?.content?.trim();

    if (!generatedText) {
      return {
        content: '',
        usage: aggregateUsage(usageSnapshots),
      };
    }

    parts.push(generatedText);
    if (!shouldContinueGeneration(generatedText, finishReason) || continuationCount >= maxContinuations) {
      return {
        content: parts.join('\n\n'),
        usage: aggregateUsage(usageSnapshots),
      };
    }

    continuationCount += 1;
    allMessages.push({ role: 'assistant', content: generatedText });
    allMessages.push({ role: 'user', content: CONTINUE_GENERATION_PROMPT });
  }
}

function isOpenAiQuotaOrBillingError(error) {
  const rawCode = typeof error?.code === 'string' ? error.code : '';
  const normalizedCode = rawCode.toLowerCase();
  const nestedType = typeof error?.error?.type === 'string' ? error.error.type.toLowerCase() : '';
  const nestedCode = typeof error?.error?.code === 'string' ? error.error.code.toLowerCase() : '';

  return (
    normalizedCode === 'insufficient_quota'
    || normalizedCode === 'billing_hard_limit_reached'
    || nestedType === 'insufficient_quota'
    || nestedCode === 'insufficient_quota'
    || nestedCode === 'billing_hard_limit_reached'
  );
}

function normalizeOpenAiProviderError(error) {
  if (!isOpenAiQuotaOrBillingError(error)) {
    return error;
  }

  const normalized = new Error(
    'A cota da OpenAI da plataforma foi atingida no momento. Tente novamente mais tarde.',
  );
  normalized.statusCode = 503;
  normalized.code = 'OPENAI_PLATFORM_QUOTA';
  return normalized;
}

async function fetchInstructionById(id, ownerId) {
  if (!id) {
    return null;
  }

  const result = await query(
    'SELECT * FROM instructions WHERE id = $1 AND owner_id = $2 LIMIT 1',
    [id, ownerId],
  );
  return result.rowCount ? result.rows[0] : null;
}

async function fetchDefaultInstruction(ownerId) {
  const result = await query(
    `SELECT *
       FROM instructions
      WHERE owner_id = $1
        AND is_default = TRUE
   ORDER BY updated_at DESC
      LIMIT 1`,
    [ownerId],
  );
  return result.rowCount ? result.rows[0] : null;
}

async function resolveInstruction(preferredId, ownerId) {
  const specific = await fetchInstructionById(preferredId, ownerId);
  if (specific) {
    return specific;
  }
  return fetchDefaultInstruction(ownerId);
}

function buildUserMessage({ instruction, post, draft, extraNotes }) {
  const keywords = instruction?.priority_keywords?.length
    ? instruction.priority_keywords.join(', ')
    : 'sem prioridade específica';

  const base = [
    `Título do post: ${post.title || '(sem título)'}`,
    '',
    'Contexto geral:',
    '- Mantém tom pessoal, reflexivo e direto.',
    `- ${supportedEditorSyntaxLine}`,
    '- Evita repetição desnecessária e garante fluxo natural.',
  ];

  if (extraNotes) {
    base.push('', `Observações adicionais: ${extraNotes}`);
  }

  base.push(
    '',
    'Instrução ativa:',
    instruction?.body || 'Nenhuma instrução específica fornecida.',
    '',
    `Palavras-chave prioritárias: ${keywords}`,
    '',
    'Rascunho fornecido:',
    '"""',
    draft,
    '"""',
  );

  return base.join('\n');
}

async function generatePostRevision({ post, draft, requestedInstructionId, notes, ownerId }) {
  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY não configurada. Defina no arquivo blog/.env.');
  }

  const draftText = draft || post.contentRaw || post.contentFinal;
  if (!draftText || draftText.trim().length < 30) {
    throw new Error('Forneça um rascunho com pelo menos 30 caracteres para gerar com IA.');
  }

  const instruction = await resolveInstruction(requestedInstructionId || post.instructionId, ownerId);
  const userMessage = buildUserMessage({
    instruction,
    post,
    draft: draftText,
    extraNotes: notes,
  });

  const startedAt = Date.now();
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await aiUsageService.lockUserUsage(client, ownerId);
    await aiUsageService.assertCanUseAi(client, ownerId);

    const completionResult = await createCompletionWithAutoContinue([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);

    const generatedText = completionResult.content?.trim();
    if (!generatedText) {
      throw new Error('A resposta da IA veio vazia. Tente novamente.');
    }
    const normalizedGeneratedText = normalizeMarkdownToEditor(generatedText);

    const revision = await client.query(
      `INSERT INTO post_revisions (post_id, source, content, notes)
       VALUES ($1, 'ai', $2, $3)
       RETURNING id, created_at`,
      [post.id, normalizedGeneratedText, notes || null],
    );

    await client.query(
      `INSERT INTO ai_generation_logs (
          post_id, instruction_id, model, prompt_tokens,
          completion_tokens, cost_usd, latency_ms, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success')`,
      [
        post.id,
        instruction?.id || null,
        config.openai.model,
        completionResult.usage?.prompt_tokens ?? null,
        completionResult.usage?.completion_tokens ?? null,
        null,
        Date.now() - startedAt,
      ],
    );

    const aiUsage = await aiUsageService.incrementUsage(client, ownerId);
    await client.query('COMMIT');
    transactionStarted = false;

    return {
      content: normalizedGeneratedText,
      revisionId: revision.rows[0].id,
      createdAt: revision.rows[0].created_at.toISOString(),
      aiUsage,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => undefined);
    }

    await query(
      `INSERT INTO ai_generation_logs (
          post_id, instruction_id, model, prompt_tokens,
          completion_tokens, cost_usd, latency_ms, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'error')`,
      [
        post.id,
        instruction?.id || null,
        config.openai.model,
        null,
        null,
        null,
        Date.now() - startedAt,
      ],
    );
    throw normalizeOpenAiProviderError(error);
  } finally {
    client.release();
  }
}

function buildConversationContext({ post, instruction, liveDraft }) {
  const draftMaxChars = Number.isFinite(config.openai.conversationDraftMaxChars)
    ? Math.max(1000, Math.floor(config.openai.conversationDraftMaxChars))
    : 20000;
  const snapshotMaxChars = Number.isFinite(config.openai.conversationSnapshotMaxChars)
    ? Math.max(1000, Math.floor(config.openai.conversationSnapshotMaxChars))
    : 12000;

  const parts = [
    `Estamos trabalhando no post "${post.title}" (status atual: ${post.status}).`,
    'O objetivo é refinar o conteúdo mantendo a voz pessoal, clareza e ritmo.',
    `Formato obrigatório na resposta: ${supportedEditorSyntaxLine}`,
  ];

  if (instruction?.body) {
    parts.push('', 'Instrução ativa:', instruction.body);
  }

  if (instruction?.priority_keywords?.length) {
    parts.push('', `Palavras-chave prioritárias: ${instruction.priority_keywords.join(', ')}`);
  }

  const trimmedDraft = liveDraft && typeof liveDraft === 'string' ? liveDraft.trim() : '';

  if (trimmedDraft) {
    const slicedDraft = trimmedDraft.slice(0, draftMaxChars);
    const draftSuffix = trimmedDraft.length > draftMaxChars
      ? `\n\n[Observação: rascunho recortado para ${draftMaxChars} caracteres de ${trimmedDraft.length}.]`
      : '';
    parts.push('', 'Rascunho enviado nesta mensagem:', `${slicedDraft}${draftSuffix}`);
  } else if (post.contentRaw) {
    const contentRaw = String(post.contentRaw);
    const slicedRaw = contentRaw.slice(0, snapshotMaxChars);
    const rawSuffix = contentRaw.length > snapshotMaxChars
      ? `\n\n[Observação: rascunho salvo recortado para ${snapshotMaxChars} caracteres de ${contentRaw.length}.]`
      : '';
    parts.push('', 'Rascunho atual salvo:', `${slicedRaw}${rawSuffix}`);
  }

  if (post.contentFinal) {
    const contentFinal = String(post.contentFinal);
    const slicedFinal = contentFinal.slice(0, snapshotMaxChars);
    const finalSuffix = contentFinal.length > snapshotMaxChars
      ? `\n\n[Observação: versão publicada recortada para ${snapshotMaxChars} caracteres de ${contentFinal.length}.]`
      : '';
    parts.push('', 'Versão final publicada:', `${slicedFinal}${finalSuffix}`);
  }

  return parts.join('\n');
}

function mapConversationMessagesToOpenAI(messages) {
  return messages.map((msg) => {
    const role = msg.role === 'ai' ? 'assistant' : msg.role === 'user' ? 'user' : 'system';
    return {
      role,
      content: msg.content,
    };
  });
}

function normalizeMarkdownToEditor(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCodeBlock = false;

  const normalized = lines.map((line) => {
    const trimmedStart = line.trimStart();
    if (trimmedStart.startsWith(codeFence)) {
      inCodeBlock = !inCodeBlock;
      return line;
    }

    if (inCodeBlock) {
      return line;
    }

    const headingMatch = line.match(/^(\s*)(#{1,6})\s*(.+)$/);
    if (!headingMatch) {
      return line;
    }

    const indent = headingMatch[1] || '';
    const headingText = (headingMatch[3] || '').trim();
    if (!headingText) {
      return '';
    }

    const normalizedLevel = Math.min(maxHeadingLevel, Math.max(minHeadingLevel, headingMatch[2].length));
    return `${indent}${'#'.repeat(normalizedLevel)} ${headingText}`;
  });

  return normalized.join('\n').trim();
}

async function continueConversation({
  conversation,
  post,
  messages,
  requestedInstructionId,
  liveDraft,
  ownerId,
}) {
  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY não configurada. Defina no arquivo blog/.env.');
  }

  const instruction = await resolveInstruction(requestedInstructionId || post.instructionId, ownerId);
  const contextMessage = buildConversationContext({ post, instruction, liveDraft });
  const history = mapConversationMessagesToOpenAI(messages);

  const startedAt = Date.now();
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await aiUsageService.lockUserUsage(client, ownerId);
    await aiUsageService.assertCanUseAi(client, ownerId);

    const completionResult = await createCompletionWithAutoContinue([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextMessage },
      ...history,
    ]);

    const generatedText = completionResult.content?.trim();
    if (!generatedText) {
      throw new Error('A resposta da IA veio vazia. Tente novamente.');
    }
    const normalizedGeneratedText = normalizeMarkdownToEditor(generatedText);

    await client.query(
      `INSERT INTO ai_generation_logs (
          post_id, conversation_id, instruction_id, model, prompt_tokens,
          completion_tokens, cost_usd, latency_ms, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success')`,
      [
        post.id,
        conversation.id,
        instruction?.id || null,
        config.openai.model,
        completionResult.usage?.prompt_tokens ?? null,
        completionResult.usage?.completion_tokens ?? null,
        null,
        Date.now() - startedAt,
      ],
    );

    const aiUsage = await aiUsageService.incrementUsage(client, ownerId);
    await client.query('COMMIT');
    transactionStarted = false;

    return {
      content: normalizedGeneratedText,
      usage: completionResult.usage || null,
      aiUsage,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => undefined);
    }

    await query(
      `INSERT INTO ai_generation_logs (
          post_id, conversation_id, instruction_id, model, prompt_tokens,
          completion_tokens, cost_usd, latency_ms, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'error')`,
      [
        post.id,
        conversation.id,
        null,
        config.openai.model,
        null,
        null,
        null,
        Date.now() - startedAt,
      ],
    );
    throw normalizeOpenAiProviderError(error);
  } finally {
    client.release();
  }
}

module.exports = {
  generatePostRevision,
  continueConversation,
};
