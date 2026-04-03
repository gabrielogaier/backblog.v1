const { body, param, query, validationResult } = require('express-validator');
const postService = require('../services/postService');
const aiService = require('../services/aiService');
const aiUsageService = require('../services/aiUsageService');
const instructionService = require('../services/instructionService');

const statusValues = ['draft', 'published'];

const listValidators = [
  query('status').optional().isIn(statusValues).withMessage('Status inválido.'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }).toInt(),
  query('tag').optional().isString(),
];

const baseBodyValidators = [
  body('title').isString().isLength({ min: 3 }).withMessage('Título é obrigatório e deve ter pelo menos 3 caracteres.'),
  body('contentRaw').optional().isString(),
  body('contentFinal').optional().isString(),
  body('instructionId').optional().isInt({ min: 1 }),
  body('tags').optional().isArray().withMessage('Tags deve ser uma lista.'),
  body('tags.*').optional().isString(),
  body('status').optional().isIn(statusValues),
  body('publishedAt').optional().isISO8601(),
  body('readingTimeMin').optional().isInt({ min: 1 }),
];

const updateValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  body('title').optional().isString().isLength({ min: 3 }),
  body('contentRaw').optional().isString(),
  body('contentFinal').optional().isString(),
  body('instructionId').optional().isInt({ min: 1 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString(),
  body('status').optional().isIn(statusValues),
  body('publishedAt').optional().isISO8601(),
  body('readingTimeMin').optional().isInt({ min: 1 }),
];

const generateValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  body('draft').optional().isString().isLength({ min: 30 }).withMessage('O rascunho deve ter pelo menos 30 caracteres.'),
  body('instructionId').optional().isInt({ min: 1 }),
  body('notes').optional().isString(),
];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
}

async function list(req, res, next) {
  try {
    const result = await postService.listPosts({
      status: req.query.status,
      search: req.query.search,
      year: req.query.year,
      month: req.query.month,
      tag: req.query.tag,
      page: req.query.page,
      limit: req.query.limit,
      authorId: req.user.id,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getOwnedPost(postId, userId) {
  return postService.getPostForUser(postId, userId);
}

async function ensureInstructionOwnership(instructionId, userId, res) {
  if (!instructionId) {
    return true;
  }

  const instruction = await instructionService.getInstructionById(Number(instructionId), userId);
  if (!instruction) {
    res.status(422).json({ message: 'Instrução inválida para esta conta.' });
    return false;
  }

  return true;
}

async function show(req, res, next) {
  try {
    const post = await getOwnedPost(Number(req.params.id), req.user.id);
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }
    const aiUsage = await aiUsageService.getAiUsage(req.user.id);
    return res.json({
      ...post,
      aiUsage,
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  if (handleValidation(req, res)) return;
  try {
    if (!(await ensureInstructionOwnership(req.body.instructionId, req.user.id, res))) {
      return;
    }

    const post = await postService.createPost(req.body, req.user.id);
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  if (handleValidation(req, res)) return;

  try {
    const postId = Number(req.params.id);
    const existing = await getOwnedPost(postId, req.user.id);
    if (!existing) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    if (!(await ensureInstructionOwnership(req.body.instructionId, req.user.id, res))) {
      return;
    }

    const post = await postService.updatePost(postId, req.body);
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }
    return res.json(post);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const postId = Number(req.params.id);
    const existing = await getOwnedPost(postId, req.user.id);
    if (!existing) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    const success = await postService.deletePost(postId);
    if (!success) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function generate(req, res, next) {
  if (handleValidation(req, res)) return;

  try {
    const postId = Number(req.params.id);
    const post = await getOwnedPost(postId, req.user.id);

    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    if (!(await ensureInstructionOwnership(req.body.instructionId, req.user.id, res))) {
      return;
    }

    const result = await aiService.generatePostRevision({
      post,
      draft: req.body.draft,
      requestedInstructionId: req.body.instructionId,
      notes: req.body.notes,
      ownerId: req.user.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
}

module.exports = {
  listValidators,
  baseBodyValidators,
  updateValidators,
  generateValidators,
  list,
  show,
  create,
  update,
  remove,
  generate,
};
