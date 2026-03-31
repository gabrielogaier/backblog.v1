const { param, query, validationResult } = require('express-validator');
const aiLogService = require('../services/aiLogService');
const postService = require('../services/postService');

const listValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('status').optional().isIn(['success', 'error']),
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
    const postId = Number(req.params.id);
    const post = await postService.getPostForUser(postId, req.user.id);

    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    const result = await aiLogService.listLogs(postId, {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listValidators,
  list,
};
