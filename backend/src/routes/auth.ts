import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import Worker from '../models/Worker';
import ValidationService from '../services/validation';
import { EmailService } from '../services/email';


const router = express.Router();
const emailService = new EmailService();

// Rate limiting for auth endpoints
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per IP
  message: {
    error: 'Too many registration attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Generate JWT token
const generateToken = (user: any): string => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    is_verified: user.is_verified
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(
    payload,
    secret,
    { 
      expiresIn: '7d',  // Use literal string instead of env variable
      issuer: 'helpqo-api',
      audience: 'helpqo-app'
    }
  );
};

// Sanitize user data for response
const sanitizeUserResponse = (user: any) => {
  const userData = user.toJSON ? user.toJSON() : user;
  const { password_hash, verification_token, password_reset_token, ...safeUserData } = userData;
  return safeUserData;
};

// Enhanced registration validation using ValidationService
const registrationValidation = ValidationService.getRegistrationValidation();

// Enhanced login validation using ValidationService  
const loginValidation = ValidationService.getLoginValidation();

// POST /api/v1/auth/register
router.post('/register', registrationLimiter, ValidationService.sanitizeInput ,registrationValidation, ValidationService.handleValidationErrors, ValidationService.checkUserExists, ValidationService.validateBusinessRules ,async (req: Request, res: Response) => {
  try {

    const { email, phone, password, first_name, last_name, role, city, province } = req.body;
    
    // Create user
    const user = await User.create({
      email,
      phone,
      password_hash: password, // Will be hashed by model hook
      first_name,
      last_name,
      role,
      city,
      province
    });

    // Create worker profile if needed
    if (role === 'worker') {
      await Worker.create({
        user_id: user.id,
        skills: ['General Services'], // <-- ADD DEFAULT SKILL
        experience_years: 0,
        service_areas: city ? [city] : [],
        max_travel_distance: 10,
        preferred_payment_methods: ['GCash'],
        nbi_clearance_status: 'pending'
      });
    }

    const token = generateToken(user);
    await user.updateLastLogin();

    console.log(`✅ New ${role} registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: sanitizeUserResponse(user),
        token
      }
    });

  } catch (error: any) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// POST /api/v1/auth/login
router.post('/login', loginLimiter, loginValidation, async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email/phone and password required'
      });
    }

    const user = await User.findByEmailOrPhone(identifier);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    await user.updateLastLogin();
    const token = generateToken(user);

    console.log(`✅ User logged in: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizeUserResponse(user),
        token
      }
    });

  } catch (error: any) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/v1/auth/refresh-token
 * Refresh JWT token
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify the existing token (allowing expired tokens for refresh)
    let decoded: any;
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not defined');
      decoded = jwt.verify(token, secret);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        // Allow expired tokens for refresh
        decoded = jwt.decode(token);
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
    }

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new token
    const newToken = generateToken(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        expires_in: '7d'
      },
      code: 'TOKEN_REFRESHED'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during token refresh',
      code: 'TOKEN_REFRESH_ERROR'
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * User logout (token invalidation would require token blacklist in production)
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // In production, implement token blacklisting here
    res.json({
      success: true,
      message: 'Logout successful',
      code: 'LOGOUT_SUCCESS'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during logout',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user profile with enhanced data
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not defined');
    const decoded: any = jwt.verify(token, secret);
    
    // Get user data with associations
    const user = await User.findByPk(decoded.id, {
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

// Get profile completion
let profileCompletion = 50; // Default
console.log('🔍 AUTH: About to calculate profile completion for user:', user.id);
try {
  profileCompletion = await ValidationService.calculateProfileCompletion(user.id);
  console.log('🔍 AUTH: Profile completion result:', profileCompletion);
} catch (error) {
  console.log('❌ AUTH: Profile completion calculation error:', error);
}

// Get next steps
let nextSteps: string[] = [];
try {
  nextSteps = ValidationService.getOnboardingSteps(user.role, profileCompletion);
} catch (error) {
  console.log('Onboarding steps error:', error);

  // Fallback steps
  nextSteps = user.role === 'worker' ? 
    ['Complete NBI clearance', 'Add skills', 'Set hourly rate'] :
    ['Verify email', 'Complete profile'];
}

    res.json({
      success: true,
      data: {
        user: sanitizeUserResponse(user),
        worker_profile: user.workerProfile ? {
          skills: user.workerProfile.skills,
          experience_years: user.workerProfile.experience_years,
          service_areas: user.workerProfile.service_areas,
          hourly_rate: user.workerProfile.hourly_rate,
          rating: user.workerProfile.rating,
          total_jobs_completed: user.workerProfile.total_jobs_completed,
          nbi_clearance_status: user.workerProfile.nbi_clearance_status,
          availability_status: user.workerProfile.availability_status
        } : null,
        profile_status: {
          completion_percentage: profileCompletion,
          next_steps: nextSteps
        }
      },
      code: 'PROFILE_RETRIEVED'
    });

  } catch (error) {
    console.error('Profile retrieval error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'PROFILE_ERROR'
    });
  }
});

// Development endpoints
if (process.env.NODE_ENV === 'development') {
  router.get('/dev/users', async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password_hash'] },
        include: [{
          model: Worker,
          as: 'workerProfile',
          required: false
        }],
        limit: 10
      });

      res.json({
        success: true,
        data: { users }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  });
}

export default router;