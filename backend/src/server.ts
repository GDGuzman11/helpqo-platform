import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import your existing models and database config
import { testConnection, syncDatabase } from './config/database';
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// ==================== SECURITY MIDDLEWARE ====================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use(limiter);

// ==================== BODY PARSING ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== REQUEST LOGGING ====================

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📋 ${timestamp} | ${req.method} ${req.originalUrl} | IP: ${req.ip}`);
  next();
});

// ==================== HEALTH ENDPOINTS ====================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'HelpQo API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: API_VERSION
  });
});

app.get('/health/database', async (req, res) => {
  try {
    await testConnection();
    res.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Database health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== API INFO ====================

app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    success: true,
    message: 'HelpQo API - Philippine Marketplace Platform',
    version: API_VERSION,
    environment: process.env.NODE_ENV,
    features: {
      authentication: 'JWT-based with role management',
      currency: 'Philippine Peso (₱)',
      compliance: 'NBI clearance and phone verification'
    },
    endpoints: {
      authentication: `/api/${API_VERSION}/auth/*`,
      health: '/health',
      database_health: '/health/database'
    },
    development_status: {
      current_step: 'Step 51: Authentication System Development',
      models_complete: 'User, Worker, Job, Booking, Review ✅',
      next_phase: 'API Development (Steps 52-70)'
    }
  });
});

// ==================== ROUTES ====================

// Authentication routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    available_endpoints: {
      health: '/health',
      api_info: `/api/${API_VERSION}`,
      authentication: `/api/${API_VERSION}/auth/*`
    }
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Global error:', error);

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    console.log('🚀 Starting HelpQo API Server...');
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);

    // Test database connection
    console.log('🔄 Testing database connection...');
    await testConnection();
    console.log('✅ Database connection successful');

    // Sync database models (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Synchronizing database models...');
      await syncDatabase(false);
      console.log('✅ Database models synchronized');
    }

    // Start the server
    app.listen(PORT, () => {
      console.log('🎉 HelpQo API Server is running!');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 API Info: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`🔐 Auth Endpoints: http://localhost:${PORT}/api/${API_VERSION}/auth/*`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Available Auth Endpoints:');
        console.log(`   POST /api/${API_VERSION}/auth/register - User registration`);
        console.log(`   POST /api/${API_VERSION}/auth/login - User login`);
        console.log(`   GET /api/${API_VERSION}/auth/dev/users - List users (dev only)`);
      }
      
      console.log('🏗️ Ready for Step 51 testing!');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;