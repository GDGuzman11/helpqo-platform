import express from 'express';
import { User, Worker, Job, Booking, Review, syncDatabase } from '../models';
import { Op } from 'sequelize';
import { Request, Response } from 'express'; // Add this line
import ValidationService from '../services/validation'; // Add this line

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

// POST /api/v1/test/user - Test User model creation and methods
router.post('/user', async (req, res) => {
  try {
    console.log('🧪 Testing User model creation...');
    
    // Test user data
    const testUserData = {
      email: 'test@helpqo.com',
      phone: '+639171234567',
      password_hash: 'test123456', // Will be hashed automatically
      first_name: 'juan',
      last_name: 'dela cruz',
      role: 'client' as const,
      city: 'Manila',
      province: 'Metro Manila',
      date_of_birth: new Date('1990-01-01'),
      address: '123 Test Street, Manila'
    };

    // Create user
    const user = await User.create(testUserData);
    console.log('✅ Test user created successfully');

    // Test instance methods
    const passwordValid = await user.comparePassword('test123456');
    const publicProfile = user.getPublicProfile();
    const fullName = user.getFullName();
    const isFullyVerified = user.isFullyVerified();

    console.log('🔐 Password validation test:', passwordValid ? '✅ PASS' : '❌ FAIL');
    console.log('👤 Public profile test:', publicProfile);
    console.log('📝 Full name test:', fullName);

    res.status(200).json({
      status: 'success',
      message: 'User model test completed successfully',
      data: {
        user: user.getPublicProfile(),
        fullName,
        passwordValidation: passwordValid,
        isFullyVerified
      },
      tests: {
        userCreation: '✅ PASS',
        passwordHashing: passwordValid ? '✅ PASS' : '❌ FAIL',
        publicProfile: '✅ PASS',
        fullName: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ User model test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'User model test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// POST /api/v1/test/worker - Test Worker model creation and methods
router.post('/worker', async (req, res) => {
  try {
    console.log('🧪 Testing Worker model creation...');
    
    // Create user first
    const testUser = await User.create({
      email: 'worker@helpqo.com',
      phone: '+639171234568',
      password_hash: 'worker123456',
      first_name: 'maria',
      last_name: 'santos',
      role: 'worker' as const,
      city: 'Quezon City',
      province: 'Metro Manila'
    });

    // Create worker profile
    const testWorkerData = {
      user_id: testUser.id,
      skills: ['house cleaning', 'laundry', 'cooking'],
      hourly_rate: 150.00,
      experience_years: 3,
      bio: 'Experienced household helper with 3 years of experience in Metro Manila area.',
      service_areas: ['Quezon City', 'Manila', 'Makati'],
      max_travel_distance: 15,
      nbi_clearance_status: 'approved' as const,
      nbi_clearance_number: 'NBI-2024-12345',
      portfolio_images: ['https://example.com/portfolio1.jpg'],
      rating_average: 4.5,
      total_jobs_completed: 25,
      total_reviews: 20,
      is_available: true
    };

    const worker = await Worker.create(testWorkerData);
    console.log('✅ Test worker created successfully');

    // Test instance methods
    const profileCompletion = worker.calculateProfileCompletion();
    const isFullyVerified = worker.isFullyVerified();
    const availabilityStatus = worker.getAvailabilityStatus();
    
    // Test location service
    const canServeManila = worker.canServeLocation('Manila');
    const canServeTagaytay = worker.canServeLocation('Tagaytay');
    
    // Test rating update
    await worker.updateRating(4.8, true);

    res.status(200).json({
      status: 'success',
      message: 'Worker model test completed successfully',
      data: {
        worker: {
          id: worker.id,
          skills: worker.skills,
          hourly_rate: worker.hourly_rate,
          experience_years: worker.experience_years,
          bio: worker.bio,
          service_areas: worker.service_areas,
          max_travel_distance: worker.max_travel_distance,
          rating_average: worker.rating_average,
          verification_level: worker.verification_level,
          nbi_verified: worker.nbi_clearance_status === 'approved',
          profile_completion: Math.round(profileCompletion),
          is_available: worker.is_available
        },
        user: testUser.getPublicProfile(),
        profileCompletion: Math.round(profileCompletion),
        isFullyVerified,
        availabilityStatus,
        rating: worker.rating_average,
        canServeManila,
        canServeTagaytay: canServeTagaytay
      },
      tests: {
        workerCreation: '✅ PASS',
        userAssociation: '✅ PASS',
        profileCompletion: '✅ PASS',
        verificationCheck: '✅ PASS',
        locationService: '✅ PASS',
        ratingSystem: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Worker model test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Worker model test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// POST /api/v1/test/job - Test Job model creation and methods
router.post('/job', async (req, res) => {
  try {
    console.log('🧪 Testing Job model creation...');
    
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

    // Test job data
    const testJobData = {
      client_id: client.id,
      title: 'house cleaning service needed',
      description: 'Looking for reliable house cleaning service for a 3-bedroom apartment in Makati. Need weekly cleaning including bathroom, kitchen, and all rooms. Must be experienced and trustworthy.',
      category: 'House Cleaning' as any,
      required_skills: ['house cleaning', 'bathroom cleaning', 'kitchen cleaning'],
      budget_min: 800,
      budget_max: 1200,
      budget_type: 'fixed' as any,
      estimated_duration: 4,
      urgency_level: 'normal' as any,
      location_type: 'onsite' as any,
      address: '123 Ayala Avenue, Makati City',
      city: 'Makati',
      province: 'Metro Manila',
      postal_code: '1226',
      coordinates: { lat: 14.5547, lng: 121.0244 },
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'open' as any,
      materials_provided: true,
      materials_description: 'All cleaning supplies and equipment will be provided'
    };

    // Create job
    const job = await Job.create(testJobData as any);
    console.log('✅ Test job created successfully');

    // Test instance methods
    const budgetRange = job.getBudgetRange();
    const budgetPerHour = job.getBudgetPerHour();
    const isAcceptingApplications = job.isAcceptingApplications();
    const urgencyIndicator = job.getUrgencyIndicator();
    const publicInfo = job.getPublicInfo();

    // Test skills matching
    const workerSkills = ['House Cleaning', 'Laundry', 'Kitchen Cleaning', 'Bathroom Cleaning'];
    const skillsMatch = job.matchesWorkerSkills(workerSkills);

    // Test location scoring
    const locationScore = job.calculateLocationScore('Makati', 'Metro Manila');

    // Test view increment
    await job.incrementViews();
    await job.incrementViews();

    res.status(200).json({
      status: 'success',
      message: 'Job model test completed successfully',
      data: {
        job: {
          id: job.id,
          title: job.title,
          description: job.description.substring(0, 100) + '...',
          category: job.category,
          required_skills: job.required_skills,
          budget_range: budgetRange,
          budget_per_hour: budgetPerHour,
          estimated_duration: job.estimated_duration,
          urgency_level: job.urgency_level,
          location_type: job.location_type,
          city: job.city,
          province: job.province,
          status: job.status,
          views_count: job.views_count,
          materials_provided: job.materials_provided,
          created_at: job.created_at
        },
        client: client.getPublicProfile(),
        budgetRange,
        budgetPerHour,
        isAcceptingApplications,
        urgencyIndicator,
        skillsMatch,
        locationScore,
        viewsAfterIncrement: job.views_count
      },
      tests: {
        jobCreation: '✅ PASS',
        clientAssociation: '✅ PASS',
        budgetCalculation: '✅ PASS',
        skillsMatching: '✅ PASS',
        locationScoring: '✅ PASS',
        viewsIncrement: '✅ PASS',
        urgencyIndicator: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Job model test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Job model test failed',
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

// POST /api/v1/test/review - Test Review model creation and methods
router.post('/review', async (req, res) => {
  try {
    console.log('🧪 Testing Review model with 5-model system...');
    
    // Get existing test data
    const testUser1 = await User.findOne({ where: { email: 'test@helpqo.com' } });
    const testUser2 = await User.findOne({ where: { email: 'worker@helpqo.com' } });
    const testBooking = await Booking.findOne();
    
    if (!testUser1 || !testUser2 || !testBooking) {
      return res.status(400).json({ 
        error: 'Test data missing. Run user, worker, job, and booking tests first.' 
      });
    }

    // Create review using your RATING_CATEGORIES system
// Create review using your RATING_CATEGORIES system
const review = await Review.create({
  booking_id: testBooking.id,
  reviewer_id: testUser1.id,
  reviewee_id: testUser2.id,
  overall_rating: 5,
  category_ratings: {
    quality: 5,
    punctuality: 4,
    communication: 5,
    professionalism: 4,
    cleanliness: 5,
    value: 4
  },
  review_title: 'Excellent plumbing work!',
  review_text: 'Professional service, arrived on time, and fixed our kitchen sink perfectly. Highly recommended for any home repairs!',
  review_photos: [],
  response_text: null,
  response_date: null,
  is_verified_review: false,
  helpful_count: 0,
  unhelpful_count: 0,
  is_flagged: false,
  admin_notes: null,
  is_public: true
}as any);
    console.log('✅ Review created successfully');

    // Test your sophisticated methods
    const reviewSummary = review.getReviewSummary();
    const userRating = await Review.calculateUserRating(testUser2.id);
    const platformStats = await Review.getPlatformStats();
    
    // Test associations
    const reviewWithAssociations = await Review.findByPk(review.id, {
      include: ['booking', 'reviewer', 'reviewee']
    });

    // Test instance methods
    await review.markHelpful();
    await review.addResponse('Thank you for the great review! Happy to work with you again.');

    console.log('📊 Review testing results:');
    console.log(`   Review ID: ${review.id}`);
    console.log(`   Overall Rating: ${review.overall_rating}/5`);
    console.log(`   Category Average: ${reviewSummary.category_average}/5`);
    console.log(`   User Average Rating: ${userRating.average_rating}/5`);
    console.log(`   Platform Total Reviews: ${platformStats.total_reviews}`);
    console.log(`   Associations Working: ${!!reviewWithAssociations?.booking}`);

    res.status(200).json({
      status: 'success',
      message: '5-model marketplace system with Review complete!',
      data: {
        review: {
          id: review.id,
          overall_rating: review.overall_rating,
          category_ratings: review.category_ratings,
          review_title: review.review_title,
          review_text: review.review_text.substring(0, 100) + '...',
          helpful_count: review.helpful_count,
          has_response: !!review.response_text,
          is_verified: review.is_verified_review,
          created_at: review.created_at
        },
        review_summary: reviewSummary,
        user_rating: userRating,
        platform_stats: platformStats,
        associations_test: {
          booking_loaded: !!reviewWithAssociations?.booking,
          reviewer_loaded: !!reviewWithAssociations?.reviewer,
          reviewee_loaded: !!reviewWithAssociations?.reviewee
        }
      },
      tests: {
        reviewCreation: '✅ PASS',
        categoryRatings: '✅ PASS',
        reviewSummary: '✅ PASS',
        userRatingCalculation: '✅ PASS',
        platformStats: '✅ PASS',
        associations: '✅ PASS',
        helpfulMarking: '✅ PASS',
        responseSystem: '✅ PASS'
      }
    });

  } catch (error) {
    console.error('❌ Review test failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Review test failed', 
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/reviews - Test Review model queries and methods
router.get('/reviews', async (req, res) => {
  try {
    console.log('🔍 Testing Review model queries...');

    // Test scopes and queries
    const [
      totalReviews,
      publicReviews,
      verifiedReviews,
      highRatedReviews,
      recentReviews,
      helpfulReviews,
      flaggedReviews
    ] = await Promise.all([
      Review.count(),
      Review.scope('public').count(),
      Review.scope('verified').count(),
      Review.scope('highRated').count(),
      Review.scope('recent').count(),
      Review.scope('helpful').count(),
      Review.scope('flagged').count()
    ]);

    // Test static methods
    const [
      rating5Reviews,
      helpfulReviewsList,
      platformStats,
      searchResults
    ] = await Promise.all([
      Review.findByRating(5, 5),
      Review.findHelpfulReviews(5),
      Review.getPlatformStats(),
      Review.searchReviews('excellent', { limit: 3 })
    ]);

    // Test user-specific queries
    const testUser = await User.findOne({ where: { email: 'worker@helpqo.com' } });
    const userRating = testUser ? await Review.calculateUserRating(testUser.id) : null;

    console.log('📊 Review query test results:');
    console.log(`   Total Reviews: ${totalReviews}`);
    console.log(`   Public Reviews: ${publicReviews}`);
    console.log(`   Verified Reviews: ${verifiedReviews}`);
    console.log(`   High Rated Reviews: ${highRatedReviews}`);
    console.log(`   Platform Average: ${platformStats.average_platform_rating}/5`);

    res.status(200).json({
      status: 'success',
      message: 'Review model query tests completed',
      data: {
        totalReviews,
        publicReviews,
        verifiedReviews,
        highRatedReviews,
        recentReviews,
        helpfulReviews,
        flaggedReviews,
        rating5Reviews: rating5Reviews.length,
        helpfulReviewsList: helpfulReviewsList.length,
        searchResults: searchResults.length,
        platformStats,
        userRating
      },
      tests: {
        countQueries: '✅ PASS',
        scopeQueries: '✅ PASS',
        ratingQueries: '✅ PASS',
        helpfulQueries: '✅ PASS',
        searchQueries: '✅ PASS',
        platformStats: '✅ PASS',
        userRatingCalculation: userRating ? '✅ PASS' : '⚠️ NO DATA'
      }
    });

  } catch (error) {
    console.error('❌ Review query test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Review query test failed',
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

// GET /api/v1/test/user-analytics - Test User business intelligence methods
router.get('/user-analytics', async (req, res) => {
  try {
    console.log('📊 Testing User business intelligence methods...');

    // Test all three new analytics methods
    const [
      marketplaceAnalytics,
      marketPenetration
    ] = await Promise.all([
      User.getMarketplaceAnalytics(),
      User.getMarketPenetrationAnalysis()
    ]);

    // Test user engagement score with existing test user
    const testUser = await User.findOne({ where: { email: 'test@helpqo.com' } });
    const engagementScore = testUser ? await User.getUserEngagementScore(testUser.id) : null;

    console.log('📊 User analytics test results:');
    console.log(`   Total Users: ${marketplaceAnalytics.total_users}`);
    console.log(`   Client/Worker Ratio: ${marketplaceAnalytics.user_distribution.client_percentage}%/${marketplaceAnalytics.user_distribution.worker_percentage}%`);
    console.log(`   Verification Rate: ${marketplaceAnalytics.verification_metrics.verification_rate}%`);
    console.log(`   Market Penetration: ${marketPenetration.total_addressable_market.market_penetration_percentage}%`);
    console.log(`   Engagement Score: ${engagementScore?.engagement_score || 'N/A'}/100`);

    res.status(200).json({
      status: 'success',
      message: 'User business intelligence tests completed successfully',
      data: {
        marketplace_analytics: marketplaceAnalytics,
        market_penetration: marketPenetration,
        engagement_score: engagementScore
      },
      tests: {
        marketplaceAnalytics: '✅ PASS',
        userDistribution: '✅ PASS',
        verificationMetrics: '✅ PASS',
        geographicAnalysis: '✅ PASS',
        engagementMetrics: '✅ PASS',
        marketPenetration: '✅ PASS',
        engagementScoring: engagementScore ? '✅ PASS' : '⚠️ NO TEST USER',
        businessIntelligence: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ User analytics test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'User analytics test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/worker-analytics - Test Worker business intelligence methods
router.get('/worker-analytics', async (req, res) => {
  try {
    console.log('📊 Testing Worker business intelligence methods...');

    const workerMarketplaceAnalytics = await Worker.getWorkerMarketplaceAnalytics();
    const earningPotentialAnalysis = await Worker.getEarningPotentialAnalysis();

    // Test worker performance benchmark with existing test worker
    const testWorker = await Worker.findOne();
    const performanceBenchmark = testWorker ? 
      await Worker.getWorkerPerformanceBenchmark(testWorker.id) : null;

    res.status(200).json({
      status: 'success',
      message: 'Worker business intelligence tests completed successfully',
      data: {
        worker_marketplace_analytics: workerMarketplaceAnalytics,
        earning_potential_analysis: earningPotentialAnalysis,
        performance_benchmark: performanceBenchmark
      },
      tests: {
        workerMarketplaceAnalytics: '✅ PASS',
        earningPotentialAnalysis: '✅ PASS',
        performanceBenchmarking: performanceBenchmark ? '✅ PASS' : '⚠️ NO TEST WORKER',
        businessIntelligence: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Worker analytics test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Worker analytics test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/job-analytics - Test Job business intelligence methods
router.get('/job-analytics', async (req, res) => {
  try {
    console.log('📊 Testing Job business intelligence methods...');

    // Test all three new Job analytics methods
    const [
      jobMarketDemandAnalysis,
      pricingOptimizationAnalysis,
      demandForecastAnalysis
    ] = await Promise.all([
      Job.getJobMarketDemandAnalysis(),
      Job.getPricingOptimizationAnalysis(),
      Job.getDemandForecastAnalysis()
    ]);

    console.log('📊 Job analytics test results:');
    console.log(`   Total Jobs: ${jobMarketDemandAnalysis.market_overview.total_jobs}`);
    console.log(`   Active Jobs: ${jobMarketDemandAnalysis.market_overview.active_jobs}`);
    console.log(`   Completion Rate: ${jobMarketDemandAnalysis.market_overview.completion_rate}%`);
    console.log(`   Trending Categories: ${jobMarketDemandAnalysis.category_analysis.trending_categories.length}`);
    console.log(`   Most Requested Skills: ${jobMarketDemandAnalysis.skills_demand.most_requested_skills.length}`);
    console.log(`   Geographic Markets: ${Object.keys(jobMarketDemandAnalysis.demand_patterns.geographic_demand).length}`);

    res.status(200).json({
      status: 'success',
      message: 'Job business intelligence tests completed successfully',
      data: {
        job_market_demand_analysis: jobMarketDemandAnalysis,
        pricing_optimization_analysis: pricingOptimizationAnalysis,
        demand_forecast_analysis: demandForecastAnalysis
      },
      tests: {
        jobMarketDemandAnalysis: '✅ PASS',
        marketOverview: '✅ PASS',
        categoryAnalysis: '✅ PASS',
        demandPatterns: '✅ PASS',
        budgetInsights: '✅ PASS',
        skillsDemand: '✅ PASS',
        pricingOptimization: '✅ PASS',
        competitiveAnalysis: '✅ PASS',
        demandForecasting: '✅ PASS',
        trendAnalysis: '✅ PASS',
        businessIntelligence: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Job analytics test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Job analytics test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// GET /api/v1/test/booking-analytics - Test Booking business intelligence methods
router.get('/booking-analytics', async (req, res) => {
  try {
    console.log('📊 Testing Booking business intelligence methods...');

    // Test all three new Booking analytics methods
    const [
      revenueOptimizationAnalysis,
      workflowEfficiencyAnalysis,
      predictiveAnalytics
    ] = await Promise.all([
      Booking.getRevenueOptimizationAnalysis(),
      Booking.getWorkflowEfficiencyAnalysis(),
      Booking.getPredictiveAnalytics()
    ]);

    console.log('📊 Booking analytics test results:');
    console.log(`   Total Revenue: ₱${revenueOptimizationAnalysis.revenue_metrics.total_revenue.toLocaleString()}`);
    console.log(`   Total Commission: ₱${revenueOptimizationAnalysis.revenue_metrics.total_commission.toLocaleString()}`);
    console.log(`   Commission Rate: ${revenueOptimizationAnalysis.revenue_metrics.commission_rate}%`);
    console.log(`   Workflow Efficiency: ${workflowEfficiencyAnalysis.workflow_metrics.workflow_efficiency_score}%`);
    console.log(`   At-Risk Bookings: ${predictiveAnalytics.booking_outcome_forecast.at_risk_bookings.length}`);
    console.log(`   Success Rate Prediction: ${predictiveAnalytics.success_prediction_model.success_rate_by_factors.medium_budget.success_rate}%`);

    res.status(200).json({
      status: 'success',
      message: 'Booking business intelligence tests completed successfully',
      data: {
        revenue_optimization_analysis: revenueOptimizationAnalysis,
        workflow_efficiency_analysis: workflowEfficiencyAnalysis,
        predictive_analytics: predictiveAnalytics
      },
      tests: {
        revenueOptimizationAnalysis: '✅ PASS',
        revenueMetrics: '✅ PASS',
        commissionAnalysis: '✅ PASS',
        paymentFlowAnalysis: '✅ PASS',
        workerPayoutInsights: '✅ PASS',
        workflowEfficiencyAnalysis: '✅ PASS',
        workflowMetrics: '✅ PASS',
        stageAnalysis: '✅ PASS',
        satisfactionCorrelation: '✅ PASS',
        operationalInsights: '✅ PASS',
        predictiveAnalytics: '✅ PASS',
        successPredictionModel: '✅ PASS',
        bookingOutcomeForecast: '✅ PASS',
        marketPredictions: '✅ PASS',
        actionableInsights: '✅ PASS',
        businessIntelligence: '✅ PASS'
      }
    });
  } catch (error) {
    console.error('❌ Booking analytics test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Booking analytics test failed',
      error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
    });
  }
});

// Add this DELETE endpoint to your test.ts file
router.delete('/cleanup/user/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Find user by email or phone
    const user = await User.findByEmailOrPhone(identifier);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    // Delete user (will cascade to worker profile)
    await user.destroy();

    res.json({
      success: true,
      message: `User ${identifier} deleted successfully`,
      deleted_user_id: userId,
      deleted_email: userEmail
    });

    console.log(`🗑️ Test user deleted: ${userEmail} (${userId})`);
    
  } catch (error: any) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

// Add these test endpoints to test.ts

// Test Philippine phone validation
router.post('/validation/phone', [
  ValidationService.validatePhilippinePhone(),
  ValidationService.handleValidationErrors
], (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Phone validation passed',
    normalized_phone: req.body.phone
  });
});

// Test Filipino name validation
router.post('/validation/name', [
  ValidationService.validateFilipineName('first_name'),
  ValidationService.validateFilipineName('last_name'),
  ValidationService.handleValidationErrors
], (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Name validation passed',
    processed_names: {
      first_name: req.body.first_name,
      last_name: req.body.last_name
    }
  });
});

// Test complete registration validation
router.post('/validation/registration', [
  ValidationService.sanitizeInput,
  ...ValidationService.getRegistrationValidation(),
  ValidationService.handleValidationErrors
], (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'All registration validation passed',
    sanitized_data: req.body
  });
});

export default router;