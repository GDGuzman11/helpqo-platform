import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import User from '../models/User';
import Worker from '../models/Worker';
import verificationService from '../services/verification';
import EmailService from '../services/email';
import ValidationService from '../services/validation';

const router = express.Router();

// Rate limiting for verification endpoints
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 verification requests per window
  message: { 
    error: 'Too many verification requests. Please try again in 15 minutes.',
    code: 'VERIFICATION_RATE_LIMIT_EXCEEDED'
  }
});

// Rate limiting for resend operations
const resendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 resend attempts per window
  message: { 
    error: 'Too many resend requests. Please wait 5 minutes before trying again.',
    code: 'RESEND_RATE_LIMIT_EXCEEDED'
  }
});

// Validation helper
const handleValidationErrors = (req: Request, res: Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

// GET /api/v1/verification/status/:userId - Get user verification status and progress
router.get('/status/:userId', 
  verificationLimiter,
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Get user verification status
      const verificationStatus = await verificationService.getAccountVerificationStatus(userId);
      
      // Get detailed verification progress using EmailService
      const verificationProgress = await EmailService.getVerificationProgress(userId);

      // Get user information
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'phone', 'role', 'is_verified', 'is_phone_verified', 'is_email_verified', 'created_at'],
        include: [{
          model: Worker,
          as: 'workerProfile',
          attributes: ['id', 'nbi_clearance_status', 'profile_completion_percentage', 'verification_level'],
          required: false
        }]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      console.log(`📊 Verification status requested for user: ${userId}`);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            account_age_days: Math.floor((Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24))
          },
          verification_status: verificationStatus,
          verification_progress: verificationProgress,
          worker_profile: user.workerProfile ? {
            nbi_clearance_status: user.workerProfile.nbi_clearance_status,
            profile_completion_percentage: user.workerProfile.profile_completion_percentage,
            verification_level: user.workerProfile.verification_level
          } : null,
          recommended_actions: verificationProgress.next_steps
        }
      });

    } catch (error: any) {
      console.error('❌ Verification status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get verification status',
        code: 'VERIFICATION_STATUS_ERROR'
      });
    }
  }
);

// POST /api/v1/verification/resend-email - Resend verification email
router.post('/resend-email',
  resendLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ 
        where: { email: email.toLowerCase() },
        attributes: ['id', 'email', 'first_name', 'last_name', 'role', 'is_email_verified', 'is_active']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found with this email address',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.is_active) {
        return res.status(400).json({
          success: false,
          error: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      if (user.is_email_verified) {
        return res.status(400).json({
          success: false,
          error: 'Email is already verified',
          code: 'EMAIL_ALREADY_VERIFIED'
        });
      }

      // Generate new verification token and send email
      const verificationToken = await EmailService.generateEmailVerificationToken(user.id);
      
      // Generate welcome email content
      const emailContent = EmailService.generateWelcomeEmailContent(user, verificationToken);

      console.log(`📧 Verification email resent for: ${email}`);
      console.log(`🔗 New verification link: ${emailContent.verificationLink}`);

      res.json({
        success: true,
        message: 'Verification email sent successfully',
        data: {
          email: user.email,
          verification_token: verificationToken, // In production, don't return this
          email_content_preview: process.env.NODE_ENV === 'development' ? {
            subject: emailContent.subject,
            verification_link: emailContent.verificationLink
          } : undefined
        }
      });

    } catch (error: any) {
      console.error('❌ Resend email error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification email',
        code: 'RESEND_EMAIL_ERROR'
      });
    }
  }
);

