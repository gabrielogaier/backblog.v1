const { param, body, validationResult } = require('express-validator');
const postService = require('../services/postService');
const conversationService = require('../services/conversationService');
const aiService = require('../services/aiService');

const listValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  param('conversationId').isInt({ min: 1 }).toInt(),
];

const createValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  param('conversationId').isInt({ min: 1 }).toInt(),
  body('content').isString().isLength({ min: 10 }).withMessage('Mensagem deve ter pelo menos 10 caracteres.'),
  body('instructionId').optional().isInt({ min: 1 }),
  body('draft').optional().isString(),
];

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

async function ensureConversationAccess(postId, conversationId, userId) {
  const post = await postService.getPostForUser(postId, userId);
  if (!post) {
    return { post: null, conversation: null };
  }

  const conversation = await conversationService.getConversationForUser(conversationId, userId);
  if (!conversation || conversation.postId !== post.id) {
    return { post, conversation: null };
  }

  return { post, conversation };
}

async function list(req, res, next) {
  if (validate(req, res)) return;

  try {
    const { post, conversation } = await ensureConversationAccess(
      Number(req.params.id),
      Number(req.params.conversationId),
      req.user.id,
    );

    if (!post || !conversation) {
      return res.status(404).json({ message: 'Conversa não encontrada para este post.' });
    }

    const messages = await conversationService.listMessages(conversation.id);
    return res.json({ data: messages });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  if (validate(req, res)) return;

  try {
    const { post, conversation } = await ensureConversationAccess(
      Number(req.params.id),
      Number(req.params.conversationId),
      req.user.id,
    );

    if (!post || !conversation) {
      return res.status(404).json({ message: 'Conversa não encontrada para este post.' });
    }

    const userMessage = await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: req.body.content,
      metadata: null,
    });

    const history = await conversationService.listMessages(conversation.id);

    const aiResponse = await aiService.continueConversation({
      conversation,
      post,
      messages: history,
      requestedInstructionId: req.body.instructionId,
      liveDraft: typeof req.body.draft === 'string' ? req.body.draft : undefined,
      ownerId: req.user.id,
    });

    const assistantMessage = await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'ai',
      content: aiResponse.content,
      metadata: {
        usage: aiResponse.usage,
      },
    });

    return res.status(201).json({
      userMessage,
      aiMessage: assistantMessage,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listValidators,
  createValidators,
  list,
  create,
};
