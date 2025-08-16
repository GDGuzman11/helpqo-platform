import { body, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

/**
 * Enhanced Validation Service
 * Philippine marketplace-specific validation rules and business logic
 */
export class ValidationService {

  /**
   * Philippine phone number validation and normalization
   */
  public static validatePhilippinePhone(): ValidationChain {
    return body('phone')
      .trim()
      .matches(/^(\+63|0)9\d{9}$/)
      .withMessage('Must be a valid Philippine phone number (09XXXXXXXXX or +639XXXXXXXXX)')
      .customSanitizer((value: string) => {
        // Normalize to +639XXXXXXXXX format
        if (value.startsWith('09')) {
          return '+63' + value.substring(1);
        }
        return value;
      });
  }

  /**
   * Enhanced email validation with business rules
   */
  public static validateEmail(): ValidationChain {
    return body('email')
      .trim()
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail({ gmail_remove_dots: false })
      .isLength({ min: 5, max: 255 })
      .withMessage('Email must be between 5 and 255 characters')
      .custom(async (email: string) => {
        // Check for disposable email domains (basic list)
        const disposableDomains = [
          '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 
          'tempmail.org', 'temp-mail.org', 'throwaway.email'
        ];
        
        const domain = email.split('@')[1]?.toLowerCase();
        if (disposableDomains.includes(domain)) {
          throw new Error('Disposable email addresses are not allowed');
        }
        
        return true;
      });
  }

  /**
   * Strong password validation
   */
  public static validatePassword(): ValidationChain {
    return body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');
  }

  /**
   * Philippine name validation (supports Filipino naming conventions)
   */
  public static validateFilipineName(fieldName: string): ValidationChain {
    return body(fieldName)
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage(`${fieldName.replace('_', ' ')} must be between 1 and 100 characters`)
      .matches(/^[a-zA-ZÀ-ÿ\s'-\.]+$/)
      .withMessage(`${fieldName.replace('_', ' ')} can only contain letters, spaces, hyphens, apostrophes, and periods`)
      .custom((value: string) => {
        // Check for common Filipino name patterns
        const nameParts = value.trim().split(/\s+/);
        
        // Each part should be at least 1 character
        for (const part of nameParts) {
          if (part.length < 1) {
            throw new Error(`${fieldName.replace('_', ' ')} cannot contain empty parts`);
          }
        }
        
        // Maximum 5 name parts (reasonable for Filipino names)
        if (nameParts.length > 5) {
          throw new Error(`${fieldName.replace('_', ' ')} cannot have more than 5 parts`);
        }
        
        return true;
      })
      .customSanitizer((value: string) => {
        // Capitalize each word properly
        return value.trim()
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      });
  }

  /**
   * Role validation with business rules
   */
  public static validateRole(): ValidationChain {
    return body('role')
      .isIn(['client', 'worker'])
      .withMessage('Role must be either client or worker')
      .custom(async (role: string, { req }) => {
        // Additional business rules for role selection
        if (role === 'worker') {
          // Workers might have additional requirements in the future
          // For now, just ensure basic validation
        }
        
        return true;
      });
  }

  /**
   * Philippine address validation
   */
  public static validatePhilippineAddress(): ValidationChain[] {
    return [
      body('city')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('City must be between 2 and 100 characters')
        .matches(/^[a-zA-ZÀ-ÿ\s'-\.]+$/)
        .withMessage('City can only contain letters, spaces, hyphens, apostrophes, and periods')
        .customSanitizer((value: string) => {
          return value ? value.trim().replace(/\b\w/g, l => l.toUpperCase()) : value;
        }),
      
      body('province')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Province must be between 2 and 100 characters')
        .customSanitizer((value: string) => {
          return value ? value.trim().replace(/\b\w/g, l => l.toUpperCase()) : value;
        }),

      body('postal_code')
        .optional()
        .trim()
        .matches(/^\d{4,10}$/)
        .withMessage('Postal code must be 4-10 digits'),

      body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Address must be less than 500 characters')
    ];
  }

  /**
   * Age validation (18+ requirement)
   */
  public static validateAge(): ValidationChain {
    return body('date_of_birth')
      .optional()
      .isISO8601()
      .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
      .custom((value: string) => {
        if (value) {
          const today = new Date();
          const birthDate = new Date(value);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          
          if (age < 18) {
            throw new Error('You must be at least 18 years old to register');
          }

          if (age > 100) {
            throw new Error('Please enter a valid birth date');
          }
        }
        
        return true;
      });
  }

  /**
   * Emergency contact validation
   */
  public static validateEmergencyContact(): ValidationChain[] {
    return [
      body('emergency_contact_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Emergency contact name must be between 2 and 200 characters')
        .matches(/^[a-zA-ZÀ-ÿ\s'-\.]+$/)
        .withMessage('Emergency contact name can only contain letters, spaces, hyphens, apostrophes, and periods'),

      body('emergency_contact_phone')
        .optional()
        .trim()
        .matches(/^(\+63|0)9\d{9}$/)
        .withMessage('Emergency contact must be a valid Philippine phone number')
        .customSanitizer((value: string) => {
          if (value && value.startsWith('09')) {
            return '+63' + value.substring(1);
          }
          return value;
        })
    ];
  }

  /**
   * Complete registration validation chain
   */
  public static getRegistrationValidation(): ValidationChain[] {
    return [
      this.validateEmail(),
      this.validatePhilippinePhone(),
      this.validatePassword(),
      this.validateFilipineName('first_name'),
      this.validateFilipineName('last_name'),
      this.validateRole(),
      ...this.validatePhilippineAddress(),
      this.validateAge(),
      ...this.validateEmergencyContact()
    ];
  }

  /**
   * Enhanced login validation
   */
  public static getLoginValidation(): ValidationChain[] {
    return [
      body('identifier')
        .trim()
        .notEmpty()
        .withMessage('Email or phone number is required')
        .isLength({ min: 5, max: 255 })
        .withMessage('Identifier must be between 5 and 255 characters')
        .custom((value: string) => {
          // Check if it's either email or phone format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const phoneRegex = /^(\+63|0)9\d{9}$/;
          
          if (!emailRegex.test(value) && !phoneRegex.test(value)) {
            throw new Error('Must be a valid email address or Philippine phone number');
          }
          
          return true;
        })
        .customSanitizer((value: string) => {
          // Normalize phone number if provided
          if (value.startsWith('09')) {
            return '+63' + value.substring(1);
          }
          return value.toLowerCase().trim();
        }),

      body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 1, max: 128 })
        .withMessage('Password is too long')
    ];
  }

  /**
   * Validation result handler middleware
   */
  public static handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }));

      // Log validation errors for debugging
      console.log(`❌ Validation errors for ${req.method} ${req.path}:`, formattedErrors);

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formattedErrors,
        code: 'VALIDATION_ERROR'
      });
    }

    next();
  };

  /**
   * Check if email or phone already exists
   */
  public static checkUserExists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, phone } = req.body;

      if (email) {
        const existingUserByEmail = await User.findOne({ where: { email } });
        if (existingUserByEmail) {
          return res.status(409).json({
            success: false,
            error: 'An account with this email already exists',
            code: 'EMAIL_EXISTS',
            field: 'email'
          });
        }
      }

      if (phone) {
        // Normalize phone for checking
        const normalizedPhone = phone.startsWith('09') ? '+63' + phone.substring(1) : phone;
        const existingUserByPhone = await User.findOne({ where: { phone: normalizedPhone } });
        if (existingUserByPhone) {
          return res.status(409).json({
            success: false,
            error: 'An account with this phone number already exists',
            code: 'PHONE_EXISTS',
            field: 'phone'
          });
        }
      }

      next();
    } catch (error: any) {
      console.error('❌ User existence check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate user information',
        code: 'VALIDATION_CHECK_ERROR'
      });
    }
  };

  /**
   * Sanitize request body for security
   */
  public static sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    // Remove any fields that shouldn't be set directly
    const forbiddenFields = [
      'id', 'is_verified', 'is_phone_verified', 'is_email_verified',
      'verification_token', 'password_reset_token', 'password_reset_expires',
      'last_login', 'created_at', 'updated_at'
    ];

    forbiddenFields.forEach(field => {
      if (req.body[field] !== undefined) {
        delete req.body[field];
        console.log(`⚠️ Removed forbidden field '${field}' from request`);
      }
    });

    // Ensure role is not admin (only system can create admin accounts)
    if (req.body.role === 'admin') {
      req.body.role = 'client';
      console.log(`⚠️ Changed role from 'admin' to 'client' for security`);
    }

    next();
  };

  /**
   * Rate limiting validation helper
   */
  public static checkRateLimit = (req: Request, res: Response, next: NextFunction) => {
    // This would integrate with the existing rate limiter
    // For now, just add logging
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log(`🔍 Rate limit check for IP: ${clientIP} on ${req.path}`);
    
    next();
  };

  /**
   * Business rule validation for user registration
   */
  public static validateBusinessRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, email, city } = req.body;

      // Business rule examples:
      
      // 1. Weekend registration restrictions (example)
      const now = new Date();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      
      if (isWeekend && role === 'worker') {
        // In production, this might be a soft warning instead
        console.log(`ℹ️ Weekend worker registration: ${email}`);
      }

      // 2. Geographic restrictions (example)
      const supportedCities = [
        'Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Mandaluyong',
        'San Juan', 'Pasay', 'Paranaque', 'Las Piñas', 'Muntinlupa', 'Pateros',
        'Marikina', 'Valenzuela', 'Caloocan', 'Malabon', 'Navotas',
        'Cebu City', 'Davao City', 'Iloilo City', 'Cagayan de Oro', 'Zamboanga City'
      ];

      if (city && !supportedCities.some(supportedCity => 
        city.toLowerCase().includes(supportedCity.toLowerCase()) ||
        supportedCity.toLowerCase().includes(city.toLowerCase())
      )) {
        console.log(`ℹ️ Registration from unsupported city: ${city}`);
        // Don't block, but log for expansion planning
      }

      // 3. Role-specific validation
      if (role === 'worker') {
        // Workers might need additional verification in the future
        console.log(`👷 New worker registration: ${email} in ${city}`);
      }

      next();
    } catch (error: any) {
      console.error('❌ Business rule validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Business rule validation failed',
        code: 'BUSINESS_RULE_ERROR'
      });
    }
  };