// POST /api/v1/verification/phone/send - Send SMS verification code
router.post('/phone/send',
  resendLimiter,
  [
    ValidationService.validatePhilippinePhone(),
    body('user_id').isUUID().withMessage('User ID must be a valid UUID')
  ],
  ValidationService.handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { phone, user_id } = req.body;

      // Verify user exists
      const user = await User.findByPk(user_id, {
        attributes: ['id', 'phone', 'first_name', 'last_name', 'is_phone_verified', 'is_active']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.is_active) {
        return res.status(400).json({
          success: false,
          error: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      if (user.is_phone_verified) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is already verified',
          code: 'PHONE_ALREADY_VERIFIED'
        });
      }

      // Send verification code
      const result = await verificationService.sendPhoneVerificationCode(
        phone, 
        `${user.first_name} ${user.last_name}`
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
          code: 'PHONE_VERIFICATION_FAILED'
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          phone_number: result.phoneNumber,
          code_expiry: result.codeExpiry,
          attempts_remaining: result.attemptsRemaining
        }
      });

    } catch (error: any) {
      console.error('❌ Phone verification send error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send phone verification code',
        code: 'PHONE_SEND_ERROR'
      });
    }
  }
);

// POST /api/v1/verification/phone/verify - Verify SMS verification code
router.post('/phone/verify',
  verificationLimiter,
  [
    ValidationService.validatePhilippinePhone(),
    body('verification_code')
      .isLength({ min: 6, max: 6 })
      .withMessage('Verification code must be 6 digits')
      .isNumeric()
      .withMessage('Verification code must contain only numbers'),
    body('user_id').isUUID().withMessage('User ID must be a valid UUID')
  ],
  ValidationService.handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { phone, verification_code, user_id } = req.body;

      // Verify user exists
      const user = await User.findByPk(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify phone code
      const result = await verificationService.verifyPhoneCode(phone, verification_code, user_id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
          code: 'PHONE_VERIFICATION_FAILED',
          attempts_remaining: result.attemptsRemaining
        });
      }

      // Get updated verification status
      const verificationStatus = await verificationService.getAccountVerificationStatus(user_id);

      res.json({
        success: true,
        message: result.message,
        data: {
          phone_number: result.phoneNumber,
          verification_status: verificationStatus,
          is_fully_verified: verificationStatus.isFullyVerified
        }
      });

    } catch (error: any) {
      console.error('❌ Phone verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify phone number',
        code: 'PHONE_VERIFY_ERROR'
      });
    }
  }
);

// POST /api/v1/verification/email/verify - Verify email token
router.post('/email/verify',
  verificationLimiter,
  [
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('token').isLength({ min: 32, max: 128 }).withMessage('Invalid token format')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { email, token } = req.body;

      // Verify email token
      const result = await verificationService.verifyEmailToken(email, token);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
          code: 'EMAIL_VERIFICATION_FAILED'
        });
      }

      // Find user and get updated status
      const user = await User.findOne({ where: { email } });
      if (user) {
        const verificationStatus = await verificationService.getAccountVerificationStatus(user.id);
        
        res.json({
          success: true,
          message: result.message,
          data: {
            email: result.email,
            verification_status: verificationStatus,
            is_fully_verified: verificationStatus.isFullyVerified
          }
        });
      } else {
        res.json({
          success: true,
          message: result.message,
          data: { email: result.email }
        });
      }

    } catch (error: any) {
      console.error('❌ Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify email',
        code: 'EMAIL_VERIFY_ERROR'
      });
    }
  }
);

