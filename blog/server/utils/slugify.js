function slugify(text) {
  if (!text) {
    return 'item';
  }

  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .trim() || 'item';
}

module.exports = slugify;
