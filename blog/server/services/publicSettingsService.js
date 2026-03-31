const { query } = require('../db');

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

async function getPublicSettings() {
  return null;
}

async function getPublicSettingsByUserId(userId) {
  if (!userId) {
    return null;
  }

  const result = await query('SELECT * FROM blog_settings WHERE user_id = $1 LIMIT 1', [userId]);
  if (!result.rowCount) {
    return null;
  }

  return mapSettings(result.rows[0]);
}

module.exports = {
  getPublicSettings,
  getPublicSettingsByUserId,
};
