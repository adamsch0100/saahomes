import { body, validationResult } from 'express-validator';

const leadMetadataFields = [
  body('sourcePage').optional().trim().isLength({ max: 255 }),
  body('utmSource').optional().trim().isLength({ max: 100 }),
  body('utmMedium').optional().trim().isLength({ max: 100 }),
  body('utmCampaign').optional().trim().isLength({ max: 100 }),
  body('landingPage').optional().trim().isLength({ max: 255 }),
  body('referrer').optional().trim().isLength({ max: 500 }),
];

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

  ...leadMetadataFields,
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

  ...leadMetadataFields,
];

export const validateChfaLeadSubmission = [
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
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),

  body('schoolEmployer')
    .trim()
    .notEmpty()
    .withMessage('School or district employer is required')
    .isLength({ max: 255 })
    .withMessage('School employer must be less than 255 characters'),

  body('buyingTimeline')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Buying timeline must be less than 100 characters'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message must be less than 5000 characters'),

  ...leadMetadataFields,
];

export const validateChampionsLeadSubmission = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 255 }),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 255 }),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 50 }),

  body('responderType')
    .trim()
    .notEmpty()
    .withMessage('First responder role is required')
    .isLength({ max: 255 }),

  body('employerAgency')
    .optional()
    .trim()
    .isLength({ max: 255 }),

  body('buyingTimeline')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 5000 }),

  ...leadMetadataFields,
];

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
