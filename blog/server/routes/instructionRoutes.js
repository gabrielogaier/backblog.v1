const express = require('express');
const instructionController = require('../controllers/instructionController');

const router = express.Router();

router.get('/', instructionController.list);
router.get('/:id', instructionController.show);
router.post('/', instructionController.baseValidators, instructionController.create);
router.put('/:id', instructionController.updateValidators, instructionController.update);

module.exports = router;
