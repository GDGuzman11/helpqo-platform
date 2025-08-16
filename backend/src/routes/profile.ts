import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import Worker from '../models/Worker';
import ValidationService from '../services/validation';
import { EmailService } from '../services/email';

const router = express.Router();

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    is_verified: boolean;
  };
}

// Rate limiting for profile operations
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 profile updates per window
  message: {
    error: 'Too many profile update requests. Please try again in 15 minutes.',
    code: 'PROFILE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const portfolioUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 portfolio uploads per window
  message: {
    error: 'Too many portfolio upload requests. Please try again in 10 minutes.',
    code: 'PORTFOLIO_RATE_LIMIT_EXCEEDED'
  }
});

// JWT Authentication Middleware
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // Verify user still exists and is active
    const user = await User.findByPk(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'INVALID_USER'
      });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      is_verified: decoded.is_verified
    };

    next();
  } catch (error: any) {
    console.error('🔒 Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Validation helper
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
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

// Profile completion calculation helper
const calculateProfileCompletion = (user: any, workerProfile?: any): {
  percentage: number;
  completedFields: string[];
  missingFields: string[];
  recommendations: string[];
} => {
  const completedFields: string[] = [];
  const missingFields: string[] = [];
  let score = 0;

  // Base user profile scoring (60 points total)
  if (user.first_name && user.last_name) {
    completedFields.push('name');
    score += 10;
  } else {
    missingFields.push('name');
  }

  if (user.email && user.is_email_verified) {
    completedFields.push('email_verified');
    score += 15;
  } else {
    missingFields.push('email_verified');
  }

  if (user.phone && user.is_phone_verified) {
    completedFields.push('phone_verified');
    score += 15;
  } else {
    missingFields.push('phone_verified');
  }

  if (user.address && user.city && user.province) {
    completedFields.push('address');
    score += 10;
  } else {
    missingFields.push('address');
  }

  if (user.date_of_birth) {
    completedFields.push('birth_date');
    score += 5;
  } else {
    missingFields.push('birth_date');
  }

  if (user.emergency_contact_name && user.emergency_contact_phone) {
    completedFields.push('emergency_contact');
    score += 5;
  } else {
    missingFields.push('emergency_contact');
  }

  // Worker-specific scoring (40 points total)
  if (user.role === 'worker' && workerProfile) {
    if (workerProfile.skills && workerProfile.skills.length >= 3) {
      completedFields.push('skills');
      score += 10;
    } else {
      missingFields.push('skills');
    }

    if (workerProfile.bio && workerProfile.bio.length >= 50) {
      completedFields.push('bio');
      score += 8;
    } else {
      missingFields.push('bio');
    }

    if (workerProfile.hourly_rate && workerProfile.hourly_rate > 0) {
      completedFields.push('hourly_rate');
      score += 7;
    } else {
      missingFields.push('hourly_rate');
    }

    if (workerProfile.portfolio_images && workerProfile.portfolio_images.length >= 2) {
      completedFields.push('portfolio');
      score += 8;
    } else {
      missingFields.push('portfolio');
    }

    if (workerProfile.nbi_clearance_status === 'approved') {
      completedFields.push('nbi_clearance');
      score += 7;
    } else {
      missingFields.push('nbi_clearance');
    }
  } else if (user.role === 'client') {
    // Clients get bonus points for basic completion
    score += 40;
    completedFields.push('client_profile_complete');
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (missingFields.includes('email_verified')) recommendations.push('Verify your email address');
  if (missingFields.includes('phone_verified')) recommendations.push('Verify your phone number');
  if (missingFields.includes('skills')) recommendations.push('Add at least 3 professional skills');
  if (missingFields.includes('bio')) recommendations.push('Write a detailed bio (50+ characters)');
  if (missingFields.includes('hourly_rate')) recommendations.push('Set your competitive hourly rate');
  if (missingFields.includes('portfolio')) recommendations.push('Upload 2+ portfolio images');
  if (missingFields.includes('nbi_clearance')) recommendations.push('Submit NBI clearance for verification');
  if (missingFields.includes('address')) recommendations.push('Complete your address information');

  return {
    percentage: Math.min(score, 100),
    completedFields,
    missingFields,
    recommendations
  };
};

// ==================== PROFILE ENDPOINTS ====================

/**
 * PUT /api/v1/profile
 * Update user profile information
 */
router.put('/', 
  profileUpdateLimiter,
  authenticateToken,
  [
    ...ValidationService.validatePhilippineAddress(),
    ...ValidationService.validateEmergencyContact(),
    ValidationService.validateAge(),
    body('profile_picture')
      .optional()
      .isURL()
      .withMessage('Profile picture must be a valid URL'),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const {
        first_name,
        last_name,
        date_of_birth,
        address,
        city,
        province,
        postal_code,
        emergency_contact_name,
        emergency_contact_phone,
        profile_picture
      } = req.body;

      // Get current user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Update user profile
      const updateData: any = {};
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;
      if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (province !== undefined) updateData.province = province;
      if (postal_code !== undefined) updateData.postal_code = postal_code;
      if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name;
      if (emergency_contact_phone !== undefined) updateData.emergency_contact_phone = emergency_contact_phone;
      if (profile_picture !== undefined) updateData.profile_picture = profile_picture;

      await user.update(updateData);

      // Get updated profile with completion calculation
      const updatedUser = await User.findByPk(userId, {
        include: [{
          model: Worker,
          as: 'workerProfile',
          required: false
        }]
      });

      const profileAnalysis = calculateProfileCompletion(updatedUser, updatedUser?.workerProfile);

      console.log(`✅ Profile updated for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser!.id,
            email: updatedUser!.email,
            first_name: updatedUser!.first_name,
            last_name: updatedUser!.last_name,
            role: updatedUser!.role,
            date_of_birth: updatedUser!.date_of_birth,
            address: updatedUser!.address,
            city: updatedUser!.city,
            province: updatedUser!.province,
            postal_code: updatedUser!.postal_code,
            emergency_contact_name: updatedUser!.emergency_contact_name,
            emergency_contact_phone: updatedUser!.emergency_contact_phone,
            profile_picture: updatedUser!.profile_picture,
            is_email_verified: updatedUser!.is_email_verified,
            is_phone_verified: updatedUser!.is_phone_verified,
            is_verified: updatedUser!.is_verified
          },
          profile_completion: profileAnalysis,
          updated_fields: Object.keys(updateData)
        }
      });

    } catch (error: any) {
      console.error('❌ Profile update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  }
);

/**
 * PUT /api/v1/profile/worker
 * Update worker-specific profile data
 */
router.put('/worker',
  profileUpdateLimiter,
  authenticateToken,
  [
    body('hourly_rate')
      .optional()
      .isFloat({ min: 50, max: 5000 })
      .withMessage('Hourly rate must be between ₱50 and ₱5000'),
    body('experience_years')
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('Experience years must be between 0 and 50'),
    body('bio')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Bio must be less than 1000 characters'),
    body('max_travel_distance')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Travel distance must be between 1 and 100 kilometers'),
    body('service_areas')
      .optional()
      .isArray({ min: 1, max: 10 })
      .withMessage('Must provide 1-10 service areas'),
    body('preferred_payment_methods')
      .optional()
      .isArray()
      .withMessage('Payment methods must be an array'),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      // Verify user is a worker
      const user = await User.findByPk(userId);
      if (!user || user.role !== 'worker') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Worker role required.',
          code: 'WORKER_ROLE_REQUIRED'
        });
      }

      // Find worker profile
      const workerProfile = await Worker.findOne({ where: { user_id: userId } });
      if (!workerProfile) {
        return res.status(404).json({
          success: false,
          error: 'Worker profile not found',
          code: 'WORKER_PROFILE_NOT_FOUND'
        });
      }

      const {
        hourly_rate,
        experience_years,
        bio,
        max_travel_distance,
        service_areas,
        preferred_payment_methods,
        is_available
      } = req.body;

      // Update worker profile
      const updateData: any = {};
      if (hourly_rate !== undefined) updateData.hourly_rate = hourly_rate;
      if (experience_years !== undefined) updateData.experience_years = experience_years;
      if (bio !== undefined) updateData.bio = bio;
      if (max_travel_distance !== undefined) updateData.max_travel_distance = max_travel_distance;
      if (service_areas !== undefined) updateData.service_areas = service_areas;
      if (preferred_payment_methods !== undefined) updateData.preferred_payment_methods = preferred_payment_methods;
      if (is_available !== undefined) updateData.is_available = is_available;

      await workerProfile.update(updateData);

      // Recalculate profile completion
      const updatedWorker = await Worker.findByPk(workerProfile.id);
      const profileAnalysis = calculateProfileCompletion(user, updatedWorker);

      console.log(`👷 Worker profile updated for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Worker profile updated successfully',
        data: {
          worker_profile: {
            id: updatedWorker!.id,
            hourly_rate: updatedWorker!.hourly_rate,
            experience_years: updatedWorker!.experience_years,
            bio: updatedWorker!.bio,
            max_travel_distance: updatedWorker!.max_travel_distance,
            service_areas: updatedWorker!.service_areas,
            preferred_payment_methods: updatedWorker!.preferred_payment_methods,
            is_available: updatedWorker!.is_available,
            rating_average: updatedWorker!.rating_average,
            total_jobs_completed: updatedWorker!.total_jobs_completed,
            nbi_clearance_status: updatedWorker!.nbi_clearance_status,
            verification_level: updatedWorker!.verification_level,
            profile_completion_percentage: updatedWorker!.profile_completion_percentage
          },
          profile_completion: profileAnalysis,
          updated_fields: Object.keys(updateData)
        }
      });

    } catch (error: any) {
      console.error('❌ Worker profile update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update worker profile',
        code: 'WORKER_UPDATE_ERROR'
      });
    }
  }
);

