const config = require('../config');

function hasHttpsForwardedProto(req) {
  const forwardedProto = req.get?.('x-forwarded-proto');
  if (typeof forwardedProto !== 'string') return false;
  const firstValue = forwardedProto.split(',')[0]?.trim().toLowerCase();
  return firstValue === 'https';
}

function shouldUseSecureCookies(req) {
  if (typeof config.cookies.secure === 'boolean') {
    return config.cookies.secure;
  }

  if (!config.isProduction) {
    return false;
  }

  return Boolean(req.secure || hasHttpsForwardedProto(req));
}

function resolveSameSite(secure) {
  if (config.cookies.sameSite === 'none' && !secure) {
    return 'lax';
  }

  return config.cookies.sameSite;
}

function buildCookieOptions(req, { maxAge, httpOnly = true } = {}) {
  const secure = shouldUseSecureCookies(req);
  const options = {
    httpOnly,
    secure,
    sameSite: resolveSameSite(secure),
    path: '/',
  };

  if (Number.isFinite(maxAge)) {
    options.maxAge = maxAge;
  }

  return options;
}

module.exports = {
  buildCookieOptions,
};
