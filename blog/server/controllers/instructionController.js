const { body, param, validationResult } = require('express-validator');
const instructionService = require('../services/instructionService');

const baseValidators = [
  body('title').isString().isLength({ min: 3 }).withMessage('Título obrigatório.'),
  body('body').isString().isLength({ min: 10 }).withMessage('Corpo deve ter pelo menos 10 caracteres.'),
  body('priorityKeywords').optional().isArray(),
  body('priorityKeywords.*').optional().isString(),
  body('isDefault').optional().isBoolean().toBoolean(),
];

const updateValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  body('title').optional().isString().isLength({ min: 3 }),
  body('body').optional().isString().isLength({ min: 10 }),
  body('priorityKeywords').optional().isArray(),
  body('priorityKeywords.*').optional().isString(),
  body('isDefault').optional().isBoolean().toBoolean(),
];

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

async function list(req, res, next) {
  try {
    const data = await instructionService.listInstructions(req.user.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  if (validate(req, res)) return;
  try {
    const instruction = await instructionService.createInstruction(req.body, req.user.id);
    res.status(201).json(instruction);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  if (validate(req, res)) return;
  try {
    const instruction = await instructionService.updateInstruction(
      Number(req.params.id),
      req.body,
      req.user.id,
    );
    if (!instruction) {
      return res.status(404).json({ message: 'Instrução não encontrada.' });
    }
    return res.json(instruction);
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  try {
    const instruction = await instructionService.getInstructionById(Number(req.params.id), req.user.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instrução não encontrada.' });
    }
    return res.json(instruction);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  create,
  update,
  show,
  baseValidators,
  updateValidators,
};
