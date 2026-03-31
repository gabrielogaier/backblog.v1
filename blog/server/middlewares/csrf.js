const crypto = require('crypto');
const config = require('../config');
const { buildCookieOptions } = require('../utils/cookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function getRequestOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return '';
  return normalizeOrigin(origin);
}

function getAllowedOrigins(req) {
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  const corsOrigins = Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin];
  return [sameOrigin, ...corsOrigins].map(normalizeOrigin).filter(Boolean);
}

function isOriginAllowed(req) {
  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) return true;
  return getAllowedOrigins(req).includes(requestOrigin);
}

function tokensMatch(cookieToken, requestToken) {
  if (typeof cookieToken !== 'string' || typeof requestToken !== 'string') {
    return false;
  }

  if (cookieToken.length !== requestToken.length || cookieToken.length > 512) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(requestToken));
  } catch {
    return false;
  }
}

function extractRequestToken(req) {
  const headerToken = req.get('x-csrf-token') || req.get('x-xsrf-token');
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  const bodyToken = req.body?._csrf;
  if (typeof bodyToken === 'string' && bodyToken.trim()) {
    return bodyToken.trim();
  }

  return '';
}

function ensureCsrfCookie(req, res, next) {
  const currentToken = req.cookies?.[config.csrf.cookieName];
  if (!CSRF_TOKEN_PATTERN.test(currentToken || '')) {
    res.cookie(
      config.csrf.cookieName,
      generateCsrfToken(),
      buildCookieOptions(req, { maxAge: config.csrf.cookieMaxAgeMs, httpOnly: false }),
    );
  }
  next();
}

function issueCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');

  const token = req.cookies?.[config.csrf.cookieName];
  if (CSRF_TOKEN_PATTERN.test(token || '')) {
    return res.status(200).json({ csrfToken: token });
  }

  const generatedToken = generateCsrfToken();
  res.cookie(
    config.csrf.cookieName,
    generatedToken,
    buildCookieOptions(req, { maxAge: config.csrf.cookieMaxAgeMs, httpOnly: false }),
  );
  return res.status(200).json({ csrfToken: generatedToken });
}

function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(String(req.method).toUpperCase())) {
    return next();
  }

  if (config.csrf.enforceOrigin && !isOriginAllowed(req)) {
    return res.status(403).json({
      message: 'Origem da requisição não permitida.',
      code: 'CSRF_ORIGIN_BLOCKED',
    });
  }

  const cookieToken = req.cookies?.[config.csrf.cookieName];
  const requestToken = extractRequestToken(req);

  if (!tokensMatch(cookieToken, requestToken)) {
    return res.status(403).json({
      message: 'Token CSRF inválido ou ausente.',
      code: 'CSRF_TOKEN_INVALID',
    });
  }

  return next();
}

module.exports = {
  ensureCsrfCookie,
  issueCsrfToken,
  requireCsrf,
};
