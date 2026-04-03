const { pool, query } = require('../db');
const slugify = require('../utils/slugify');
const { sanitizePlainText, sanitizeRichHtml } = require('../utils/inputSanitizer');

const MAX_LIMIT = 50;
const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const mapPost = (row) => ({
  id: row.id,
  authorId: row.author_id,
  instructionId: row.instruction_id,
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt,
  contentRaw: row.content_raw,
  contentFinal: row.content_final,
  status: row.status,
  readingTimeMin: row.reading_time_min,
  publishedAt: row.published_at ? row.published_at.toISOString() : null,
  year: row.year,
  month: row.month,
  day: row.day,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  tags: row.tags || [],
});

const baseSelect = `
SELECT
  p.*,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  ) AS tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id
`;

const buildExcerpt = (content) => (content || '').replace(/\s+/g, ' ').trim().slice(0, 280);

const getDatePartsInTimeZone = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return { year, month, day };
};

const buildPublishMeta = (status, publishedAtInput) => {
  if (status === 'published') {
    const publishedAt = publishedAtInput ? new Date(publishedAtInput) : new Date();
    if (Number.isNaN(publishedAt.getTime())) {
      throw new Error('Data de publicação inválida.');
    }
    const parts = getDatePartsInTimeZone(publishedAt, BRAZIL_TIME_ZONE);
    return {
      publishedAt,
      year: parts.year,
      month: parts.month,
      day: parts.day,
    };
  }

  return {
    publishedAt: null,
    year: null,
    month: null,
    day: null,
  };
};

async function generateUniqueSlug(client, title, currentPostId = null) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = [slug];
    let queryText = 'SELECT 1 FROM posts WHERE slug = $1';
    if (currentPostId) {
      params.push(currentPostId);
      queryText += ' AND id <> $2';
    }
    queryText += ' LIMIT 1';

    const exists = await client.query(queryText, params);
    if (!exists.rowCount) {
      return slug;
    }
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

