const express = require('express');
const userProfileController = require('../controllers/userProfileController');

const router = express.Router();

router.get('/', userProfileController.getProfile);
router.post('/', userProfileController.upsertProfile);

module.exports = router;
