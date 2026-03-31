const publicPostService = require('../services/publicPostService');
const publicSettingsService = require('../services/publicSettingsService');
const userProfileService = require('../services/userProfileService');
const publicStatsService = require('../services/publicStatsService');

async function resolveProfileBySlugOrNull(slug) {
  if (!slug || typeof slug !== 'string') {
    return null;
  }

  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return null;
  }

  const profile = await userProfileService.getProfileBySlug(normalizedSlug);
  if (!profile?.slug) {
    return null;
  }

  return profile;
}

async function listPosts(req, res, next) {
  try {
    const filters = {
      year: req.query.year,
      month: req.query.month,
      tag: req.query.tag,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await publicPostService.listPublishedPosts(filters);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getPost(req, res, next) {
  try {
    const { year, month, slug } = req.params;
    const post = await publicPostService.getPublishedPostByPermalink({
      year,
      month,
      slug,
    });

    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    return res.json(post);
  } catch (error) {
    return next(error);
  }
}

async function getSettings(req, res, next) {
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    if (!slug?.trim()) {
      return res.json(null);
    }

    const profile = await resolveProfileBySlugOrNull(slug);
    if (!profile) {
      return res.status(404).json({ message: 'Perfil não encontrado.' });
    }

    const settings = await publicSettingsService.getPublicSettingsByUserId(profile.userId);
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
}

async function getUserStats(_req, res, next) {
  try {
    const stats = await publicStatsService.getUserStats();
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
}

async function getBlogBySlug(req, res, next) {
  try {
    const profile = await resolveProfileBySlugOrNull(req.params.slug);
    if (!profile) {
      return res.status(404).json({ message: 'Perfil não encontrado.' });
    }

    const [settings, postsResponse] = await Promise.all([
      publicSettingsService.getPublicSettingsByUserId(profile.userId),
      publicPostService.listPublishedPosts({
        authorId: profile.userId,
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
      }),
    ]);

    return res.json({
      profile: {
        displayName: profile.displayName,
        slug: profile.slug,
        shortDescription: profile.shortDescription,
      },
      settings,
      posts: postsResponse.data,
      meta: postsResponse.meta,
    });
  } catch (error) {
    return next(error);
  }
}

async function getBlogPostBySlug(req, res, next) {
  try {
    const profile = await resolveProfileBySlugOrNull(req.params.slug);
    if (!profile) {
      return res.status(404).json({ message: 'Perfil não encontrado.' });
    }

    const post = await publicPostService.getPublishedPostByPermalink({
      year: req.params.year,
      month: req.params.month,
      slug: req.params.postSlug,
      authorId: profile.userId,
    });

    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado.' });
    }

    return res.json(post);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPosts,
  getPost,
  getSettings,
  getUserStats,
  getBlogBySlug,
  getBlogPostBySlug,
};
