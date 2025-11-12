import { body, validationResult } from 'express-validator';

export const validateContactSubmission = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be less than 255 characters'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),
  
  body('interest')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Interest must be less than 100 characters'),
  
  body('message')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message must be less than 5000 characters'),
  
  body('area')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Area must be less than 100 characters'),
];

export const validateMarketReportSubmission = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 255 })
    .withMessage('First name must be less than 255 characters'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 255 })
    .withMessage('Last name must be less than 255 characters'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),
  
  body('area')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Area must be less than 100 characters'),
];

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