async function upsertTags(client, tags = []) {
  const cleanTags = tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);

  const tagIds = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const tag of cleanTags) {
    const slug = slugify(tag);
    // eslint-disable-next-line no-await-in-loop
    const result = await client.query(
      `INSERT INTO tags (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tag, slug],
    );
    tagIds.push(result.rows[0].id);
  }

  return tagIds;
}

async function syncPostTags(client, postId, tags = []) {
  await client.query('DELETE FROM post_tags WHERE post_id = $1', [postId]);

  if (!tags.length) {
    return;
  }

  const tagIds = await upsertTags(client, tags);

  const values = tagIds.map((tagId, index) => `($1, $${index + 2})`).join(', ');
  await client.query(
    `INSERT INTO post_tags (post_id, tag_id) VALUES ${values}`,
    [postId, ...tagIds],
  );
}

async function listPosts(filters = {}) {
  const {
    status,
    search,
    year,
    month,
    tag,
    page = 1,
    limit = 20,
    authorId,
  } = filters;

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const params = [];
  const conditions = [];

  if (authorId) {
    params.push(authorId);
    conditions.push(`p.author_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (year) {
    params.push(Number(year));
    conditions.push(`p.year = $${params.length}`);
  }

  if (month) {
    params.push(Number(month));
    conditions.push(`p.month = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.title ILIKE $${params.length} OR p.content_raw ILIKE $${params.length} OR p.content_final ILIKE $${params.length})`);
  }

  if (tag) {
    params.push(tag.toLowerCase());
    conditions.push(`EXISTS (
      SELECT 1 FROM post_tags pt2
      JOIN tags t2 ON t2.id = pt2.tag_id
     WHERE pt2.post_id = p.id
       AND (LOWER(t2.slug) = $${params.length} OR LOWER(t2.name) = $${params.length})
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;

  const result = await query(
    `${baseSelect}
     ${whereClause}
     GROUP BY p.id
     ORDER BY p.created_at DESC
     LIMIT $${limitParamIndex}
     OFFSET $${offsetParamIndex}`,
    [...params, safeLimit, offset],
  );

  return {
    data: result.rows.map(mapPost),
    meta: {
      page: safePage,
      limit: safeLimit,
      count: result.rowCount,
    },
  };
}

async function getPostById(postId) {
  const result = await query(
    `${baseSelect}
     WHERE p.id = $1
     GROUP BY p.id`,
    [postId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapPost(result.rows[0]);
}

async function getPostForUser(postId, userId) {
  const result = await query(
    `${baseSelect}
     WHERE p.id = $1 AND p.author_id = $2
     GROUP BY p.id`,
    [postId, userId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapPost(result.rows[0]);
}

async function createPost(payload, authorId) {
  const {
    title,
    contentRaw,
    contentFinal,
    instructionId,
    tags,
    status = 'draft',
    publishedAt,
    readingTimeMin,
  } = payload;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sanitizedContentRaw = typeof contentRaw === 'string' ? sanitizeRichHtml(contentRaw) : null;
    const sanitizedContentFinal = typeof contentFinal === 'string' ? sanitizeRichHtml(contentFinal) : null;
    const sanitizedExcerpt = sanitizePlainText(payload.excerpt, { maxLength: 280 });

    const slug = await generateUniqueSlug(client, title);
    const excerpt = sanitizedExcerpt || buildExcerpt(sanitizedContentFinal || sanitizedContentRaw);
    const publishMeta = buildPublishMeta(status, publishedAt);

    const inserted = await client.query(
      `INSERT INTO posts (
        author_id,
        instruction_id,
        title,
        slug,
        excerpt,
        content_raw,
        content_final,
        status,
        reading_time_min,
        published_at,
        year,
        month,
        day
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id`,
      [
        authorId,
        instructionId || null,
        title,
        slug,
        excerpt,
        sanitizedContentRaw || null,
        sanitizedContentFinal || null,
        status,
        readingTimeMin || null,
        publishMeta.publishedAt,
        publishMeta.year,
        publishMeta.month,
        publishMeta.day,
      ],
    );

    const postId = inserted.rows[0].id;

    if (Array.isArray(tags)) {
      await syncPostTags(client, postId, tags);
    }

    await client.query('COMMIT');
    return getPostById(postId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updatePost(postId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM posts WHERE id = $1 FOR UPDATE', [postId]);

    if (!existing.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    const current = existing.rows[0];
    const nextTitle = payload.title || current.title;
    let slug = current.slug;

    if (payload.title && payload.title !== current.title) {
      slug = await generateUniqueSlug(client, payload.title, postId);
    }

    const nextStatus = payload.status || current.status;
    const publishMeta = buildPublishMeta(nextStatus, payload.publishedAt || current.published_at);
    const contentRaw = typeof payload.contentRaw === 'string'
      ? sanitizeRichHtml(payload.contentRaw)
      : current.content_raw;
    const contentFinal = typeof payload.contentFinal === 'string'
      ? sanitizeRichHtml(payload.contentFinal)
      : current.content_final;
    const sanitizedExcerpt = sanitizePlainText(payload.excerpt, { maxLength: 280 });
    const excerpt = sanitizedExcerpt || buildExcerpt(contentFinal || contentRaw);

    await client.query(
      `UPDATE posts
          SET title = $1,
              slug = $2,
              excerpt = $3,
              content_raw = $4,
              content_final = $5,
              status = $6,
              reading_time_min = $7,
              published_at = $8,
              year = $9,
              month = $10,
              day = $11,
              instruction_id = $12,
              updated_at = NOW()
        WHERE id = $13`,
      [
        nextTitle,
        slug,
        excerpt,
        contentRaw,
        contentFinal,
        nextStatus,
        payload.readingTimeMin ?? current.reading_time_min,
        publishMeta.publishedAt,
        publishMeta.year,
        publishMeta.month,
        publishMeta.day,
        payload.instructionId ?? current.instruction_id,
        postId,
      ],
    );

    if (Array.isArray(payload.tags)) {
      await syncPostTags(client, postId, payload.tags);
    }

    await client.query('COMMIT');
    return getPostById(postId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deletePost(postId) {
  const result = await query('DELETE FROM posts WHERE id = $1', [postId]);
  return result.rowCount > 0;
}

module.exports = {
  listPosts,
  getPostById,
  getPostForUser,
  createPost,
  updatePost,
  deletePost,
};
