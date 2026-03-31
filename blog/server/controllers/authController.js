const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const loginProtectionService = require('../services/loginProtectionService');
const config = require('../config');
const { buildCookieOptions } = require('../utils/cookies');

const loginValidators = [
  body('email').isEmail().withMessage('Informe um email válido.'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres.'),
];

const registerValidators = [
  body('name').trim().notEmpty().withMessage('Informe seu nome.'),
  body('email').isEmail().withMessage('Informe um e-mail válido.'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres.'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('As senhas devem ser iguais.'),
  body('acceptTerms')
    .custom((value) => value === true)
    .withMessage('Você precisa aceitar os termos de uso e a política de privacidade.'),
];

const sendBlockedLoginResponse = (res, retryAfterSeconds) =>
  res.status(429).json({
    message: 'Muitas tentativas de login. Aguarde antes de tentar novamente.',
    retryAfterSeconds,
  });

async function login(req, res) {
  const candidateEmail = req.body?.email;
  const blockState = loginProtectionService.checkLoginBlock({
    ipAddress: req.ip,
    email: candidateEmail,
  });

  if (blockState.blocked) {
    return sendBlockedLoginResponse(res, blockState.retryAfterSeconds);
  }

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  const result = await authService.login({
    email,
    password,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  });

  if (!result) {
    const failureState = loginProtectionService.registerLoginFailure({
      ipAddress: req.ip,
      email,
    });

    if (failureState.blocked) {
      return sendBlockedLoginResponse(res, failureState.retryAfterSeconds);
    }

    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  loginProtectionService.clearLoginFailures({
    ipAddress: req.ip,
    email,
  });

  const { sessionToken, refreshToken, expiresAt } = result.session;

  res.cookie(config.cookies.sessionName, sessionToken, buildCookieOptions(req, { maxAge: config.session.ttlMs }));
  res.cookie(config.cookies.refreshName, refreshToken, buildCookieOptions(req, { maxAge: config.session.refreshTtlMs }));

  return res.status(200).json({
    user: result.user,
    session: {
      expiresAt: expiresAt.toISOString(),
    },
  });
}

async function logout(req, res) {
  const sessionToken = req.cookies?.[config.cookies.sessionName];

  await authService.logout(sessionToken);

  res.clearCookie(config.cookies.sessionName, buildCookieOptions(req, { maxAge: 0 }));
  res.clearCookie(config.cookies.refreshName, buildCookieOptions(req, { maxAge: 0 }));

  return res.status(204).send();
}

async function me(req, res) {
  return res.status(200).json({
    user: req.user,
    session: {
      expiresAt: req.session.expiresAt.toISOString(),
    },
  });
}

async function refresh(req, res) {
  const sessionToken = req.cookies?.[config.cookies.sessionName];
  const refreshToken = req.cookies?.[config.cookies.refreshName];

  const result = await authService.refreshSession({
    sessionToken,
    refreshToken,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  });

  if (!result) {
    res.clearCookie(config.cookies.sessionName, buildCookieOptions(req, { maxAge: 0 }));
    res.clearCookie(config.cookies.refreshName, buildCookieOptions(req, { maxAge: 0 }));
    return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
  }

  res.cookie(
    config.cookies.sessionName,
    result.session.sessionToken,
    buildCookieOptions(req, { maxAge: config.session.ttlMs }),
  );
  res.cookie(
    config.cookies.refreshName,
    result.session.refreshToken,
    buildCookieOptions(req, { maxAge: config.session.refreshTtlMs }),
  );

  return res.status(200).json({
    user: result.user,
    session: {
      expiresAt: result.session.expiresAt.toISOString(),
    },
  });
}

async function register(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;
  const user = await authService.registerUser({ name, email, password });

  if (!user) {
    return res.status(409).json({ message: 'E-mail já está cadastrado.' });
  }

  return res.status(201).json({
    message: 'Conta criada com sucesso.',
  });
}

async function deleteAccount(req, res, next) {
  try {
    await authService.deleteAccount(req.user.id);
    res.clearCookie(config.cookies.sessionName, buildCookieOptions(req, { maxAge: 0 }));
    res.clearCookie(config.cookies.refreshName, buildCookieOptions(req, { maxAge: 0 }));
    return res.status(200).json({ message: 'Conta excluída com sucesso.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  logout,
  loginValidators,
  me,
  refresh,
  register,
  registerValidators,
  deleteAccount,
};
