const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const aiUsageService = require('../services/aiUsageService');
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

const registerVerifyValidators = [
  body('email').isEmail().withMessage('Informe um e-mail válido.'),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Informe o código de verificação com 6 dígitos.'),
];

const googleLoginValidators = [
  body('idToken').optional({ values: 'falsy' }).isString(),
  body('credential').optional({ values: 'falsy' }).isString(),
  body().custom((_, { req }) => {
    if (typeof req.body?.idToken === 'string' && req.body.idToken.trim()) {
      return true;
    }

    if (typeof req.body?.credential === 'string' && req.body.credential.trim()) {
      return true;
    }

    throw new Error('Token Google ausente.');
  }),
];

const sendBlockedLoginResponse = (res, retryAfterSeconds) =>
  res.status(429).json({
    message: 'Muitas tentativas de login. Aguarde antes de tentar novamente.',
    retryAfterSeconds,
  });

async function sendAuthenticatedResponse(req, res, result) {
  const { sessionToken, refreshToken, expiresAt } = result.session;
  const aiUsage = await aiUsageService.getAiUsage(result.user.id);

  res.cookie(config.cookies.sessionName, sessionToken, buildCookieOptions(req, { maxAge: config.session.ttlMs }));
  res.cookie(config.cookies.refreshName, refreshToken, buildCookieOptions(req, { maxAge: config.session.refreshTtlMs }));

  return res.status(200).json({
    user: result.user,
    session: {
      expiresAt: expiresAt.toISOString(),
    },
    aiUsage,
  });
}

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

  if (!result?.success) {
    const failureState = loginProtectionService.registerLoginFailure({
      ipAddress: req.ip,
      email,
    });

    if (failureState.blocked) {
      return sendBlockedLoginResponse(res, failureState.retryAfterSeconds);
    }

    if (result?.reason === authService.loginFailureReasons.EMAIL_NOT_VERIFIED) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verifique seu e-mail antes de entrar.',
      });
    }

    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  loginProtectionService.clearLoginFailures({
    ipAddress: req.ip,
    email,
  });

  return sendAuthenticatedResponse(req, res, result);
}

async function logout(req, res) {
  const sessionToken = req.cookies?.[config.cookies.sessionName];

  await authService.logout(sessionToken);

  res.clearCookie(config.cookies.sessionName, buildCookieOptions(req, { maxAge: 0 }));
  res.clearCookie(config.cookies.refreshName, buildCookieOptions(req, { maxAge: 0 }));

  return res.status(204).send();
}

async function me(req, res) {
  const aiUsage = await aiUsageService.getAiUsage(req.user.id);
  return res.status(200).json({
    user: req.user,
    session: {
      expiresAt: req.session.expiresAt.toISOString(),
    },
    aiUsage,
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
    aiUsage: await aiUsageService.getAiUsage(result.user.id),
  });
}

async function requestRegisterCode(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;
  const result = await authService.requestRegistrationCode({ name, email, password });

  if (!result?.success) {
    if (result?.reason === authService.registerFailureReasons.EMAIL_ALREADY_REGISTERED) {
      return res.status(409).json({ message: 'E-mail já está cadastrado.' });
    }

    if (result?.reason === authService.registerFailureReasons.MAIL_UNAVAILABLE) {
      return res.status(503).json({ message: 'Não foi possível enviar o código de verificação agora.' });
    }

    return res.status(400).json({ message: 'Não foi possível iniciar a verificação de e-mail.' });
  }

  return res.status(200).json({
    message: 'Código de verificação enviado para seu e-mail.',
    expiresInMinutes: result.expiresInMinutes,
  });
}

async function verifyRegisterCode(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, code } = req.body;
  const result = await authService.verifyRegistrationCodeAndCreateUser({ email, code });

  if (!result?.success) {
    if (result?.reason === authService.registerFailureReasons.EMAIL_ALREADY_REGISTERED) {
      return res.status(409).json({ message: 'E-mail já está cadastrado.' });
    }

    if (
      result?.reason === authService.registerFailureReasons.INVALID_OR_EXPIRED_CODE
      || result?.reason === authService.registerFailureReasons.TOO_MANY_ATTEMPTS
    ) {
      return res.status(400).json({ message: 'Código inválido ou expirado.' });
    }

    return res.status(400).json({ message: 'Não foi possível validar o código informado.' });
  }

  return res.status(201).json({
    message: 'Conta criada com sucesso.',
  });
}

async function googleLogin(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const idToken = typeof req.body?.idToken === 'string' && req.body.idToken.trim()
    ? req.body.idToken.trim()
    : req.body?.credential?.trim();

  const result = await authService.loginWithGoogle({
    idToken,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  });

  if (!result?.success) {
    if (result?.reason === authService.googleLoginFailureReasons.EMAIL_NOT_VERIFIED) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verifique seu e-mail antes de entrar com Google.',
      });
    }

    if (result?.reason === authService.googleLoginFailureReasons.GOOGLE_NOT_CONFIGURED) {
      return res.status(503).json({ message: 'Login com Google indisponível no momento.' });
    }

    if (result?.reason === authService.googleLoginFailureReasons.GOOGLE_ALREADY_LINKED) {
      return res.status(409).json({ message: 'Não foi possível autenticar com Google.' });
    }

    return res.status(401).json({ message: 'Não foi possível autenticar com Google.' });
  }

  return sendAuthenticatedResponse(req, res, result);
}

async function register(req, res) {
  return requestRegisterCode(req, res);
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
  googleLogin,
  googleLoginValidators,
  me,
  refresh,
  register,
  registerValidators,
  registerVerifyValidators,
  requestRegisterCode,
  verifyRegisterCode,
  deleteAccount,
};