/**
   * Calculate profile completion for a user
   * @param userId - User ID to calculate completion for
   * @returns Promise<number> - Completion percentage (0-100)
   */
  public static async calculateProfileCompletion(userId: string): Promise<number> {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: require('../models/Worker').default,
          as: 'workerProfile',
          required: false
        }]
      });

      if (!user) {
        return 0;
      }

      let score = 0;

      // Base user profile scoring (60 points total)
      if (user.first_name && user.last_name) score += 10;
      if (user.email && user.is_email_verified) score += 15;
      if (user.phone && user.is_phone_verified) score += 15;
      if (user.address && user.city && user.province) score += 10;
      if (user.date_of_birth) score += 5;
      if (user.emergency_contact_name && user.emergency_contact_phone) score += 5;

      // Worker-specific scoring (40 points total)
      if (user.role === 'worker' && user.workerProfile) {
        if (user.workerProfile.skills && user.workerProfile.skills.length >= 3) score += 10;
        if (user.workerProfile.bio && user.workerProfile.bio.length >= 50) score += 8;
        if (user.workerProfile.hourly_rate && user.workerProfile.hourly_rate > 0) score += 7;
        if (user.workerProfile.portfolio_images && user.workerProfile.portfolio_images.length >= 2) score += 8;
        if (user.workerProfile.nbi_clearance_status === 'approved') score += 7;
      } else if (user.role === 'client') {
        // Clients get bonus points for basic completion
        score += 40;
      }

      return Math.min(score, 100);
    } catch (error: any) {
      console.error('❌ Profile completion calculation error:', error);
      return 0;
    }
  }

  /**
   * Get role-specific onboarding steps
   * @param role - User role (client/worker)
   * @param completionPercentage - Current completion percentage
   * @returns string[] - Array of next steps
   */
  public static getOnboardingSteps(role: string, completionPercentage: number): string[] {
    if (role === 'worker') {
      if (completionPercentage < 25) {
        return ['Verify email', 'Verify phone', 'Add basic skills'];
      } else if (completionPercentage < 50) {
        return ['Complete profile info', 'Add more skills', 'Write professional bio'];
      } else if (completionPercentage < 75) {
        return ['Set hourly rate', 'Upload portfolio', 'Submit NBI clearance'];
      } else if (completionPercentage < 100) {
        return ['Complete remaining profile fields', 'Optimize your profile'];
      } else {
        return ['Your profile is complete! Start applying for jobs.'];
      }
    } else {
      // Client steps
      if (completionPercentage < 50) {
        return ['Verify email', 'Verify phone', 'Complete address'];
      } else if (completionPercentage < 80) {
        return ['Add emergency contact', 'Upload profile picture'];
      } else {
        return ['Your profile is ready! Start browsing workers.'];
      }
    }
  }

}

export default ValidationService;