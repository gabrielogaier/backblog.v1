const crypto = require('crypto');

const DEFAULT_TOKEN_BYTES = 48;

function generateToken(bytes = DEFAULT_TOKEN_BYTES) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateToken,
  hashToken,
};