/**
 * POST /api/v1/profile/skills
 * Add or update worker skills
 */
router.post('/skills',
  profileUpdateLimiter,
  authenticateToken,
  [
    body('skills')
      .isArray({ min: 1, max: 20 })
      .withMessage('Must provide 1-20 skills'),
    body('skills.*')
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('Each skill must be 2-50 characters'),
    body('action')
      .optional()
      .isIn(['replace', 'add'])
      .withMessage('Action must be either "replace" or "add"')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { skills, action = 'replace' } = req.body;

      // Verify user is a worker
      const user = await User.findByPk(userId);
      if (!user || user.role !== 'worker') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Worker role required.',
          code: 'WORKER_ROLE_REQUIRED'
        });
      }

      // Find worker profile
      const workerProfile = await Worker.findOne({ where: { user_id: userId } });
      if (!workerProfile) {
        return res.status(404).json({
          success: false,
          error: 'Worker profile not found',
          code: 'WORKER_PROFILE_NOT_FOUND'
        });
      }

      // Clean and validate skills
      const cleanedSkills = skills.map((skill: string) => 
        skill.trim().toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
      );

    // Remove duplicates with explicit typing
      const uniqueSkills: string[] = [...new Set<string>(cleanedSkills)];

      // Update skills based on action
      let updatedSkills: string[];
      if (action === 'add') {
        // Add new skills to existing ones
        const currentSkills: string[] = workerProfile.skills || [];
        updatedSkills = [...new Set<string>([...currentSkills, ...uniqueSkills])];
      } else {
        // Replace all skills
        updatedSkills = uniqueSkills;
      }

      // Validate final skill count
      if (updatedSkills.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 20 skills allowed',
          code: 'TOO_MANY_SKILLS'
        });
      }

      await workerProfile.update({ skills: updatedSkills });

      // Recalculate profile completion
      const profileAnalysis = calculateProfileCompletion(user, workerProfile);

      console.log(`🛠️ Skills updated for worker: ${user.email} (${action})`);

      res.json({
        success: true,
        message: `Skills ${action === 'add' ? 'added' : 'updated'} successfully`,
        data: {
          skills: updatedSkills,
          skills_count: updatedSkills.length,
          action_performed: action,
          profile_completion: profileAnalysis,
          skill_recommendations: [
            'Add specific technical skills for better job matching',
            'Include both hard and soft skills',
            'Use clear, searchable skill names',
            'Consider industry-standard skill categories'
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ Skills update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update skills',
        code: 'SKILLS_UPDATE_ERROR'
      });
    }
  }
);

