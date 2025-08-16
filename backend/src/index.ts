import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import './models';
import { testConnection } from './config/database';
import testRoutes from './routes/test';
import authRoutes from './routes/auth';
import { syncDatabase } from './config/database';
import verificationRoutes from './routes/verification';
import profileRoutes from './routes/profile';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'HelpQo API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database Health Check Route
app.get('/health/database', async (req, res) => {
  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      res.status(200).json({
        status: 'success',
        message: 'Database connection is healthy',
        database: {
          host: process.env.DB_HOST,
          name: process.env.DB_NAME,
          user: process.env.DB_USER,
          port: process.env.DB_PORT
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Database health check failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes - Enhanced with Verification System
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    message: 'HelpQo API v1 - Enhanced User Registration with Verification System ✅',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),

    // Philippine Market Features
    market: {
      target_region: 'Philippines',
      currency: 'PHP (₱)',
      commission_rate: '15%',
      supported_cities: [
        'Metro Manila', 'Quezon City', 'Makati', 'Taguig', 'Pasig',
        'Cebu City', 'Davao City', 'Iloilo City', 'Bacolod', 'Cagayan de Oro'
      ],
      compliance: {
        nbi_clearance: 'Required for workers',
        government_registration: ['DTI', 'BSP', 'SEC'],
        phone_validation: '+639XXXXXXXXX format',
        age_requirement: '18+ years old'
      }
    },

    // Available Endpoints
    endpoints: {
      authentication: {
        base: '/api/v1/auth',
        endpoints: [
          'POST /register - Enhanced user registration with Philippine validation ✅',
          'POST /login - JWT authentication with rate limiting ✅',
          'GET /dev/users - Development user listing ✅'
        ],
        features: [
          'Philippine phone normalization (+639XXXXXXXXX)',
          'Filipino name capitalization',
          'Enhanced password validation (8+ chars, upper/lower/numbers)',
          'Disposable email blocking',
          'Input sanitization and business rules',
          'Automatic worker profile creation',
          'Rate limiting (5 attempts/15min)'
        ]
      },
      verification: { // NEW: Verification endpoints
        base: '/api/v1/verification',
        endpoints: [
          'GET /status/:userId - Get comprehensive verification status ✅',
          'POST /resend-email - Resend verification email with rate limiting ✅',
          'POST /phone/send - Send SMS verification code (Philippine networks) ✅',
          'POST /phone/verify - Verify SMS code ✅',
          'POST /email/verify - Verify email token ✅',
          'GET /onboarding/:userId - Role-specific onboarding recommendations ✅',
          'GET /preview/:template/:role - Email template preview (dev only) ✅'
        ],
        features: [
          'Email verification with 64-character hex tokens',
          'SMS verification for Philippine phone numbers',
          'Professional email templates with Philippine branding',
          'Onboarding progress tracking with weighted scoring',
          'Role-specific recommendations (client vs worker)',
          'Multi-tier rate limiting (verification: 10/15min, resend: 3/5min)',
          'Account verification status with next-step guidance'
        ]
      },
      testing: {
        base: '/api/v1/test',
        endpoints: [
          'POST /sync - Database synchronization ✅',
          'DELETE /cleanup - Test data cleanup ✅',
          'POST /user - Test user creation with validation ✅',
          'POST /worker - Test worker creation with NBI compliance ✅',
          'POST /job - Test job creation with budget validation ✅',
          'POST /booking - Test booking workflow with commission ✅',
          'POST /workflow - Complete 7-step marketplace workflow ✅',
          'POST /validation/phone - Philippine phone validation testing ✅',
          'POST /validation/name - Filipino name processing testing ✅',
          'POST /validation/registration - Complete validation chain testing ✅'
        ]
      }
    },

    // Database Models Status
    models: {
      users: 'User authentication and profiles ✅',
      workers: 'Professional worker profiles with NBI clearance ✅',
      jobs: 'Job postings with ₱50-₱50,000 budget validation ✅',
      bookings: 'Complete workflow management with 15% commission ✅',
      reviews: 'Rating system with 6-category scoring ✅'
    },

    // Enhanced Features in Step 52
    enhanced_features: {
      'Philippine Compliance': 'NBI clearance, ₱ currency, +639 phone validation',
      'Email Verification': 'Professional templates with role-specific content',
      'SMS Verification': 'Philippine mobile network integration ready',
      'Advanced Validation': '20+ validation rules with business logic',
      'Profile Completion': 'Weighted scoring algorithms with recommendations',
      'Rate Limiting': 'Multi-tier protection (auth, verification, resend)',
      'Input Sanitization': 'Security-first approach with forbidden field removal',
      'Business Intelligence': 'Verification analytics and user engagement scoring'
    },

    // Development Features
    development: {
      email_preview: 'Template preview system with mock data',
      validation_testing: 'Comprehensive validation endpoint testing',
      verification_statistics: 'Real-time verification metrics',
      debug_logging: 'Detailed console logging for development'
    }
  });
});

// Authentication Routes
app.use('/api/v1/auth', authRoutes);

// Verification Routes - NEW
app.use('/api/v1/verification', verificationRoutes);

// Profile Routes - NEW
app.use('/api/v1/profile', profileRoutes);

// Test Routes - For development and model testing
if (process.env.NODE_ENV === 'development') {
  app.use('/api/v1/test', testRoutes);
}

// Test Routes - For development and model testing
if (process.env.NODE_ENV === 'development') {
  app.use('/api/v1/test', testRoutes);
}

// Temporary catch-all for API routes
app.use('/api/v1/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API endpoint ${req.originalUrl} not implemented yet`,
    availableEndpoints: ['/api/v1', '/health']
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: ['/health', '/api/v1']
  });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server with Database Connection Test
const startServer = async () => {
  try {
    // Test database connection before starting server
    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Database connection failed. Please check your database settings.');
      process.exit(1);
    }

    // Start the server
    app.listen(PORT, () => {
      console.log(`
🚀 HelpQo API Server Started Successfully!
📡 Environment: ${process.env.NODE_ENV || 'development'}
🌍 Server running on: http://localhost:${PORT}
🏥 Health check: http://localhost:${PORT}/health
🗄️ Database health: http://localhost:${PORT}/health/database
📚 API base: http://localhost:${PORT}/api/v1
⏰ Started at: ${new Date().toLocaleString()}
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;