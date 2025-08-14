import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ override: true });

// DEBUG: Log database configuration
console.log('🔍 Database Configuration Debug:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***HIDDEN***' : 'MISSING');

// Create Sequelize instance with PostgreSQL connection
// TEMPORARY: Direct connection values to bypass env var issues
const sequelize = new Sequelize({
  database: 'helpqo_dev',
  username: 'helpqo_user',     // Direct value - matches Docker container
  password: 'helpqo123',       // Direct value - matches Docker container
  host: 'localhost',
  port: 5432,
  dialect: 'postgres',
  
  // Logging configuration
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  
  // Connection pool settings for performance
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  
  // Additional PostgreSQL options
  dialectOptions: {
    charset: 'utf8',
    connectTimeout: 60000
  },
  
  // Timezone configuration
  timezone: '+08:00'
});

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    return false;
  }
};

// Sync database (create tables if they don't exist)
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    await sequelize.sync({ force });
    console.log('✅ Database synchronized successfully');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
};

export default sequelize;