const rateLimit = require('express-rate-limit');
const config = require('../config');

const buildRateLimiter = ({ windowMs, max, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (_req, res) => res.status(429).json({ message }),
  });

const loginLimiter = buildRateLimiter({
  windowMs: config.security.rateLimit.loginWindowMs,
  max: config.security.rateLimit.loginMax,
  message: 'Muitas tentativas de login. Tente novamente em instantes.',
  // Contabiliza principalmente erros de autenticação e payload inválido.
  skipSuccessfulRequests: true,
});

const refreshLimiter = buildRateLimiter({
  windowMs: config.security.rateLimit.refreshWindowMs,
  max: config.security.rateLimit.refreshMax,
  message: 'Muitas tentativas de renovação de sessão. Aguarde alguns instantes.',
});

const registerLimiter = buildRateLimiter({
  windowMs: config.security.rateLimit.registerWindowMs,
  max: config.security.rateLimit.registerMax,
  message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.',
});

module.exports = {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
};
