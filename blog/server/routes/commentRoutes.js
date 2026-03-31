const express = require('express');
const commentModerationController = require('../controllers/commentModerationController');

const router = express.Router();

router.get('/', commentModerationController.listValidators, commentModerationController.list);
router.patch('/:id', commentModerationController.updateValidators, commentModerationController.updateStatus);

module.exports = router;
