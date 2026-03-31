const { query, param, body, validationResult } = require('express-validator');
const commentModerationService = require('../services/commentModerationService');

const statusValues = commentModerationService.COMMENT_STATUS;

const listValidators = [
  query('status').optional().isIn(statusValues).withMessage('Status inválido.'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('search').optional().isString().trim().isLength({ min: 1 }).withMessage('Busca inválida.'),
];

const updateValidators = [param('id').isInt({ min: 1 }).toInt(), body('status').isIn(statusValues).withMessage('Status inválido.')];

function hasValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
}

async function list(req, res, next) {
  if (hasValidationErrors(req, res)) return;

  try {
    const result = await commentModerationService.listComments({
      userId: req.user.id,
      status: req.query.status,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  if (hasValidationErrors(req, res)) return;

  try {
    const updated = await commentModerationService.updateCommentStatus({
      commentId: Number(req.params.id),
      userId: req.user.id,
      status: req.body.status,
    });

    if (!updated) {
      return res.status(404).json({ message: 'Comentário não encontrado.' });
    }

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listValidators,
  updateValidators,
  list,
  updateStatus,
};
