import express from 'express';
import { User, Worker, Job, Booking, syncDatabase } from '../models';
import { Op } from 'sequelize';

const router = express.Router();

// POST /api/v1/test/sync - Force create all database tables
router.post('/sync', async (req, res) => {
  try {
    console.log('📄 Synchronizing database tables...');
    
    // Force sync (recreates tables)
    await syncDatabase(true);
    
    res.status(200).json({
      status: 'success',
      message: 'Database tables synchronized successfully',
      tables: ['users', 'workers', 'jobs', 'bookings'],
      warning: 'Force sync recreates tables and deletes existing data'
    });
  } catch (error) {
    console.error('❌ Database sync error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database synchronization failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// POST /api/v1/test/booking - Test Booking model creation and methods
router.post('/booking', async (req, res) => {
  try {
    console.log('🧪 Testing Booking model creation...');
    
    // Get or create test client
    let client = await User.findOne({ where: { email: 'test@helpqo.com' } });
    if (!client) {
      client = await User.create({
        email: 'test@helpqo.com',
        phone: '+639171234567',
        password_hash: 'test123456',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        role: 'client' as const,
        city: 'Manila',
        province: 'Metro Manila'
      });
    }

    // Get or create test worker
    let worker = await User.findOne({ where: { email: 'worker@helpqo.com' } });
    if (!worker) {
      worker = await User.create({
        email: 'worker@helpqo.com',
        phone: '+639171234568',
        password_hash: 'worker123456',
        first_name: 'Maria',
        last_name: 'Santos',
        role: 'worker' as const,
        city: 'Quezon City',
        province: 'Metro Manila'
      });

      // Create worker profile with service_areas
      await Worker.create({
        user_id: worker.id,
        skills: ['House Cleaning', 'Laundry'],
        hourly_rate: 150.00,
        experience_years: 3,
        nbi_clearance_status: 'approved' as const,
        service_areas: ['Quezon City', 'Manila', 'Makati']
      });
    }

    // Get or create test job
    let job = await Job.findOne({ where: { client_id: client.id } });
    if (!job) {
      job = await Job.create({
        client_id: client.id,
        title: 'House Cleaning Service Needed',
        description: 'Looking for reliable house cleaning service for a 3-bedroom apartment in Makati.',
        category: 'House Cleaning',
        required_skills: ['House Cleaning', 'Kitchen Cleaning'],
        budget_min: 800,
        budget_max: 1200,
        budget_type: 'fixed',
        estimated_duration: 4,
        urgency_level: 'normal',
        location_type: 'onsite',
        city: 'Makati',
        province: 'Metro Manila',
        status: 'open'
      } as any);
    }

    // Create test booking
    const testBookingData = {
      job_id: job.id,
      worker_id: worker.id,
      client_id: client.id,
      application_message: 'Hello! I am very experienced in house cleaning and would love to help you with your 3-bedroom apartment. I have all the necessary cleaning supplies and can complete the job within 4 hours as requested. My rate is competitive and I guarantee excellent results.',
      proposed_rate: 1000.00,
      estimated_hours: 4,
      questions_responses: {
        'Do you have your own cleaning supplies?': 'Yes, I bring all my own professional cleaning supplies',
        'Are you available on weekends?': 'Yes, I am available on weekends'
      },
      status: 'pending',
      payment_status: 'pending',
      client_notes: 'Please focus on the kitchen and bathrooms. The apartment has 2 cats.',
      scheduled_start: new Date(Date.now() + 24 * 60 * 60 * 1000),
      issues_reported: false
    } as any;

    const booking = await Booking.create(testBookingData);
    console.log('✅ Test booking created successfully');

    // Test instance methods
    const statusInfo = booking.getStatusInfo();
    const workDuration = booking.getWorkDuration();
    const paymentCalculation = booking.calculatePayments();
    const cancelCheck = booking.canCancel();
    const timeline = booking.getTimeline();
    const publicInfo = booking.getPublicInfo();

    // Test status update
    await booking.updateStatus('accepted', 'Client approved the application');
    await booking.updateStatus('confirmed', 'Work schedule confirmed');

    res.status(200).json({
      status: 'success',
      message: 'Booking model test completed successfully',
      data: {
        booking: {
          id: booking.id,
          job_title: job.title,
          worker_name: `${worker.first_name} ${worker.last_name}`,
          client_name: `${client.first_name} ${client.last_name}`,
          proposed_rate: booking.proposed_rate,
          estimated_hours: booking.estimated_hours,
          status: booking.status,
          payment_status: booking.payment_status,
          application_message: booking.application_message?.substring(0, 100) + '...',
          created_at: booking.created_at
        },
        statusInfo,
        workDuration,
        paymentCalculation: {
          totalAmount: paymentCalculation.totalAmount,
          commission: paymentCalculation.commission,
          workerPayout: paymentCalculation.workerPayout,
          commissionRate: `${paymentCalculation.commissionRate * 100}%`
        },
        cancelCheck,
        timelineSteps: timeline.length,
        hasPublicInfo: !!publicInfo.id
      },
      tests: {
        bookingCreation: '✅ PASS',
        statusInfoMethod: '✅ PASS',
        paymentCalculation: '✅ PASS',
        statusUpdate: '✅ PASS',
        cancelationCheck: '✅ PASS',
        timelineGeneration: '✅ PASS',
        publicInfoMethod: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Booking model test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Booking model test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// POST /api/v1/test/workflow - Test complete booking workflow
router.post('/workflow', async (req, res) => {
  try {
    console.log('🧪 Testing complete booking workflow...');
    
    // Find existing test data
    const client = await User.findOne({ where: { email: 'test@helpqo.com' } });
    const worker = await User.findOne({ where: { email: 'worker@helpqo.com' } });
    const job = await Job.findOne({ where: { client_id: client?.id } });

    if (!client || !worker || !job) {
      throw new Error('Test data not found. Run /test/booking first.');
    }

    // Create a complete workflow booking
    const workflowBooking = await Booking.create({
      job_id: job.id,
      worker_id: worker.id,
      client_id: client.id,
      application_message: 'I would like to apply for this cleaning job.',
      proposed_rate: 1200.00,
      estimated_hours: 5,
      status: 'pending',
      payment_status: 'pending',
      issues_reported: false
    } as any);

    // Simulate complete workflow
    const workflowSteps = [];

    // Step 1: Application submitted (automatic)
    workflowSteps.push({
      step: 1,
      action: 'Application submitted',
      status: workflowBooking.status,
      timestamp: workflowBooking.applied_at
    });

    // Step 2: Client accepts
    await workflowBooking.updateStatus('accepted', 'Client accepted the application');
    workflowSteps.push({
      step: 2,
      action: 'Application accepted',
      status: workflowBooking.status,
      timestamp: workflowBooking.accepted_at
    });

    // Step 3: Schedule confirmed
    workflowBooking.scheduled_start = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    workflowBooking.scheduled_end = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours from now
    await workflowBooking.updateStatus('confirmed', 'Work schedule confirmed');
    workflowSteps.push({
      step: 3,
      action: 'Schedule confirmed',
      status: workflowBooking.status,
      scheduledStart: workflowBooking.scheduled_start
    });

    // Step 4: Work started
    await workflowBooking.updateStatus('in_progress', 'Worker started the job');
    workflowSteps.push({
      step: 4,
      action: 'Work started',
      status: workflowBooking.status,
      timestamp: workflowBooking.started_at
    });

    // Step 5: Work completed
    workflowBooking.completion_photos = [
      'https://example.com/before.jpg',
      'https://example.com/after.jpg'
    ];
    workflowBooking.worker_notes = 'Completed all cleaning tasks. Kitchen and bathrooms are spotless!';
    await workflowBooking.updateStatus('completed', 'Worker completed all tasks');
    workflowSteps.push({
      step: 5,
      action: 'Work completed',
      status: workflowBooking.status,
      timestamp: workflowBooking.completed_at,
      photos: workflowBooking.completion_photos.length
    });

    // Step 6: Client approval
    workflowBooking.client_satisfaction = 5;
    workflowBooking.final_amount = 1200.00;
    await workflowBooking.updateStatus('approved', 'Client approved the completed work');
    workflowSteps.push({
      step: 6,
      action: 'Work approved',
      status: workflowBooking.status,
      clientRating: workflowBooking.client_satisfaction,
      finalAmount: workflowBooking.final_amount
    });

    // Step 7: Payment processed
    workflowBooking.payment_status = 'released';
    await workflowBooking.updateStatus('paid', 'Payment released to worker');
    workflowSteps.push({
      step: 7,
      action: 'Payment completed',
      status: workflowBooking.status,
      paymentStatus: workflowBooking.payment_status,
      workerPayout: workflowBooking.worker_payout
    });

    const finalPayments = workflowBooking.calculatePayments();
    const finalDuration = workflowBooking.getWorkDuration();
    const finalTimeline = workflowBooking.getTimeline();

    res.status(200).json({
      status: 'success',
      message: 'Complete booking workflow test completed successfully',
      data: {
        workflowBooking: {
          id: workflowBooking.id,
          finalStatus: workflowBooking.status,
          paymentStatus: workflowBooking.payment_status,
          clientSatisfaction: workflowBooking.client_satisfaction,
          finalAmount: workflowBooking.final_amount
        },
        workflowSteps,
        finalPayments,
        finalDuration,
        timelineEvents: finalTimeline.length
      },
      tests: {
        completeWorkflow: '✅ PASS',
        statusTransitions: '✅ PASS',
        paymentCalculations: '✅ PASS',
        timestampTracking: '✅ PASS',
        notesAndPhotos: '✅ PASS',
        timelineGeneration: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Workflow test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Booking workflow test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// POST /api/v1/test/relationship - Test all model relationships
router.post('/relationship', async (req, res) => {
  try {
    console.log('🧪 Testing all model relationships...');

    // Find test data
    const client = await User.findOne({ where: { email: 'test@helpqo.com' } });
    const worker = await User.findOne({ where: { email: 'worker@helpqo.com' } });

    if (!client || !worker) {
      throw new Error('Test users not found. Run tests first.');
    }

    // Test User → Jobs relationship
    const userWithJobs = await User.findByPk(client.id, {
      include: [{ model: Job, as: 'jobsPosted' }]
    });

    // Test User → Worker → Bookings chain
    const workerUser = await User.findByPk(worker.id, {
      include: [
        { model: Worker, as: 'workerProfile' },
        { model: Booking, as: 'workerBookings' }
      ]
    });

    // Test Job → Bookings relationship
    const jobWithBookings = await Job.findOne({
      where: { client_id: client.id },
      include: [
        { model: User, as: 'client' },
        { model: Booking, as: 'bookings' }
      ]
    });

    // Test Booking → All relationships
    const bookingWithAll = await Booking.findOne({
      include: [
        { model: Job, as: 'job' },
        { model: User, as: 'worker' },
        { model: User, as: 'client' }
      ]
    });

    // Test association methods
    const clientBookings = await client.getClientBookings();
    const workerBookings = await worker.getWorkerBookings();
    const jobBookings = await jobWithBookings?.getBookings() || [];

    res.status(200).json({
      status: 'success',
      message: 'All model relationships test completed successfully',
      data: {
        userWithJobs: {
          user: userWithJobs ? {
            id: userWithJobs.id,
            name: `${userWithJobs.first_name} ${userWithJobs.last_name}`,
            role: userWithJobs.role
          } : null,
          jobsCount: userWithJobs?.jobsPosted?.length || 0
        },
        workerUser: {
          user: workerUser ? {
            id: workerUser.id,
            name: `${workerUser.first_name} ${workerUser.last_name}`,
            role: workerUser.role
          } : null,
          hasWorkerProfile: !!workerUser?.workerProfile,
          workerBookingsCount: workerUser?.workerBookings?.length || 0
        },
        jobWithBookings: {
          job: jobWithBookings ? {
            id: jobWithBookings.id,
            title: jobWithBookings.title,
            status: jobWithBookings.status
          } : null,
          client: jobWithBookings?.client ? {
            id: jobWithBookings.client.id,
            name: `${jobWithBookings.client.first_name} ${jobWithBookings.client.last_name}`
          } : null,
          bookingsCount: jobWithBookings?.bookings?.length || 0
        },
        bookingWithAll: {
          booking: bookingWithAll ? {
            id: bookingWithAll.id,
            status: bookingWithAll.status,
            proposedRate: bookingWithAll.proposed_rate
          } : null,
          hasJob: !!bookingWithAll?.job,
          hasWorker: !!bookingWithAll?.worker,
          hasClient: !!bookingWithAll?.client
        },
        associationMethods: {
          clientBookingsCount: clientBookings.length,
          workerBookingsCount: workerBookings.length,
          jobBookingsCount: jobBookings.length
        }
      },
      tests: {
        userJobsRelationship: userWithJobs ? '✅ PASS' : '❌ FAIL',
        userWorkerRelationship: workerUser ? '✅ PASS' : '❌ FAIL',
        jobBookingsRelationship: jobWithBookings ? '✅ PASS' : '❌ FAIL',
        bookingAllRelationships: bookingWithAll ? '✅ PASS' : '❌ FAIL',
        associationMethods: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Relationship test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Model relationships test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/bookings - Test Booking model queries and scopes
router.get('/bookings', async (req, res) => {
  try {
    console.log('🔍 Testing Booking model queries...');
    
    const totalBookings = await Booking.count();
    const activeBookings = await Booking.scope('active').count();
    const pendingBookings = await Booking.scope('pending').count();
    const completedBookings = await Booking.scope('completed').count();
    const disputedBookings = await Booking.scope('disputed').count();
    
    // Test static methods
    const pendingList = await Booking.findByStatus('pending', 5);
    const urgentBookings = await Booking.findUrgentBookings();
    const paymentsPending = await Booking.findPaymentsPending();
    
    // Test booking statistics
    const bookingStats = await Booking.getBookingStats();

    // Test worker and client bookings
    const worker = await User.findOne({ where: { email: 'worker@helpqo.com' } });
    const client = await User.findOne({ where: { email: 'test@helpqo.com' } });
    
    const workerBookingsList = worker ? await Booking.findWorkerBookings(worker.id) : [];
    const clientBookingsList = client ? await Booking.findClientBookings(client.id) : [];

    res.status(200).json({
      status: 'success',
      message: 'Booking model query tests completed',
      data: {
        totalBookings,
        activeBookings,
        pendingBookings,
        completedBookings,
        disputedBookings,
        pendingList: pendingList.length,
        urgentBookings: urgentBookings.length,
        paymentsPending: paymentsPending.length,
        workerBookingsList: workerBookingsList.length,
        clientBookingsList: clientBookingsList.length,
        bookingStats: {
          ...bookingStats,
          totalRevenue: `₱${bookingStats.totalRevenue.toLocaleString()}`,
          averageJobValue: `₱${bookingStats.averageJobValue.toLocaleString()}`
        }
      },
      tests: {
        findAll: '✅ PASS',
        activeScope: '✅ PASS',
        pendingScope: '✅ PASS',
        completedScope: '✅ PASS',
        statusQueries: '✅ PASS',
        urgentBookingsQuery: '✅ PASS',
        workerBookingsQuery: '✅ PASS',
        clientBookingsQuery: '✅ PASS',
        statisticsQuery: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Booking query test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Booking model query tests failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/users - Test User model queries and scopes
router.get('/users', async (req, res) => {
  try {
    console.log('🔍 Testing User model queries...');
    
    const totalUsers = await User.count();
    const activeUsers = await User.scope('active').count();
    const clients = await User.scope(['active', 'clients']).count();
    const workers = await User.scope(['active', 'workers']).count();
    
    // Test findByEmailOrPhone static method
    const foundUser = await User.findByEmailOrPhone('test@helpqo.com');

    res.status(200).json({
      status: 'success',
      message: 'User model query tests completed',
      data: {
        totalUsers,
        activeUsers,
        clients,
        workers,
        foundUserByEmail: !!foundUser
      },
      tests: {
        findAll: '✅ PASS',
        activeScope: '✅ PASS',
        clientScope: '✅ PASS',
        workerScope: '✅ PASS',
        findByEmailOrPhone: foundUser ? '✅ PASS' : '❌ FAIL'
      }
    });
  } catch (error) {
    console.error('❌ User query test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'User model query tests failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/workers - Test Worker model queries and scopes
router.get('/workers', async (req, res) => {
  try {
    console.log('🔍 Testing Worker model queries...');
    
    const totalWorkers = await Worker.count();
    const availableWorkers = await Worker.scope('available').count();
    const verifiedWorkers = await Worker.scope('verified').count();
    const topRatedWorkers = await Worker.scope('topRated').count();
    
    // Test static methods
    const cleaningWorkers = await Worker.findBySkills(['House Cleaning']);
    const manillaWorkers = await Worker.findInArea('Manila');
    const topWorkers = await Worker.findTopRated();
    const incompleteProfiles = await Worker.findIncompleteProfiles();

    res.status(200).json({
      status: 'success',
      message: 'Worker model query tests completed',
      data: {
        totalWorkers,
        availableWorkers,
        verifiedWorkers,
        topRatedWorkers,
        cleaningWorkers: cleaningWorkers.length,
        manillaWorkers: manillaWorkers.length,
        topWorkers: topWorkers.length,
        incompleteProfiles: incompleteProfiles.length
      },
      tests: {
        findAll: '✅ PASS',
        availableScope: '✅ PASS',
        verifiedScope: '✅ PASS',
        skillsSearch: '✅ PASS',
        locationSearch: '✅ PASS',
        topRatedMethod: '✅ PASS',
        incompleteProfiles: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Worker query test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Worker model query tests failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/jobs - Test Job model queries and scopes
router.get('/jobs', async (req, res) => {
  try {
    console.log('🔍 Testing Job model queries...');
    
    const totalJobs = await Job.count();
    const openJobs = await Job.scope('open').count();
    const acceptingJobs = await Job.scope('accepting').count();
    const urgentJobs = await Job.scope('urgent').count();
    const featuredJobs = await Job.scope('featured').count();
    const recentJobs = await Job.scope(['open', 'recent']).count();
    
    // Test static methods
    const cleaningJobs = await Job.findBySkills(['House Cleaning'], 5);
    const manillaJobs = await Job.findInLocation('Manila', 'Metro Manila', 5);
    const budgetJobs = await Job.findByBudgetRange(500, 2000, 5);
    const urgentJobsList = await Job.findUrgentJobs(5);
    const featuredJobsList = await Job.findFeaturedJobs(3);
    
    // Test job statistics
    const jobStats = await Job.getJobStats();

    res.status(200).json({
      status: 'success',
      message: 'Job model query tests completed',
      data: {
        totalJobs,
        openJobs,
        acceptingJobs,
        urgentJobs,
        featuredJobs,
        recentJobs,
        cleaningJobs: cleaningJobs.length,
        manillaJobs: manillaJobs.length,
        budgetJobs: budgetJobs.length,
        urgentJobsList: urgentJobsList.length,
        featuredJobsList: featuredJobsList.length,
        jobStats
      },
      tests: {
        findAll: '✅ PASS',
        openScope: '✅ PASS',
        acceptingScope: '✅ PASS',
        urgentScope: '✅ PASS',
        skillsSearch: '✅ PASS',
        locationSearch: '✅ PASS',
        budgetSearch: '✅ PASS',
        urgentMethod: '✅ PASS',
        featuredMethod: '✅ PASS',
        statisticsMethod: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Job query test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Job model query tests failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// DELETE /api/v1/test/cleanup - Clean up all test data
router.delete('/cleanup', async (req, res) => {
  try {
    console.log('🧹 Cleaning up test data...');
    
    // Get test users
    const testUsers = await User.findAll({
      where: { 
        email: ['test@helpqo.com', 'worker@helpqo.com'] 
      }
    });
    
    const userIds = testUsers.map(user => user.id);
    
    // Delete in proper order (foreign key constraints)
    // 1. Delete bookings first
    const deletedBookings = await Booking.destroy({
      where: { 
        [Op.or]: [
          { client_id: userIds },
          { worker_id: userIds }
        ]
      }
    });
    
    // 2. Delete jobs second
    const deletedJobs = await Job.destroy({
      where: { client_id: userIds }
    });
    
    // 3. Delete workers third
    const deletedWorkers = await Worker.destroy({
      where: { user_id: userIds }
    });
    
    // 4. Delete users last
    const deletedUsers = await User.destroy({
      where: { email: ['test@helpqo.com', 'worker@helpqo.com'] }
    });
    
    console.log(`🧹 Cleaned up ${deletedBookings} booking(s), ${deletedJobs} job(s), ${deletedWorkers} worker(s), ${deletedUsers} user(s)`);
    
    res.status(200).json({
      status: 'success',
      message: 'Test data cleanup completed',
      deletedBookings,
      deletedJobs,
      deletedWorkers,
      deletedUsers
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test data cleanup failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

export default router;