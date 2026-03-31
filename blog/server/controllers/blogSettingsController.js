const { body, validationResult } = require('express-validator');
const blogSettingsService = require('../services/blogSettingsService');

const colorValidator = (value) => /^#([0-9a-fA-F]{3}){1,2}$/.test(value);

const updateValidators = [
  body('blogName').optional().isString().isLength({ min: 3, max: 120 }),
  body('blogTagline').optional().isString().isLength({ max: 180 }),
  body('theme.primary').optional().custom(colorValidator),
  body('theme.secondary').optional().custom(colorValidator),
  body('theme.background').optional().custom(colorValidator),
  body('theme.text').optional().custom(colorValidator),
  body('theme.accent').optional().custom(colorValidator),
  body('theme.codeBlockBackground').optional().custom(colorValidator),
  body('theme.codeInlineBackground').optional().custom(colorValidator),
  body('theme.codeText').optional().custom(colorValidator),
  body('theme.codeKeyword').optional().custom(colorValidator),
  body('theme.codeString').optional().custom(colorValidator),
  body('theme.codeNumber').optional().custom(colorValidator),
  body('theme.codeComment').optional().custom(colorValidator),
  body('theme.codeFunction').optional().custom(colorValidator),
  body('aboutText').optional().isString(),
  body('contactEmail').optional({ values: 'falsy' }).isEmail(),
  body('socialLinks').optional().isArray(),
  body('socialLinks.*.label').optional().isString().isLength({ max: 60 }),
  body('socialLinks.*.url').optional({ values: 'falsy' }).isURL(),
  body('seoDescription').optional().isString().isLength({ max: 180 }),
];

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array();
    const firstError = details[0];
    res.status(422).json({
      message: firstError?.msg || 'Dados inválidos.',
      errors: details,
    });
    return true;
  }
  return false;
};

async function getSettings(req, res, next) {
  try {
    const settings = await blogSettingsService.getSettings(req.user.id);
    if (!settings) {
      const defaultSettings = await blogSettingsService.upsertSettings(req.user.id, {});
      return res.json(defaultSettings);
    }
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  if (validate(req, res)) return;

  try {
    const settings = await blogSettingsService.upsertSettings(req.user.id, req.body);
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  updateValidators,
};
