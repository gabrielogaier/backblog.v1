const userProfileService = require('../services/userProfileService');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function getProfile(req, res, next) {
  try {
    const profile = await userProfileService.getProfileByUser(req.user.id);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function upsertProfile(req, res, next) {
  try {
    const { displayName, slug, shortDescription, alignment } = req.body;
    if (!displayName || !slug || !shortDescription) {
      return res.status(422).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    const normalizedSlug = String(slug).trim().toLowerCase();
    if (!SLUG_PATTERN.test(normalizedSlug)) {
      return res.status(422).json({
        message: 'Slug inválido. Use apenas letras minúsculas, números e hífen.',
      });
    }

    const profile = await userProfileService.upsertProfile(req.user.id, {
      displayName,
      slug: normalizedSlug,
      shortDescription,
      alignment: typeof alignment === 'object' && alignment !== null ? alignment : {},
    });
    return res.status(200).json(profile);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProfile,
  upsertProfile,
};