/**
 * PUT /api/v1/profile/nbi-clearance
 * Update NBI clearance information
 */
router.put('/nbi-clearance',
  profileUpdateLimiter,
  authenticateToken,
  [
    body('nbi_clearance_number')
      .optional()
      .isLength({ min: 5, max: 100 })
      .withMessage('NBI clearance number must be 5-100 characters'),
    body('nbi_clearance_expires')
      .optional()
      .isISO8601()
      .withMessage('NBI clearance expiry must be a valid date (YYYY-MM-DD)')
      .custom((value: string) => {
        if (value && new Date(value) <= new Date()) {
          throw new Error('NBI clearance expiry must be in the future');
        }
        return true;
      }),
    body('nbi_clearance_status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'expired'])
      .withMessage('NBI status must be: pending, approved, rejected, or expired')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { nbi_clearance_number, nbi_clearance_expires, nbi_clearance_status } = req.body;

      // Verify user is a worker
      const user = await User.findByPk(userId);
      if (!user || user.role !== 'worker') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Worker role required.',
          code: 'WORKER_ROLE_REQUIRED'
        });
      }

      // Find worker profile
      const workerProfile = await Worker.findOne({ where: { user_id: userId } });
      if (!workerProfile) {
        return res.status(404).json({
          success: false,
          error: 'Worker profile not found',
          code: 'WORKER_PROFILE_NOT_FOUND'
        });
      }

      // Update NBI clearance information
      const updateData: any = {};
      if (nbi_clearance_number !== undefined) updateData.nbi_clearance_number = nbi_clearance_number;
      if (nbi_clearance_expires !== undefined) updateData.nbi_clearance_expires = nbi_clearance_expires;
      if (nbi_clearance_status !== undefined) updateData.nbi_clearance_status = nbi_clearance_status;

      await workerProfile.update(updateData);

      // Check if worker can be auto-verified
      const updatedWorker = await Worker.findByPk(workerProfile.id);
      if (updatedWorker!.nbi_clearance_status === 'approved' && 
          updatedWorker!.profile_completion_percentage >= 80) {
        await updatedWorker!.update({ verification_level: 'verified' });
      }

      // Recalculate profile completion
      const profileAnalysis = calculateProfileCompletion(user, updatedWorker);

      console.log(`🛡️ NBI clearance updated for worker: ${user.email} - Status: ${nbi_clearance_status}`);

      res.json({
        success: true,
        message: 'NBI clearance information updated successfully',
        data: {
          nbi_clearance: {
            status: updatedWorker!.nbi_clearance_status,
            number: updatedWorker!.nbi_clearance_number,
            expires: updatedWorker!.nbi_clearance_expires,
            verification_level: updatedWorker!.verification_level
          },
          profile_completion: profileAnalysis,
          compliance_status: {
            nbi_compliant: updatedWorker!.nbi_clearance_status === 'approved',
            can_accept_premium_jobs: updatedWorker!.nbi_clearance_status === 'approved' && profileAnalysis.percentage >= 80,
            verification_level: updatedWorker!.verification_level
          }
        }
      });

    } catch (error: any) {
      console.error('❌ NBI clearance update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update NBI clearance',
        code: 'NBI_UPDATE_ERROR'
      });
    }
  }
);

