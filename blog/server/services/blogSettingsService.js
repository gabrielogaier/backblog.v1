const { query } = require('../db');
const { sanitizePlainText, sanitizeMultilineText } = require('../utils/inputSanitizer');

const MAX_SOCIAL_LINKS = 8;

function sanitizeSocialLinks(input) {
  if (!Array.isArray(input)) return null;

  const sanitized = input
    .slice(0, MAX_SOCIAL_LINKS)
    .map((link) => {
      const label = sanitizePlainText(link?.label, { maxLength: 60 });
      const url = typeof link?.url === 'string' ? link.url.trim() : '';
      if (!label || !url) return null;
      return { label, url };
    })
    .filter(Boolean);

  return sanitized;
}

function sanitizeSettingsPayload(payload = {}) {
  return {
    blogName: sanitizePlainText(payload.blogName, { maxLength: 120 }),
    blogTagline: sanitizePlainText(payload.blogTagline, { maxLength: 180 }),
    aboutText: sanitizeMultilineText(payload.aboutText, { maxLength: 5000 }),
    contactEmail: sanitizePlainText(payload.contactEmail, { maxLength: 180 })?.toLowerCase() || null,
    seoDescription: sanitizePlainText(payload.seoDescription, { maxLength: 180 }),
    socialLinks: sanitizeSocialLinks(payload.socialLinks),
    theme: payload.theme || {},
  };
}

const mapSettings = (row) => ({
  id: row.id,
  userId: row.user_id,
  blogName: row.blog_name,
  blogTagline: row.blog_tagline,
  theme: {
    primary: row.theme_primary,
    secondary: row.theme_secondary,
    background: row.background_color,
    text: row.text_color,
    accent: row.accent_color,
    codeBlockBackground: row.code_block_bg_color || '#0f172a',
    codeInlineBackground: row.code_inline_bg_color || '#1e293b',
    codeText: row.code_text_color || '#e2e8f0',
    codeKeyword: row.code_keyword_color || '#7dd3fc',
    codeString: row.code_string_color || '#86efac',
    codeNumber: row.code_number_color || '#fbbf24',
    codeComment: row.code_comment_color || '#94a3b8',
    codeFunction: row.code_function_color || '#c4b5fd',
  },
  aboutText: row.about_text,
  contactEmail: row.contact_email,
  socialLinks: row.social_links || [],
  seoDescription: row.seo_description,
  updatedAt: row.updated_at?.toISOString(),
});

async function getSettings(userId) {
  const result = await query('SELECT * FROM blog_settings WHERE user_id = $1 LIMIT 1', [userId]);
  if (!result.rowCount) {
    return null;
  }
  return mapSettings(result.rows[0]);
}

async function upsertSettings(userId, payload) {
  const sanitizedPayload = sanitizeSettingsPayload(payload);
  const existing = await getSettings(userId);
  if (!existing) {
    const inserted = await query(
      `INSERT INTO blog_settings (
        user_id,
        blog_name,
        blog_tagline,
        theme_primary,
        theme_secondary,
        background_color,
        text_color,
        accent_color,
        code_block_bg_color,
        code_inline_bg_color,
        code_text_color,
        code_keyword_color,
        code_string_color,
        code_number_color,
        code_comment_color,
        code_function_color,
        about_text,
        contact_email,
        social_links,
        seo_description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        userId,
        sanitizedPayload.blogName || 'Meu Blog',
        sanitizedPayload.blogTagline || null,
        sanitizedPayload.theme?.primary || '#0f172a',
        sanitizedPayload.theme?.secondary || '#14b8a6',
        sanitizedPayload.theme?.background || '#ffffff',
        sanitizedPayload.theme?.text || '#0f172a',
        sanitizedPayload.theme?.accent || '#14b8a6',
        sanitizedPayload.theme?.codeBlockBackground || '#0f172a',
        sanitizedPayload.theme?.codeInlineBackground || '#1e293b',
        sanitizedPayload.theme?.codeText || '#e2e8f0',
        sanitizedPayload.theme?.codeKeyword || '#7dd3fc',
        sanitizedPayload.theme?.codeString || '#86efac',
        sanitizedPayload.theme?.codeNumber || '#fbbf24',
        sanitizedPayload.theme?.codeComment || '#94a3b8',
        sanitizedPayload.theme?.codeFunction || '#c4b5fd',
        sanitizedPayload.aboutText || null,
        sanitizedPayload.contactEmail || null,
        Array.isArray(sanitizedPayload.socialLinks) ? JSON.stringify(sanitizedPayload.socialLinks) : '[]',
        sanitizedPayload.seoDescription || null,
      ],
    );
    return mapSettings(inserted.rows[0]);
  }

  const updated = await query(
    `UPDATE blog_settings
        SET blog_name = $1,
            blog_tagline = $2,
            theme_primary = $3,
            theme_secondary = $4,
            background_color = $5,
            text_color = $6,
            accent_color = $7,
            code_block_bg_color = $8,
            code_inline_bg_color = $9,
            code_text_color = $10,
            code_keyword_color = $11,
            code_string_color = $12,
            code_number_color = $13,
            code_comment_color = $14,
            code_function_color = $15,
            about_text = $16,
            contact_email = $17,
            social_links = $18,
            seo_description = $19,
            updated_at = NOW()
      WHERE user_id = $20
      RETURNING *`,
    [
      sanitizedPayload.blogName ?? existing.blogName,
      sanitizedPayload.blogTagline ?? existing.blogTagline,
      sanitizedPayload.theme?.primary ?? existing.theme.primary,
      sanitizedPayload.theme?.secondary ?? existing.theme.secondary,
      sanitizedPayload.theme?.background ?? existing.theme.background,
      sanitizedPayload.theme?.text ?? existing.theme.text,
      sanitizedPayload.theme?.accent ?? existing.theme.accent,
      sanitizedPayload.theme?.codeBlockBackground ?? existing.theme.codeBlockBackground,
      sanitizedPayload.theme?.codeInlineBackground ?? existing.theme.codeInlineBackground,
      sanitizedPayload.theme?.codeText ?? existing.theme.codeText,
      sanitizedPayload.theme?.codeKeyword ?? existing.theme.codeKeyword,
      sanitizedPayload.theme?.codeString ?? existing.theme.codeString,
      sanitizedPayload.theme?.codeNumber ?? existing.theme.codeNumber,
      sanitizedPayload.theme?.codeComment ?? existing.theme.codeComment,
      sanitizedPayload.theme?.codeFunction ?? existing.theme.codeFunction,
      sanitizedPayload.aboutText ?? existing.aboutText,
      sanitizedPayload.contactEmail ?? existing.contactEmail,
      Array.isArray(sanitizedPayload.socialLinks)
        ? JSON.stringify(sanitizedPayload.socialLinks)
        : JSON.stringify(existing.socialLinks),
      sanitizedPayload.seoDescription ?? existing.seoDescription,
      userId,
    ],
  );

  return mapSettings(updated.rows[0]);
}

module.exports = {
  getSettings,
  upsertSettings,
};
