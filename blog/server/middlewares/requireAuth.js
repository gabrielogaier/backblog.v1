const config = require('../config');
const authService = require('../services/authService');

async function requireAuth(req, res, next) {
  try {
    const sessionToken = req.cookies?.[config.cookies.sessionName];
    const sessionData = await authService.getSessionByToken(sessionToken);

    if (!sessionData) {
      res.clearCookie(config.cookies.sessionName);
      res.clearCookie(config.cookies.refreshName);
      return res.status(401).json({ message: 'Sessão expirada ou inválida.' });
    }

    req.user = sessionData.user;
    req.session = sessionData.session;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAuth;
