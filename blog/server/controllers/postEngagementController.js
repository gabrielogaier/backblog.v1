const postEngagementService = require('../services/postEngagementService');

function formatPermalinkParams(params) {
  return {
    year: params.year,
    month: params.month,
    slug: params.slug,
  };
}

function handleServiceError(error, res, next) {
  if (error.status) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

async function getEngagement(req, res, next) {
  try {
    const data = await postEngagementService.getEngagement({
      ...formatPermalinkParams(req.params),
      visitorId: req.query.visitorId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      commentsLimit: req.query.limit,
      commentsPage: req.query.page,
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function toggleLike(req, res, next) {
  try {
    const action = req.body?.action === 'unlike' ? 'unlike' : 'like';
    const data = await postEngagementService.toggleLike({
      ...formatPermalinkParams(req.params),
      action,
      visitorId: req.body?.visitorId || req.query.visitorId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listComments(req, res, next) {
  try {
    const data = await postEngagementService.listComments({
      ...formatPermalinkParams(req.params),
      limit: req.query.limit,
      page: req.query.page,
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createComment(req, res, next) {
  try {
    const saved = await postEngagementService.createComment({
      ...formatPermalinkParams(req.params),
      authorName: req.body?.authorName,
      authorEmail: req.body?.authorEmail,
      content: req.body?.content,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({
      message: 'Comentário recebido e aguardando moderação.',
      comment: saved,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

module.exports = {
  getEngagement,
  toggleLike,
  listComments,
  createComment,
};
