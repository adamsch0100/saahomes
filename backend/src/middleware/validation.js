import { body, validationResult } from 'express-validator';
import {
  isDisposableEmail,
  logBlockedEmail,
  normalizeEmail,
} from '../utils/emailQuality.js';

const leadMetadataFields = [
  body('sourcePage').optional().trim().isLength({ max: 255 }),
  body('utmSource').optional().trim().isLength({ max: 100 }),
  body('utmMedium').optional().trim().isLength({ max: 100 }),
  body('utmCampaign').optional().trim().isLength({ max: 100 }),
  body('landingPage').optional().trim().isLength({ max: 255 }),
  body('referrer').optional().trim().isLength({ max: 500 }),
  body('gaClientId').optional().trim().isLength({ max: 64 }),
];

/**
 * Shared real-email gate for every lead form.
 * Blocks known disposable domains after express-validator's isEmail/normalizeEmail.
 * pathName is logged to blocked_email_log when rejected.
 */
const emailIsReal = (value, pathName) => {
  const clean = normalizeEmail(value);
  if (!clean) return false;
  if (isDisposableEmail(clean)) {
    logBlockedEmail(clean, pathName).catch(() => {});
    return false;
  }
  return true;
};

/** DRY email field used by all 7 lead validators. */
const validEmailField = (pathName) =>
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail()
    .custom((value) => emailIsReal(value, pathName))
    .withMessage('Please use a real email address');

export const validateContactSubmission = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be less than 255 characters'),

  validEmailField('contact'),

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

  validEmailField('market-report'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),

  body('area')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Area must be less than 100 characters'),

  // Optional seller-track home address (creates home_profiles on submit)
  body('address_line').optional().trim().isLength({ max: 255 }),
  body('address').optional().trim().isLength({ max: 255 }),
  body('street').optional().trim().isLength({ max: 255 }),
  body('postal_code').optional().trim().isLength({ max: 16 }),
  body('zip').optional().trim().isLength({ max: 16 }),
  body('zipCode').optional().trim().isLength({ max: 16 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('living_area').optional({ values: 'falsy' }).isFloat({ min: 0, max: 50000 }),
  body('sqft').optional({ values: 'falsy' }).isFloat({ min: 0, max: 50000 }),

  ...leadMetadataFields,
];

export const validateCashBuyerLeadSubmission = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be less than 255 characters'),

  validEmailField('cash-buyer'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required for cash buyer inquiries')
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),

  body('interest')
    .optional()
    .trim()
    .isIn(['selling-for-cash', 'investor-buying', 'flip-property', 'both', 'exploring'])
    .withMessage('Invalid interest type'),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message must be less than 5000 characters'),

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

  validEmailField('chfa'),

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

  validEmailField('champions'),

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

export const validateChfaDpaLeadSubmission = [
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

  validEmailField('chfa-dpa'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 50 }),

  body('buyerStatus')
    .trim()
    .notEmpty()
    .withMessage('Buyer status is required')
    .isLength({ max: 255 }),

  body('targetCounty')
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

export const validateGhopeLeadSubmission = [
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

  validEmailField('ghope'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 50 }),

  body('employerName')
    .trim()
    .notEmpty()
    .withMessage('Employer is required')
    .isLength({ max: 255 }),

  body('targetZone')
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
