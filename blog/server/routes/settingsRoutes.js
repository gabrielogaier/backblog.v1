const express = require('express');
const blogSettingsController = require('../controllers/blogSettingsController');

const router = express.Router();

router.get('/', blogSettingsController.getSettings);
router.put('/', blogSettingsController.updateValidators, blogSettingsController.updateSettings);

module.exports = router;
