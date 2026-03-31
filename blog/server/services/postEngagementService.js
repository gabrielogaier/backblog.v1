const crypto = require('crypto');
const { query } = require('../db');
const publicPostService = require('./publicPostService');
const { sanitizePlainText, sanitizeMultilineText } = require('../utils/inputSanitizer');

const MAX_COMMENTS_LIMIT = 50;
const MAX_COMMENT_CONTENT_LENGTH = 2000;
const MAX_COMMENT_NAME_LENGTH = 120;

async function resolvePostOrThrow({ year, month, slug }) {
  const post = await publicPostService.getPublishedPostByPermalink({
    year,
    month,
    slug,
  });

  if (!post) {
    const error = new Error('Post não encontrado.');
    error.status = 404;
    throw error;
  }

  return post;
}

function buildFingerprintHash({ visitorId, ip, userAgent, required }) {
  const normalizedIp = typeof ip === 'string' ? ip.trim() : '';
  const normalizedVisitor = typeof visitorId === 'string' ? visitorId.trim() : '';
  const normalizedUserAgent = typeof userAgent === 'string' ? userAgent.trim() : '';

  // Prioriza IP para limitar múltiplos likes do mesmo endereço.
  const source =
    normalizedIp ||
    (normalizedVisitor ? [normalizedVisitor, normalizedUserAgent].filter(Boolean).join('|') : normalizedUserAgent);

  if (!source) {
    if (required) {
      const error = new Error('Não foi possível identificar o visitante.');
      error.status = 400;
      throw error;
    }
    return null;
  }

  return crypto.createHash('sha256').update(source).digest('hex');
}

async function getLikeStats(postId, fingerprintHash) {
  const [likesResult, viewerResult] = await Promise.all([
    query('SELECT COUNT(*)::INT AS total FROM post_likes WHERE post_id = $1', [postId]),
    fingerprintHash
      ? query('SELECT 1 FROM post_likes WHERE post_id = $1 AND fingerprint_hash = $2 LIMIT 1', [postId, fingerprintHash])
      : Promise.resolve({ rowCount: 0 }),
  ]);

  return {
    likes: likesResult.rows[0]?.total ?? 0,
    viewerHasLiked: Boolean(fingerprintHash && viewerResult.rowCount > 0),
  };
}

async function getApprovedComments(postId, { limit, page }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_COMMENTS_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT id, author_name, content, created_at
         FROM post_comments
        WHERE post_id = $1
          AND status = 'approved'
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [postId, safeLimit, offset],
    ),
    query(`SELECT COUNT(*)::INT AS total FROM post_comments WHERE post_id = $1 AND status = 'approved'`, [postId]),
  ]);

  return {
    total: totalResult.rows[0]?.total ?? 0,
    page: safePage,
    limit: safeLimit,
    items: itemsResult.rows.map((row) => ({
      id: row.id,
      authorName: row.author_name,
      content: row.content,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
    })),
  };
}

async function getEngagement({ year, month, slug, visitorId, ip, userAgent, commentsLimit, commentsPage }) {
  const post = await resolvePostOrThrow({ year, month, slug });
  const fingerprintHash = buildFingerprintHash({ visitorId, ip, userAgent, required: false });

  const [likeStats, comments] = await Promise.all([
    getLikeStats(post.id, fingerprintHash),
    getApprovedComments(post.id, { limit: commentsLimit, page: commentsPage }),
  ]);

  return {
    postId: post.id,
    likes: likeStats.likes,
    viewerHasLiked: likeStats.viewerHasLiked,
    comments,
  };
}

async function toggleLike({ year, month, slug, action, visitorId, ip, userAgent }) {
  const post = await resolvePostOrThrow({ year, month, slug });
  const fingerprintHash = buildFingerprintHash({ visitorId, ip, userAgent, required: true });

  if (action === 'like') {
    await query(
      `INSERT INTO post_likes (post_id, fingerprint_hash, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (post_id, fingerprint_hash)
       DO UPDATE SET ip_address = EXCLUDED.ip_address, user_agent = EXCLUDED.user_agent`,
      [post.id, fingerprintHash, ip || null, userAgent || null],
    );
  } else {
    await query('DELETE FROM post_likes WHERE post_id = $1 AND fingerprint_hash = $2', [post.id, fingerprintHash]);
  }

  return getLikeStats(post.id, fingerprintHash);
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createComment({ year, month, slug, authorName, authorEmail, content, ip, userAgent }) {
  const post = await resolvePostOrThrow({ year, month, slug });
  const normalizedContent = sanitizeMultilineText(content, { maxLength: MAX_COMMENT_CONTENT_LENGTH }) || '';
  if (normalizedContent.length < 3) {
    const error = new Error('Comentário muito curto.');
    error.status = 400;
    throw error;
  }

  const normalizedName = sanitizePlainText(authorName, { maxLength: MAX_COMMENT_NAME_LENGTH });
  const normalizedEmail = sanitizePlainText(authorEmail, { maxLength: 180 })?.toLowerCase() || null;

  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    const error = new Error('E-mail inválido.');
    error.status = 400;
    throw error;
  }

  const metadataJson = JSON.stringify({
    source: 'public',
  });

  const result = await query(
    `INSERT INTO post_comments (post_id, author_name, author_email, content, status, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
     RETURNING id, status, created_at`,
    [post.id, normalizedName, normalizedEmail, normalizedContent, metadataJson, ip || null, userAgent || null],
  );

  return {
    id: result.rows[0].id,
    status: result.rows[0].status,
    createdAt: result.rows[0].created_at ? result.rows[0].created_at.toISOString() : null,
  };
}

async function listComments({ year, month, slug, limit, page }) {
  const post = await resolvePostOrThrow({ year, month, slug });
  return getApprovedComments(post.id, { limit, page });
}

module.exports = {
  getEngagement,
  toggleLike,
  createComment,
  listComments,
};
