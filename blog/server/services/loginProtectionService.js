const config = require('../config');

const ipFailures = new Map();
const emailFailures = new Map();

const { windowMs, blockDurationMs, maxFailuresPerIp, maxFailuresPerEmail } = config.security.bruteForce;

const STALE_RECORD_TTL_MS = Math.max(windowMs, blockDurationMs) * 2;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const toRetrySeconds = (milliseconds) => Math.max(1, Math.ceil(milliseconds / 1000));

const normalizeEmail = (email) => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
};

const removeExpiredFailures = (record, now) => {
  if (!record.failures.length) return;

  const cutoff = now - windowMs;
  record.failures = record.failures.filter((timestamp) => timestamp > cutoff);
};

const getOrCreateRecord = (store, key, now) => {
  const existing = store.get(key);
  if (existing) return existing;

  const created = { failures: [], blockedUntil: 0, lastSeenAt: now };
  store.set(key, created);
  return created;
};

const getBlockStateFromStore = (store, key, now) => {
  if (!key) return { blocked: false, retryAfterSeconds: 0 };

  const record = store.get(key);
  if (!record) return { blocked: false, retryAfterSeconds: 0 };

  if (record.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: toRetrySeconds(record.blockedUntil - now),
    };
  }

  record.blockedUntil = 0;
  removeExpiredFailures(record, now);
  if (!record.failures.length) {
    store.delete(key);
  }

  return { blocked: false, retryAfterSeconds: 0 };
};

const registerFailureInStore = (store, key, maxFailures, now) => {
  if (!key) return;

  const record = getOrCreateRecord(store, key, now);
  removeExpiredFailures(record, now);
  record.lastSeenAt = now;

  if (record.blockedUntil > now) return;

  record.failures.push(now);
  if (record.failures.length >= maxFailures) {
    record.blockedUntil = now + blockDurationMs;
    record.failures = [];
  }
};

const clearStoreFailures = (store, key) => {
  if (!key) return;
  store.delete(key);
};

const mergeBlockStates = (ipState, emailState) => {
  if (!ipState.blocked && !emailState.blocked) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(ipState.retryAfterSeconds || 0, emailState.retryAfterSeconds || 0),
  };
};

function checkLoginBlock({ ipAddress, email }) {
  const now = Date.now();
  const emailKey = normalizeEmail(email);
  const ipState = getBlockStateFromStore(ipFailures, ipAddress, now);
  const emailState = getBlockStateFromStore(emailFailures, emailKey, now);
  return mergeBlockStates(ipState, emailState);
}

function registerLoginFailure({ ipAddress, email }) {
  const now = Date.now();
  const emailKey = normalizeEmail(email);

  registerFailureInStore(ipFailures, ipAddress, maxFailuresPerIp, now);
  registerFailureInStore(emailFailures, emailKey, maxFailuresPerEmail, now);

  const ipState = getBlockStateFromStore(ipFailures, ipAddress, now);
  const emailState = getBlockStateFromStore(emailFailures, emailKey, now);
  return mergeBlockStates(ipState, emailState);
}

function clearLoginFailures({ ipAddress, email }) {
  const emailKey = normalizeEmail(email);
  clearStoreFailures(ipFailures, ipAddress);
  clearStoreFailures(emailFailures, emailKey);
}

const cleanupStore = (store, now) => {
  for (const [key, record] of store.entries()) {
    if (record.blockedUntil > now) continue;
    removeExpiredFailures(record, now);
    const isStale = now - record.lastSeenAt > STALE_RECORD_TTL_MS;
    if (!record.failures.length && isStale) {
      store.delete(key);
    }
  }
};

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  cleanupStore(ipFailures, now);
  cleanupStore(emailFailures, now);
}, CLEANUP_INTERVAL_MS);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

module.exports = {
  checkLoginBlock,
  registerLoginFailure,
  clearLoginFailures,
};