/**
 * GET /api/v1/profile/completion
 * Get detailed profile completion analytics
 */
router.get('/completion',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      // Get user with worker profile
      const user = await User.findByPk(userId, {
        include: [{
          model: Worker,
          as: 'workerProfile',
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

      // Calculate comprehensive profile completion
      const profileAnalysis = calculateProfileCompletion(user, user.workerProfile);

      // Get role-specific next steps
      const roleSpecificSteps = user.role === 'worker' ? [
        'Complete worker skills (minimum 3)',
        'Write professional bio (50+ characters)',
        'Set competitive hourly rate',
        'Upload portfolio images (minimum 2)',
        'Submit NBI clearance documents',
        'Define service areas and travel distance'
      ] : [
        'Verify email address',
        'Verify phone number',
        'Complete address information',
        'Add emergency contact',
        'Upload profile picture'
      ];

      // Calculate earning potential (for workers)
      let earningPotential = null;
      if (user.role === 'worker' && user.workerProfile) {
        const baseRate = user.workerProfile.hourly_rate || 150;
        const completionMultiplier = 1 + (profileAnalysis.percentage / 100);
        const verificationBonus = user.workerProfile.nbi_clearance_status === 'approved' ? 1.2 : 1;
        
        earningPotential = {
          current_rate: user.workerProfile.hourly_rate,
          optimized_rate: Math.round(baseRate * completionMultiplier * verificationBonus),
          weekly_potential: Math.round(baseRate * completionMultiplier * verificationBonus * 40), // 40 hours/week
          improvement_factors: [
            `Profile completion: +${Math.round((completionMultiplier - 1) * 100)}%`,
            `NBI verification: +${Math.round((verificationBonus - 1) * 100)}%`
          ]
        };
      }

      console.log(`📊 Profile completion requested for: ${user.email} (${profileAnalysis.percentage}%)`);

      res.json({
        success: true,
        data: {
          user_profile: {
            id: user.id,
            email: user.email,
            role: user.role,
            account_age_days: Math.floor((Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24))
          },
          completion_analysis: profileAnalysis,
          progress_breakdown: {
            basic_info: profileAnalysis.completedFields.includes('name') ? 'Complete' : 'Incomplete',
            contact_verification: {
              email: user.is_email_verified,
              phone: user.is_phone_verified
            },
            address_info: profileAnalysis.completedFields.includes('address') ? 'Complete' : 'Incomplete',
            worker_specific: user.role === 'worker' ? {
              skills: profileAnalysis.completedFields.includes('skills') ? 'Complete' : 'Incomplete',
              bio: profileAnalysis.completedFields.includes('bio') ? 'Complete' : 'Incomplete',
              rate: profileAnalysis.completedFields.includes('hourly_rate') ? 'Complete' : 'Incomplete',
              portfolio: profileAnalysis.completedFields.includes('portfolio') ? 'Complete' : 'Incomplete',
              nbi_clearance: profileAnalysis.completedFields.includes('nbi_clearance') ? 'Complete' : 'Incomplete'
            } : null
          },
          recommendations: {
            immediate_actions: profileAnalysis.recommendations.slice(0, 3),
            all_recommendations: profileAnalysis.recommendations,
            role_specific_steps: roleSpecificSteps,
            estimated_completion_time: `${profileAnalysis.missingFields.length * 5} minutes`
          },
          earning_potential: earningPotential,
          milestones: {
            next_milestone: profileAnalysis.percentage < 25 ? '25% - Basic Profile' :
                            profileAnalysis.percentage < 50 ? '50% - Verified Profile' :
                            profileAnalysis.percentage < 75 ? '75% - Professional Profile' :
                            profileAnalysis.percentage < 100 ? '100% - Premium Profile' : 'Complete',
            benefits_at_next_milestone: profileAnalysis.percentage < 50 ? [
              'Improved search visibility',
              'Basic job matching'
            ] : profileAnalysis.percentage < 80 ? [
              'Priority in search results',
              'Access to premium jobs',
              'Enhanced customer trust'
            ] : [
              'Maximum visibility',
              'Top-tier job opportunities',
              'Premium support access'
            ]
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Profile completion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile completion',
        code: 'COMPLETION_ERROR'
      });
    }
  }
);

/**
 * POST /api/v1/profile/portfolio
 * Upload portfolio images for workers
 */
router.post('/portfolio',
  portfolioUploadLimiter,
  authenticateToken,
  [
    body('images')
      .isArray({ min: 1, max: 10 })
      .withMessage('Must provide 1-10 portfolio images'),
    body('images.*')
      .isURL()
      .withMessage('Each image must be a valid URL'),
    body('action')
      .optional()
      .isIn(['replace', 'add'])
      .withMessage('Action must be either "replace" or "add"')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { images, action = 'add' } = req.body;

      // Verify user is a worker
      const user = await User.findByPk(userId);
      if (!user || user.role !== 'worker') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Worker role required.',
          code: 'WORKER_ROLE_REQUIRED'
        });
      }

      // Find worker profile
      const workerProfile = await Worker.findOne({ where: { user_id: userId } });
      if (!workerProfile) {
        return res.status(404).json({
          success: false,
          error: 'Worker profile not found',
          code: 'WORKER_PROFILE_NOT_FOUND'
        });
      }

      // Update portfolio images
      let updatedImages: string[];
      if (action === 'add') {
        const currentImages = workerProfile.portfolio_images || [];
        updatedImages = [...currentImages, ...images];
      } else {
        updatedImages = images;
      }

      // Remove duplicates and validate count
      updatedImages = [...new Set(updatedImages)];
      if (updatedImages.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 portfolio images allowed',
          code: 'TOO_MANY_IMAGES'
        });
      }

      await workerProfile.update({ portfolio_images: updatedImages });

      // Recalculate profile completion
      const profileAnalysis = calculateProfileCompletion(user, workerProfile);

      console.log(`📸 Portfolio updated for worker: ${user.email} (${action} - ${images.length} images)`);

      res.json({
        success: true,
        message: `Portfolio images ${action === 'add' ? 'added' : 'updated'} successfully`,
        data: {
          portfolio: {
            images: updatedImages,
            image_count: updatedImages.length,
            action_performed: action
          },
          profile_completion: profileAnalysis,
          portfolio_tips: [
            'Use high-quality, well-lit images',
            'Show before/after work examples',
            'Include diverse work samples',
            'Add captions describing your work'
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ Portfolio update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update portfolio',
        code: 'PORTFOLIO_UPDATE_ERROR'
      });
    }
  }
);

