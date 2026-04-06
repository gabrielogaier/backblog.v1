const nodemailer = require('nodemailer');
const config = require('../config');

const AUTO_RESPONSE_HEADERS = {
  'X-Auto-Response-Suppress': 'All',
  AutoSubmitted: 'auto-generated',
};

let transporter = null;

function isEnabled() {
  return Boolean(config.mail.enabled);
}

function isConfigured() {
  return Boolean(
    config.mail.host
    && config.mail.port
    && config.mail.fromNoReply,
  );
}

function ensureReady() {
  if (!isEnabled()) {
    const error = new Error('Envio de e-mail desativado (MAIL_ENABLED=false).');
    error.code = 'MAIL_DISABLED';
    throw error;
  }

  if (!isConfigured()) {
    const error = new Error('Configuração SMTP incompleta. Verifique SMTP_HOST, SMTP_PORT e MAIL_FROM_NO_REPLY.');
    error.code = 'MAIL_NOT_CONFIGURED';
    throw error;
  }

  if ((config.mail.user && !config.mail.pass) || (!config.mail.user && config.mail.pass)) {
    const error = new Error('SMTP_USER e SMTP_PASS devem ser informados juntos.');
    error.code = 'MAIL_AUTH_PARTIAL';
    throw error;
  }
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const transportConfig = {
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    ignoreTLS: config.mail.ignoreTls,
    tls: {
      rejectUnauthorized: config.mail.tlsRejectUnauthorized,
    },
  };

  if (config.mail.user && config.mail.pass) {
    transportConfig.auth = {
      user: config.mail.user,
      pass: config.mail.pass,
    };
  }

  transporter = nodemailer.createTransport(transportConfig);

  return transporter;
}

function personalizeGreeting(displayName) {
  if (!displayName || typeof displayName !== 'string') return 'Olá,';
  return `Olá, ${displayName.trim()},`;
}

async function verifyConnection() {
  ensureReady();
  await getTransporter().verify();
  return true;
}

async function sendMail({
  to,
  subject,
  text,
  html,
  from,
  replyTo,
  headers,
}) {
  ensureReady();

  const info = await getTransporter().sendMail({
    from: from || config.mail.fromNoReply,
    to,
    subject,
    text,
    html,
    replyTo: replyTo || config.mail.replyTo || undefined,
    headers: {
      ...AUTO_RESPONSE_HEADERS,
      ...(headers || {}),
    },
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

async function sendVerificationCodeEmail({ to, code, expiresMinutes = 10, displayName }) {
  const greeting = personalizeGreeting(displayName);
  const subject = 'Backblog - Código de verificação';
  const text = [
    greeting,
    '',
    `Seu código de verificação é: ${code}`,
    `Validade: ${expiresMinutes} minuto(s).`,
    '',
    'Se você não solicitou este código, ignore este e-mail.',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Seu código de verificação é:</p>
    <p style="font-size: 20px; font-weight: 700; letter-spacing: 0.08em;">${code}</p>
    <p>Validade: <strong>${expiresMinutes} minuto(s)</strong>.</p>
    <p>Se você não solicitou este código, ignore este e-mail.</p>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendPasswordResetEmail({ to, resetUrl, expiresMinutes = 30, displayName }) {
  const greeting = personalizeGreeting(displayName);
  const subject = 'Backblog - Redefinição de senha';
  const text = [
    greeting,
    '',
    'Recebemos uma solicitação para redefinir sua senha.',
    `Acesse este link para continuar: ${resetUrl}`,
    `Este link expira em ${expiresMinutes} minuto(s).`,
    '',
    'Se você não solicitou a troca, ignore este e-mail.',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Recebemos uma solicitação para redefinir sua senha.</p>
    <p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">Redefinir senha</a></p>
    <p>Este link expira em <strong>${expiresMinutes} minuto(s)</strong>.</p>
    <p>Se você não solicitou a troca, ignore este e-mail.</p>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendLoginAlertEmail({ to, ipAddress, userAgent, occurredAt, displayName }) {
  const greeting = personalizeGreeting(displayName);
  const subject = 'Backblog - Novo acesso detectado';
  const when = occurredAt instanceof Date ? occurredAt.toISOString() : new Date().toISOString();
  const text = [
    greeting,
    '',
    'Detectamos um novo acesso à sua conta.',
    `Data/Hora (UTC): ${when}`,
    `IP: ${ipAddress || 'não informado'}`,
    `User-Agent: ${userAgent || 'não informado'}`,
    '',
    'Se não foi você, altere sua senha imediatamente.',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Detectamos um novo acesso à sua conta.</p>
    <ul>
      <li><strong>Data/Hora (UTC):</strong> ${when}</li>
      <li><strong>IP:</strong> ${ipAddress || 'não informado'}</li>
      <li><strong>User-Agent:</strong> ${userAgent || 'não informado'}</li>
    </ul>
    <p>Se não foi você, altere sua senha imediatamente.</p>
  `;

  return sendMail({ to, subject, text, html });
}

module.exports = {
  isEnabled,
  isConfigured,
  verifyConnection,
  sendMail,
  sendVerificationCodeEmail,
  sendPasswordResetEmail,
  sendLoginAlertEmail,
};
