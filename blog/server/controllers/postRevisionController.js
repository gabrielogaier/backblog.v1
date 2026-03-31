const { param, query, validationResult } = require('express-validator');
const postRevisionService = require('../services/postRevisionService');
const postService = require('../services/postService');

const listValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('source').optional().isIn(['ai', 'human']),
];

const showValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  param('revisionId').isInt({ min: 1 }).toInt(),
];

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

async function ensurePostExists(postId, userId) {
  const post = await postService.getPostForUser(postId, userId);
  return post;
}

async function list(req, res, next) {
  if (handleValidation(req, res)) return;

  try {
    const postId = Number(req.params.id);
    const post = await ensurePostExists(postId, req.user.id);
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    const result = await postRevisionService.listRevisions(postId, {
      page: req.query.page,
      limit: req.query.limit,
      source: req.query.source,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  if (handleValidation(req, res)) return;

  try {
    const postId = Number(req.params.id);
    const revisionId = Number(req.params.revisionId);

    const post = await ensurePostExists(postId, req.user.id);
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    const revision = await postRevisionService.getRevision(postId, revisionId);
    if (!revision) {
      return res.status(404).json({ message: 'Revisão não encontrada.' });
    }

    return res.json(revision);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listValidators,
  showValidators,
  list,
  show,
};