// GET /api/v1/verification/onboarding/:userId - Get role-specific onboarding recommendations
router.get('/onboarding/:userId',
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Get verification progress which includes onboarding recommendations
      const verificationProgress = await EmailService.getVerificationProgress(userId);
      
      const user = await User.findByPk(userId, {
        attributes: ['role', 'first_name', 'created_at'],
        include: [{
          model: Worker,
          as: 'workerProfile',
          attributes: ['nbi_clearance_status', 'profile_completion_percentage', 'skills'],
          required: false
        }]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Generate role-specific recommendations
      const roleSpecificSteps = user.role === 'worker' ? [
        'Complete your worker profile with at least 3 skills',
        'Upload portfolio images showcasing your work',
        'Submit NBI clearance for government verification',
        'Set your competitive hourly rates',
        'Define your service areas and travel distance'
      ] : [
        'Complete your profile information',
        'Add emergency contact details',
        'Verify your location for local service matching',
        'Review our safety and quality guidelines',
        'Start browsing skilled professionals in your area'
      ];

      // Calculate estimated completion time
      const completedSteps = verificationProgress.next_steps.length;
      const totalSteps = roleSpecificSteps.length + 2; // +2 for email/phone verification
      const estimatedMinutes = (totalSteps - completedSteps) * 3; // 3 minutes per step

      console.log(`🎯 Onboarding recommendations for ${user.role}: ${user.first_name}`);

      res.json({
        success: true,
        data: {
          user: {
            id: userId,
            role: user.role,
            first_name: user.first_name
          },
          onboarding_progress: {
            overall_progress: verificationProgress.overall_progress,
            completed_steps: totalSteps - verificationProgress.next_steps.length,
            total_steps: totalSteps,
            estimated_completion_time: `${estimatedMinutes} minutes`
          },
          next_steps: verificationProgress.next_steps,
          role_specific_recommendations: roleSpecificSteps,
          quick_wins: user.role === 'worker' ? [
            'Add 3 key skills to your profile (+20% completion)',
            'Upload your first portfolio image (+15% completion)',
            'Complete your bio section (+10% completion)'
          ] : [
            'Verify your email address (+30% completion)',
            'Verify your phone number (+30% completion)',
            'Add your location (+20% completion)'
          ],
          benefits_unlocked: verificationProgress.can_access_full_features ? [
            'Full platform access',
            'Premium feature access',
            'Priority customer support'
          ] : [
            `${verificationProgress.overall_progress}% platform access`,
            'Limited to basic features',
            'Standard support only'
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ Onboarding recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get onboarding recommendations',
        code: 'ONBOARDING_ERROR'
      });
    }
  }
);

// Development-only endpoints
if (process.env.NODE_ENV === 'development') {
  
  // GET /api/v1/verification/preview/:template/:role - Preview email templates
  router.get('/preview/:template/:role',
    [
      param('template').isIn(['welcome']).withMessage('Template must be: welcome'),
      param('role').isIn(['client', 'worker']).withMessage('Role must be: client, worker')
    ],
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const { template, role } = req.params;

        if (template === 'welcome') {
          // Create mock user data for preview
          const mockUser = {
            id: 'preview-user-id',
            first_name: role === 'worker' ? 'Maria' : 'Juan',
            last_name: role === 'worker' ? 'Santos' : 'Dela Cruz',
            email: `${role}@example.com`,
            role: role as 'client' | 'worker'
          };

          const mockToken = 'preview-verification-token-1234567890abcdef';
          const emailContent = EmailService.generateWelcomeEmailContent(mockUser, mockToken);

          console.log(`📧 Email template preview: ${template} for ${role}`);

          res.json({
            success: true,
            template_name: `${template}_${role}`,
            preview_data: {
              subject: emailContent.subject,
              html_content: emailContent.htmlContent,
              text_content: emailContent.textContent,
              verification_link: emailContent.verificationLink
            },
            mock_user: mockUser,
            note: 'This is a development preview with mock data'
          });
        }

      } catch (error: any) {
        console.error('❌ Email preview error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate email preview',
          code: 'EMAIL_PREVIEW_ERROR'
        });
      }
    }
  );

  // GET /api/v1/verification/dev/status - Development verification statistics
  router.get('/dev/status', async (req: Request, res: Response) => {
    try {
      const totalUsers = await User.count();
      const verifiedUsers = await User.count({ where: { is_verified: true } });
      const phoneVerified = await User.count({ where: { is_phone_verified: true } });
      const emailVerified = await User.count({ where: { is_email_verified: true } });
      
      const workers = await Worker.count();
      const nbiApproved = await Worker.count({ where: { nbi_clearance_status: 'approved' } });

      res.json({
        success: true,
        verification_stats: {
          total_users: totalUsers,
          verified_users: verifiedUsers,
          phone_verified: phoneVerified,
          email_verified: emailVerified,
          verification_rate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
          workers: workers,
          nbi_approved: nbiApproved,
          nbi_approval_rate: workers > 0 ? Math.round((nbiApproved / workers) * 100) : 0
        },
        environment: 'development',
        note: 'Development statistics only'
      });

    } catch (error: any) {
      console.error('❌ Dev status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get verification statistics'
      });
    }
  });
}

export default router;