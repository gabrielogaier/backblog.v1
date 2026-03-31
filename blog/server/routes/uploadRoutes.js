const express = require('express');
const uploadController = require('../controllers/uploadController');
const { adminUploadLimiter } = require('../middlewares/trafficRateLimiters');

const router = express.Router();

router.post('/images', adminUploadLimiter, uploadController.uploadImage);

module.exports = router;
