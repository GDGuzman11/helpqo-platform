import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import testRoutes from './routes/test';
import { syncDatabase } from './config/database';

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

// API Routes - Updated for Worker Model
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    message: 'HelpQo API v1 - Complete marketplace models ready!',
    endpoints: {
      health: '/health',
      databaseHealth: '/health/database',
      auth: '/api/v1/auth (coming soon)',
      users: '/api/v1/users (coming soon)',
      workers: '/api/v1/workers (coming soon)',
      jobs: '/api/v1/jobs (coming soon)',
      bookings: '/api/v1/bookings (coming soon)',
      test: '/api/v1/test (development only)'
    },
    models: {
      users: 'User authentication and profiles ✅',
      workers: 'Professional worker profiles ✅',
      jobs: 'Job postings and marketplace ✅',
      bookings: 'Job assignments and workflow ✅',
      reviews: 'Rating system (coming in Step 48)'
    },
      features: {
        authentication: 'JWT + bcrypt password security',
        verification: 'Philippine NBI clearance integration',
        marketplace: 'Complete job posting, booking, payment workflow',
        location: 'Philippine cities + GPS coordinates',
        payments: 'Escrow system + commission calculation',
        workflow: 'Complete booking lifecycle (application → payment)',
        compliance: 'Philippine market validation and currency'
      }
  });
});

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