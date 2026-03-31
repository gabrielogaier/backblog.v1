const rateLimit = require('express-rate-limit');
const config = require('../config');

const buildRateLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ message }),
  });

const publicLikeLimiter = buildRateLimiter({
  windowMs: config.security.rateLimit.publicLikeWindowMs,
  max: config.security.rateLimit.publicLikeMax,
  message: 'Muitas interações de curtida em pouco tempo. Aguarde um instante.',
});

const publicCommentLimiter = buildRateLimiter({
  windowMs: config.security.rateLimit.publicCommentWindowMs,
  max: config.security.rateLimit.publicCommentMax,
  message: 'Muitos comentários em pouco tempo. Tente novamente mais tarde.',
});

const adminUploadLimiter = buildRateLimiter({
  windowMs: config.security.rateLimit.adminUploadWindowMs,
  max: config.security.rateLimit.adminUploadMax,
  message: 'Muitos uploads em pouco tempo. Aguarde alguns instantes.',
});

module.exports = {
  publicLikeLimiter,
  publicCommentLimiter,
  adminUploadLimiter,
};
