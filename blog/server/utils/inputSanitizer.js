function stripHtmlTags(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '');
}

function stripControlChars(value, { preserveNewLines = true } = {}) {
  if (typeof value !== 'string') return '';
  const regex = preserveNewLines ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return value.replace(regex, '');
}

function sanitizePlainText(value, { maxLength = null } = {}) {
  if (typeof value !== 'string') return null;
  let sanitized = stripHtmlTags(value);
  sanitized = stripControlChars(sanitized, { preserveNewLines: false }).trim();
  if (!sanitized) return null;
  if (Number.isFinite(maxLength) && maxLength > 0) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

function sanitizeMultilineText(value, { maxLength = null } = {}) {
  if (typeof value !== 'string') return null;
  let sanitized = stripHtmlTags(value);
  sanitized = stripControlChars(sanitized, { preserveNewLines: true });
  sanitized = sanitized
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  if (!sanitized) return null;
  if (Number.isFinite(maxLength) && maxLength > 0) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

function sanitizeRichHtml(value, { maxLength = null } = {}) {
  if (typeof value !== 'string') return null;

  let sanitized = stripControlChars(value, { preserveNewLines: true });

  sanitized = sanitized
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*>/gi, '')
    .replace(/<\s*\/\s*(script|iframe|object|embed|link|meta|base)\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*(?:javascript|vbscript|data:text\/html)[^'"]*\1/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(?:javascript|vbscript|data:text\/html)[^\s>]*/gi, '')
    .replace(/\sstyle\s*=\s*(".*?(?:expression\s*\(|javascript:|vbscript:).*?"|'.*?(?:expression\s*\(|javascript:|vbscript:).*?'|[^\s>]*(?:expression\s*\(|javascript:|vbscript:)[^\s>]*)/gi, '');

  if (Number.isFinite(maxLength) && maxLength > 0) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

module.exports = {
  sanitizePlainText,
  sanitizeMultilineText,
  sanitizeRichHtml,
};
