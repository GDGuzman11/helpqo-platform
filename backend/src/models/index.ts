import sequelize from '../config/database';
import User from './User';
import Worker from './Worker';
import Job from './Job';
import Booking from './Booking';

// Import future models here as we create them
// import Review from './Review';

// Define model associations/relationships
const defineAssociations = () => {
  console.log('🔗 Defining model associations...');
  
  // User ↔ Worker Relationship (One-to-One)
  User.hasOne(Worker, { 
    foreignKey: 'user_id', 
    as: 'workerProfile',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  
  Worker.belongsTo(User, { 
    foreignKey: 'user_id', 
    as: 'user',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  console.log('✅ User ↔ Worker associations defined');
  
  // User → Jobs Relationships (One-to-Many)
  User.hasMany(Job, { 
    foreignKey: 'client_id', 
    as: 'jobsPosted',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  
  Job.belongsTo(User, { 
    foreignKey: 'client_id', 
    as: 'client',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  console.log('✅ User → Jobs associations defined');

  // Job → Bookings Relationships (One-to-Many)
  Job.hasMany(Booking, {
    foreignKey: 'job_id',
    as: 'bookings',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  Booking.belongsTo(Job, {
    foreignKey: 'job_id',
    as: 'job',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  console.log('✅ Job → Bookings associations defined');

  // User → Bookings Relationships (Multiple relationships)
  // Worker bookings (user as worker)
  User.hasMany(Booking, {
    foreignKey: 'worker_id',
    as: 'workerBookings',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  Booking.belongsTo(User, {
    foreignKey: 'worker_id',
    as: 'worker',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Client bookings (user as client)
  User.hasMany(Booking, {
    foreignKey: 'client_id',
    as: 'clientBookings',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  Booking.belongsTo(User, {
    foreignKey: 'client_id',
    as: 'client',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  console.log('✅ User ↔ Bookings associations defined');
  
  console.log('📄 Future associations ready for Review model');
};

// Initialize all model associations
defineAssociations();

// Test association methods (development only)
if (process.env.NODE_ENV === 'development') {
  console.log('🧪 Association methods available:');
  console.log('   User.findAll({ include: "workerProfile" })');
  console.log('   User.findAll({ include: "jobsPosted" })');
  console.log('   User.findAll({ include: ["workerBookings", "clientBookings"] })');
  console.log('   Worker.findAll({ include: "user" })');
  console.log('   Job.findAll({ include: ["client", "bookings"] })');
  console.log('   Booking.findAll({ include: ["job", "worker", "client"] })');
  console.log('   user.createWorkerProfile(workerData)');
  console.log('   user.createJob(jobData)');
  console.log('   user.getJobsPosted()');
  console.log('   user.getWorkerBookings()');
  console.log('   user.getClientBookings()');
  console.log('   job.getBookings()');
  console.log('   job.getClient()');
  console.log('   booking.getJob()');
  console.log('   booking.getWorker()');
  console.log('   booking.getClient()');
  console.log('   worker.getUser()');
}

// Sync database function
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    console.log('📄 Synchronizing database tables...');
    await sequelize.sync({ force });
    console.log('✅ Database synchronization completed');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
};

// Export database instance and all models
export {
  sequelize,
  User,
  Worker,
  Job,
  Booking,
  // Review,
};

// Export default object with all models
export default {
  sequelize,
  User,
  Worker,
  Job,
  Booking,
  // Review,
};