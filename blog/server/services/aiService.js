const OpenAI = require('openai');
const config = require('../config');
const { query } = require('../db');
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
  '',
  'Regras obrigatórias de formatação:',
  formattingRules,
].join('\n');

const openaiClient = config.openai.apiKey
  ? new OpenAI({
      apiKey: config.openai.apiKey,
    })
  : null;

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

  try {
    const completion = await openaiClient.chat.completions.create({
      model: config.openai.model,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const generatedText = completion.choices?.[0]?.message?.content?.trim();
    if (!generatedText) {
      throw new Error('A resposta da IA veio vazia. Tente novamente.');
    }
    const normalizedGeneratedText = normalizeMarkdownToEditor(generatedText);

    const revision = await query(
      `INSERT INTO post_revisions (post_id, source, content, notes)
       VALUES ($1, 'ai', $2, $3)
       RETURNING id, created_at`,
      [post.id, normalizedGeneratedText, notes || null],
    );

    await query(
      `INSERT INTO ai_generation_logs (
          post_id, instruction_id, model, prompt_tokens,
          completion_tokens, cost_usd, latency_ms, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success')`,
      [
        post.id,
        instruction?.id || null,
        config.openai.model,
        completion.usage?.prompt_tokens ?? null,
        completion.usage?.completion_tokens ?? null,
        null,
        Date.now() - startedAt,
      ],
    );

    return {
      content: normalizedGeneratedText,
      revisionId: revision.rows[0].id,
      createdAt: revision.rows[0].created_at.toISOString(),
    };
  } catch (error) {
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
    throw error;
  }
}

function buildConversationContext({ post, instruction, liveDraft }) {
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
    parts.push('', 'Rascunho enviado nesta mensagem:', trimmedDraft.slice(0, 4000));
  } else if (post.contentRaw) {
    parts.push('', 'Rascunho atual salvo:', post.contentRaw.slice(0, 2000));
  }

  if (post.contentFinal) {
    parts.push('', 'Versão final publicada:', post.contentFinal.slice(0, 2000));
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

  try {
    const completion = await openaiClient.chat.completions.create({
      model: config.openai.model,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextMessage },
        ...history,
      ],
    });

    const generatedText = completion.choices?.[0]?.message?.content?.trim();
    if (!generatedText) {
      throw new Error('A resposta da IA veio vazia. Tente novamente.');
    }
    const normalizedGeneratedText = normalizeMarkdownToEditor(generatedText);

    await query(
      `INSERT INTO ai_generation_logs (
          post_id, conversation_id, instruction_id, model, prompt_tokens,
          completion_tokens, cost_usd, latency_ms, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success')`,
      [
        post.id,
        conversation.id,
        instruction?.id || null,
        config.openai.model,
        completion.usage?.prompt_tokens ?? null,
        completion.usage?.completion_tokens ?? null,
        null,
        Date.now() - startedAt,
      ],
    );

    return {
      content: normalizedGeneratedText,
      usage: completion.usage || null,
    };
  } catch (error) {
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
    throw error;
  }
}

module.exports = {
  generatePostRevision,
  continueConversation,
};