/**
 * PUT /api/v1/profile/availability
 * Update worker availability and schedule
 */
router.put('/availability',
  profileUpdateLimiter,
  authenticateToken,
  [
    body('is_available')
      .isBoolean()
      .withMessage('Availability status must be true or false'),
    body('availability_schedule')
      .optional()
      .isObject()
      .withMessage('Schedule must be a valid object'),
    body('availability_note')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Availability note must be less than 500 characters')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { is_available, availability_schedule, availability_note } = req.body;

      // Verify user is a worker
      const user = await User.findByPk(userId);
      if (!user || user.role !== 'worker') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Worker role required.',
          code: 'WORKER_ROLE_REQUIRED'
        });
      }

      // Find worker profile
      const workerProfile = await Worker.findOne({ where: { user_id: userId } });
      if (!workerProfile) {
        return res.status(404).json({
          success: false,
          error: 'Worker profile not found',
          code: 'WORKER_PROFILE_NOT_FOUND'
        });
      }

      // Update availability
      const updateData: any = { is_available };
      
      if (availability_schedule !== undefined) {
        // Merge with existing availability data
        const currentAvailability = workerProfile.availability || {};
        updateData.availability = {
          ...currentAvailability,
          schedule: availability_schedule,
          last_updated: new Date().toISOString()
        };
      }

      if (availability_note !== undefined) {
        const currentAvailability = workerProfile.availability || {};
        updateData.availability = {
          ...updateData.availability,
          ...currentAvailability,
          note: availability_note
        };
      }

      await workerProfile.update(updateData);

      console.log(`⏰ Availability updated for worker: ${user.email} - Available: ${is_available}`);

      res.json({
        success: true,
        message: 'Availability updated successfully',
        data: {
          availability: {
            is_available: workerProfile.is_available,
            schedule: workerProfile.availability?.schedule,
            note: workerProfile.availability?.note,
            last_updated: workerProfile.availability?.last_updated
          },
          status_message: is_available ? 'You are now available for new jobs' : 'You are currently unavailable for new jobs',
          recommendations: is_available ? [
            'Respond to job inquiries promptly',
            'Keep your profile information updated',
            'Maintain good communication with clients'
          ] : [
            'Update your availability when ready for new jobs',
            'Consider setting an availability note for clients',
            'Use unavailable time to improve your profile'
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ Availability update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update availability',
        code: 'AVAILABILITY_UPDATE_ERROR'
      });
    }
  }
);

// Development endpoint for testing
if (process.env.NODE_ENV === 'development') {
  /**
   * GET /api/v1/profile/dev/analytics
   * Development analytics for profile completion
   */
  router.get('/dev/analytics', async (req: Request, res: Response) => {
    try {
      const totalUsers = await User.count();
      const totalWorkers = await Worker.count();
      
      // Get average completion rates
      const workers = await Worker.findAll({
        attributes: ['profile_completion_percentage']
      });
      
      const avgCompletion = workers.length > 0 
        ? workers.reduce((sum, w) => sum + w.profile_completion_percentage, 0) / workers.length
        : 0;

      const highCompletion = await Worker.count({
        where: { profile_completion_percentage: { [require('sequelize').Op.gte]: 80 } }
      });

      res.json({
        success: true,
        analytics: {
          total_users: totalUsers,
          total_workers: totalWorkers,
          average_completion: Math.round(avgCompletion),
          high_completion_workers: highCompletion,
          completion_rate: totalWorkers > 0 ? Math.round((highCompletion / totalWorkers) * 100) : 0
        },
        environment: 'development'
      });

    } catch (error: any) {
      console.error('❌ Dev analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics'
      });
    }
  });
}

export default router;