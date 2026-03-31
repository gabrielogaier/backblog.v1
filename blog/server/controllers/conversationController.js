const { param, body, validationResult } = require('express-validator');
const postService = require('../services/postService');
const conversationService = require('../services/conversationService');

const listValidators = [
  param('id').isInt({ min: 1 }).toInt(),
];

const createValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  body('title').optional().isString().isLength({ min: 3 }),
];

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

async function list(req, res, next) {
  if (validate(req, res)) return;

  try {
    const post = await postService.getPostForUser(Number(req.params.id), req.user.id);
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    const conversations = await conversationService.listConversations(post.id, req.user.id);
    return res.json({ data: conversations });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  if (validate(req, res)) return;

  try {
    const post = await postService.getPostForUser(Number(req.params.id), req.user.id);
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    const conversation = await conversationService.createConversation({
      postId: post.id,
      ownerId: req.user.id,
      title: req.body.title,
    });

    return res.status(201).json(conversation);
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
