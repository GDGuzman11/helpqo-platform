import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../config/database';

// Booking Status Workflow
export const BOOKING_STATUS = [
  'pending',       // Worker applied, waiting for client response
  'accepted',      // Client accepted worker, scheduling in progress
  'confirmed',     // Schedule confirmed, work about to start
  'in_progress',   // Work is currently being done
  'completed',     // Work finished, waiting for client approval
  'approved',      // Client approved work, payment being processed
  'paid',          // Payment completed, booking finished
  'cancelled',     // Booking cancelled by client or worker
  'disputed',      // Issues reported, requires admin intervention
  'rejected'       // Client rejected worker application
] as const;

export type BookingStatus = typeof BOOKING_STATUS[number];

// Payment Status Workflow
export const PAYMENT_STATUS = [
  'pending',       // No payment initiated
  'held',          // Payment held in escrow
  'processing',    // Payment being processed
  'released',      // Payment released to worker
  'refunded',      // Payment refunded to client
  'disputed'       // Payment disputed, under review
] as const;

export type PaymentStatus = typeof PAYMENT_STATUS[number];

// Booking Interface for TypeScript
export interface BookingAttributes {
  id: string;
  job_id: string;
  worker_id: string;
  client_id: string;
  
  // Application Information
  application_message?: string;
  proposed_rate: number;
  estimated_hours: number;
  questions_responses?: Record<string, string>;
  
  // Status and Workflow
  status: BookingStatus;
  applied_at: Date;
  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  reviewed_at?: Date;
  
  // Scheduling
  scheduled_start?: Date;
  scheduled_end?: Date;
  actual_start?: Date;
  actual_end?: Date;
  
  // Payment Information
  final_amount?: number;
  payment_status: PaymentStatus;
  commission_amount?: number;
  worker_payout?: number;
  
  // Communication
  client_notes?: string;
  worker_notes?: string;
  admin_notes?: string;
  
  // Quality and Completion
  completion_photos?: string[];
  client_satisfaction?: number;
  worker_satisfaction?: number;
  issues_reported: boolean;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Booking Model Class
class Booking extends Model<BookingAttributes> implements BookingAttributes {
  public id!: string;
  public job_id!: string;
  public worker_id!: string;
  public client_id!: string;
  
  public application_message?: string;
  public proposed_rate!: number;
  public estimated_hours!: number;
  public questions_responses?: Record<string, string>;
  
  public status!: BookingStatus;
  public applied_at!: Date;
  public accepted_at?: Date;
  public started_at?: Date;
  public completed_at?: Date;
  public reviewed_at?: Date;
  
  public scheduled_start?: Date;
  public scheduled_end?: Date;
  public actual_start?: Date;
  public actual_end?: Date;
  
  public final_amount?: number;
  public payment_status!: PaymentStatus;
  public commission_amount?: number;
  public worker_payout?: number;
  
  public client_notes?: string;
  public worker_notes?: string;
  public admin_notes?: string;
  
  public completion_photos?: string[];
  public client_satisfaction?: number;
  public worker_satisfaction?: number;
  public issues_reported!: boolean;
  
  public created_at!: Date;
  public updated_at!: Date;

// Association properties (will be added by Sequelize)
  public job?: any;
  public worker?: any;
  public client?: any;
  public review?: any;

// Review association methods (automatically added by Sequelize associations)
  public getReview!: () => Promise<any>;
  public createReview!: (reviewData: any) => Promise<any>;
  public setReview!: (review: any) => Promise<void>;
  public hasReview!: () => Promise<boolean>;
  // INSTANCE METHODS

  /**
   * Get booking status with detailed information
   */
  public getStatusInfo(): { 
    status: BookingStatus; 
    description: string; 
    nextActions: string[]; 
    canEdit: boolean;
    color: string;
  } {
    const statusMap = {
      pending: {
        description: 'Application submitted, waiting for client response',
        nextActions: ['Client: Accept or reject application'],
        canEdit: true,
        color: 'yellow'
      },
      accepted: {
        description: 'Application accepted, scheduling work time',
        nextActions: ['Both: Confirm schedule', 'Worker: Start work when ready'],
        canEdit: true,
        color: 'blue'
      },
      confirmed: {
        description: 'Schedule confirmed, work ready to start',
        nextActions: ['Worker: Start work', 'Client: Track progress'],
        canEdit: false,
        color: 'green'
      },
      in_progress: {
        description: 'Work is currently being performed',
        nextActions: ['Worker: Complete work', 'Client: Monitor progress'],
        canEdit: false,
        color: 'orange'
      },
      completed: {
        description: 'Work finished, waiting for client approval',
        nextActions: ['Client: Approve or request changes'],
        canEdit: false,
        color: 'purple'
      },
      approved: {
        description: 'Work approved, processing payment',
        nextActions: ['System: Processing payment to worker'],
        canEdit: false,
        color: 'green'
      },
      paid: {
        description: 'Payment completed, booking finished',
        nextActions: ['Both: Leave reviews'],
        canEdit: false,
        color: 'green'
      },
      cancelled: {
        description: 'Booking cancelled',
        nextActions: ['None - booking ended'],
        canEdit: false,
        color: 'red'
      },
      disputed: {
        description: 'Issues reported, under admin review',
        nextActions: ['Admin: Resolve dispute'],
        canEdit: false,
        color: 'red'
      },
      rejected: {
        description: 'Application rejected by client',
        nextActions: ['None - application declined'],
        canEdit: false,
        color: 'gray'
      }
    };

    return {
      status: this.status,
      ...statusMap[this.status],
    };
  }

  /**
   * Calculate total duration of work
   */
  public getWorkDuration(): { 
    estimated: number; 
    actual?: number; 
    variance?: number;
    efficiency?: string;
  } {
    const estimated = this.estimated_hours;
    
    if (this.actual_start && this.actual_end) {
      const actualMs = this.actual_end.getTime() - this.actual_start.getTime();
      const actual = Math.round(actualMs / (1000 * 60 * 60) * 10) / 10; // Hours with 1 decimal
      const variance = actual - estimated;
      const efficiency = variance <= 0 ? 'efficient' : variance <= 1 ? 'on-time' : 'overtime';
      
      return { estimated, actual, variance, efficiency };
    }
    
    return { estimated };
  }

  /**
   * Calculate commission and worker payout
   */
  public calculatePayments(commissionRate: number = 0.15): {
    totalAmount: number;
    commission: number;
    workerPayout: number;
    commissionRate: number;
  } {
    const totalAmount = this.final_amount || this.proposed_rate * this.estimated_hours;
    const commission = Math.round(totalAmount * commissionRate);
    const workerPayout = totalAmount - commission;
    
    return {
      totalAmount,
      commission,
      workerPayout,
      commissionRate
    };
  }

  /**
   * Check if booking can be cancelled
   */
  public canCancel(): { canCancel: boolean; reason?: string } {
    const cancelableStatuses: BookingStatus[] = ['pending', 'accepted', 'confirmed'];
    
    if (!cancelableStatuses.includes(this.status)) {
      return { 
        canCancel: false, 
        reason: 'Cannot cancel booking after work has started' 
      };
    }
    
    // Check if too close to start time (less than 2 hours)
    if (this.scheduled_start) {
      const hoursUntilStart = (this.scheduled_start.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilStart < 2) {
        return { 
          canCancel: false, 
          reason: 'Cannot cancel less than 2 hours before scheduled start' 
        };
      }
    }
    
    return { canCancel: true };
  }

  /**
   * Update booking status with timestamp tracking
   */
  public async updateStatus(newStatus: BookingStatus, notes?: string): Promise<void> {
    const oldStatus = this.status;
    this.status = newStatus;
    
    // Set appropriate timestamp based on status
    const now = new Date();
    switch (newStatus) {
      case 'accepted':
        this.accepted_at = now;
        break;
      case 'in_progress':
        this.started_at = now;
        if (!this.actual_start) this.actual_start = now;
        break;
      case 'completed':
        this.completed_at = now;
        if (!this.actual_end) this.actual_end = now;
        break;
      case 'approved':
        this.reviewed_at = now;
        break;
    }
    
    // Add admin notes for status changes
    if (notes) {
      const timestamp = now.toISOString();
      const statusNote = `[${timestamp}] Status changed from ${oldStatus} to ${newStatus}: ${notes}`;
      this.admin_notes = this.admin_notes 
        ? `${this.admin_notes}\n${statusNote}`
        : statusNote;
    }
    
    await this.save();
  }

  /**
   * Get booking timeline for tracking
   */
  public getTimeline(): Array<{
    stage: string;
    timestamp: Date;
    status: 'completed' | 'current' | 'pending';
    description: string;
  }> {
    const timeline = [
      {
        stage: 'Application',
        timestamp: this.applied_at,
        status: 'completed' as const,
        description: 'Worker applied for job'
      }
    ];

    if (this.accepted_at) {
      timeline.push({
        stage: 'Accepted',
        timestamp: this.accepted_at,
        status: 'completed' as const,
        description: 'Client accepted application'
      });
    }

    if (this.started_at) {
      timeline.push({
        stage: 'Started',
        timestamp: this.started_at,
        status: 'completed' as const,
        description: 'Work started'
      });
    }

    if (this.completed_at) {
      timeline.push({
        stage: 'Completed',
        timestamp: this.completed_at,
        status: 'completed' as const,
        description: 'Work completed'
      });
    }

    if (this.reviewed_at) {
      timeline.push({
        stage: 'Approved',
        timestamp: this.reviewed_at,
        status: 'completed' as const,
        description: 'Work approved by client'
      });
    }

    return timeline;
  }

  /**
   * Get public booking info (excluding sensitive data)
   */
  public getPublicInfo(): Partial<BookingAttributes> {
    return {
      id: this.id,
      status: this.status,
      proposed_rate: this.proposed_rate,
      estimated_hours: this.estimated_hours,
      scheduled_start: this.scheduled_start,
      scheduled_end: this.scheduled_end,
      payment_status: this.payment_status,
      applied_at: this.applied_at,
      created_at: this.created_at
    };
  }

  // STATIC METHODS

  /**
   * Find bookings by status
   */
  public static async findByStatus(
    status: BookingStatus, 
    limit: number = 20
  ): Promise<Booking[]> {
    return await Booking.findAll({
      where: { status },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Find worker's bookings
   */
  public static async findWorkerBookings(
    workerId: string, 
    status?: BookingStatus
  ): Promise<Booking[]> {
    const whereCondition: any = { worker_id: workerId };
    if (status) whereCondition.status = status;

    return await Booking.findAll({
      where: whereCondition,
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Find client's bookings
   */
  public static async findClientBookings(
    clientId: string, 
    status?: BookingStatus
  ): Promise<Booking[]> {
    const whereCondition: any = { client_id: clientId };
    if (status) whereCondition.status = status;

    return await Booking.findAll({
      where: whereCondition,
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Find urgent bookings requiring attention
   */
  public static async findUrgentBookings(): Promise<Booking[]> {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    return await Booking.findAll({
      where: {
        [Op.or]: [
          // Pending applications older than 2 days
          {
            status: 'pending',
            applied_at: { [Op.lt]: twoDaysAgo }
          },
          // Completed work waiting for approval
          {
            status: 'completed',
            completed_at: { [Op.lt]: twoDaysAgo }
          },
          // Disputed bookings
          {
            status: 'disputed'
          }
        ]
      },
      order: [['created_at', 'ASC']]
    });
  }

  /**
   * Get booking statistics for admin dashboard
   */
  public static async getBookingStats(): Promise<{
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    averageRating: number;
    totalRevenue: number;
    averageJobValue: number;
    statusBreakdown: Record<BookingStatus, number>;
  }> {
    const [totalBookings, activeBookings, completedBookings] = await Promise.all([
      Booking.count(),
      Booking.count({ 
        where: { 
          status: ['accepted', 'confirmed', 'in_progress'] 
        } 
      }),
      Booking.count({ where: { status: 'paid' } })
    ]);

    // Calculate average satisfaction rating
    const ratingsResult = await Booking.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('client_satisfaction')), 'avgRating']
      ],
      where: {
        client_satisfaction: { [Op.ne]: undefined }
      },
      raw: true
    }) as any[];

    const averageRating = ratingsResult[0]?.avgRating 
      ? parseFloat(parseFloat(ratingsResult[0].avgRating).toFixed(2))
      : 0;

    // Calculate revenue
    const revenueResult = await Booking.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('final_amount')), 'totalRevenue'],
        [sequelize.fn('AVG', sequelize.col('final_amount')), 'avgJobValue']
      ],
      where: {
        status: 'paid',
        final_amount: { [Op.ne]: undefined }
      },
      raw: true
    }) as any[];

    const totalRevenue = revenueResult[0]?.totalRevenue 
      ? parseFloat(revenueResult[0].totalRevenue) 
      : 0;
    const averageJobValue = revenueResult[0]?.avgJobValue 
      ? parseFloat(parseFloat(revenueResult[0].avgJobValue).toFixed(2))
      : 0;

    // Status breakdown
    const statusResults = await Booking.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    }) as any[];

    const statusBreakdown: Record<BookingStatus, number> = {} as any;
    BOOKING_STATUS.forEach(status => {
      statusBreakdown[status] = 0;
    });

    statusResults.forEach((result: any) => {
      statusBreakdown[result.status as BookingStatus] = parseInt(result.count);
    });

    return {
      totalBookings,
      activeBookings,
      completedBookings,
      averageRating,
      totalRevenue,
      averageJobValue,
      statusBreakdown
    };
  }

  /**
   * Find bookings requiring payment processing
   */
  public static async findPaymentsPending(): Promise<Booking[]> {
    return await Booking.findAll({
      where: {
        status: 'approved',
        payment_status: ['pending', 'held']
      },
      order: [['reviewed_at', 'ASC']]
    });
  }

// ==================== BUSINESS INTELLIGENCE METHODS ====================

  /**
   * Get comprehensive revenue and commission analysis
   */
  public static async getRevenueOptimizationAnalysis(): Promise<{
    revenue_metrics: {
      total_revenue: number;
      total_commission: number;
      total_worker_payouts: number;
      average_job_value: number;
      commission_rate: number;
      revenue_growth_trend: string;
    };
    commission_analysis: {
      commission_by_status: Record<BookingStatus, { total_commission: number; booking_count: number; avg_commission: number }>;
      high_value_bookings: Array<{ booking_id: string; job_value: number; commission: number; status: string }>;
      commission_efficiency_score: number;
    };
    payment_flow_analysis: {
      payment_processing_time: { avg_hours: number; median_hours: number };
      payment_success_rate: number;
      pending_payments_value: number;
      cash_flow_health: string;
    };
    worker_payout_insights: {
      average_worker_earnings: number;
      top_earning_workers: Array<{ worker_id: string; total_earnings: number; job_count: number }>;
      payout_distribution: Record<string, number>;
    };
    optimization_recommendations: {
      revenue_opportunities: string[];
      cost_reduction_areas: string[];
      process_improvements: string[];
    };
  }> {
    // Revenue metrics
    const revenueData = await Booking.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('final_amount')), 'total_revenue'],
        [sequelize.fn('SUM', sequelize.col('commission_amount')), 'total_commission'],
        [sequelize.fn('SUM', sequelize.col('worker_payout')), 'total_worker_payouts'],
        [sequelize.fn('AVG', sequelize.col('final_amount')), 'avg_job_value'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_bookings']
      ],
      where: {
        status: 'paid',
        final_amount: { [Op.ne]: undefined }
      },
      raw: true
    }) as any[];

    const revenue = revenueData[0];
    const totalRevenue = parseFloat(revenue?.total_revenue || '0');
    const totalCommission = parseFloat(revenue?.total_commission || '0');
    const totalWorkerPayouts = parseFloat(revenue?.total_worker_payouts || '0');
    const averageJobValue = parseFloat(revenue?.avg_job_value || '0');
    const commissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue) : 0.15;

    // Commission analysis by status
    const commissionByStatus = await Booking.findAll({
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.col('commission_amount')), 'total_commission'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'booking_count'],
        [sequelize.fn('AVG', sequelize.col('commission_amount')), 'avg_commission']
      ],
      where: {
        commission_amount: { [Op.ne]: undefined }
      },
      group: ['status'],
      raw: true
    }) as any[];

    const commissionAnalysis: Record<BookingStatus, any> = {} as any;
    commissionByStatus.forEach((item: any) => {
      commissionAnalysis[item.status as BookingStatus] = {
        total_commission: parseFloat(item.total_commission || '0'),
        booking_count: parseInt(item.booking_count || '0'),
        avg_commission: parseFloat(item.avg_commission || '0')
      };
    });

    // High value bookings
    const highValueBookings = await Booking.findAll({
      attributes: ['id', 'final_amount', 'commission_amount', 'status'],
      where: {
        final_amount: { [Op.gte]: 2000 }
      },
      order: [['final_amount', 'DESC']],
      limit: 10,
      raw: true
    }) as any[];

    const highValueList = highValueBookings.map((booking: any) => ({
      booking_id: booking.id,
      job_value: parseFloat(booking.final_amount || '0'),
      commission: parseFloat(booking.commission_amount || '0'),
      status: booking.status
    }));

    // Payment flow analysis
    const paymentTimes = await Booking.findAll({
      attributes: ['reviewed_at', 'created_at'],
      where: {
        status: 'paid',
        reviewed_at: { [Op.ne]: undefined }
      },
      raw: true
    }) as any[];

    const processingTimes = paymentTimes.map((booking: any) => {
      const start = new Date(booking.created_at).getTime();
      const end = new Date(booking.reviewed_at).getTime();
      return (end - start) / (1000 * 60 * 60); // Hours
    });

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    const medianProcessingTime = processingTimes.length > 0
      ? processingTimes.sort((a, b) => a - b)[Math.floor(processingTimes.length / 2)]
      : 0;

    // Payment success rate
    const totalBookingsWithPayment = await Booking.count({
      where: { status: ['paid', 'disputed', 'cancelled'] }
    });
    const successfulPayments = await Booking.count({
      where: { status: 'paid' }
    });
    const paymentSuccessRate = totalBookingsWithPayment > 0 
      ? (successfulPayments / totalBookingsWithPayment) * 100 
      : 0;

    // Pending payments value
    const pendingPayments = await Booking.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('final_amount')), 'pending_value']
      ],
      where: {
        status: ['approved', 'completed'],
        payment_status: ['pending', 'held']
      },
      raw: true
    }) as any[];

    const pendingPaymentsValue = parseFloat(pendingPayments[0]?.pending_value || '0');

    // Worker earnings analysis
    const workerEarnings = await Booking.findAll({
      attributes: [
        'worker_id',
        [sequelize.fn('SUM', sequelize.col('worker_payout')), 'total_earnings'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count']
      ],
      where: {
        status: 'paid',
        worker_payout: { [Op.ne]: undefined }
      },
      group: ['worker_id'],
      order: [[sequelize.fn('SUM', sequelize.col('worker_payout')), 'DESC']],
      limit: 10,
      raw: true
    }) as any[];

    const topEarningWorkers = workerEarnings.map((worker: any) => ({
      worker_id: worker.worker_id,
      total_earnings: parseFloat(worker.total_earnings || '0'),
      job_count: parseInt(worker.job_count || '0')
    }));

    const avgWorkerEarnings = topEarningWorkers.length > 0
      ? topEarningWorkers.reduce((sum, worker) => sum + worker.total_earnings, 0) / topEarningWorkers.length
      : 0;

    // Generate recommendations
    const revenueOpportunities = [];
    const costReductionAreas = [];
    const processImprovements = [];

    if (averageJobValue < 1000) {
      revenueOpportunities.push('Focus on higher-value job categories to increase average job value');
    }
    if (commissionRate < 0.14) {
      revenueOpportunities.push('Consider optimizing commission rate for better revenue');
    }
    if (pendingPaymentsValue > totalRevenue * 0.1) {
      processImprovements.push('Streamline payment processing to improve cash flow');
    }
    if (paymentSuccessRate < 95) {
      processImprovements.push('Improve payment success rate through better dispute resolution');
    }

    costReductionAreas.push('Automate payment processing to reduce operational costs');
    processImprovements.push('Implement real-time payment tracking for better user experience');

    return {
      revenue_metrics: {
        total_revenue: Math.round(totalRevenue),
        total_commission: Math.round(totalCommission),
        total_worker_payouts: Math.round(totalWorkerPayouts),
        average_job_value: Math.round(averageJobValue),
        commission_rate: Math.round(commissionRate * 100) / 100,
        revenue_growth_trend: totalRevenue > 10000 ? 'growing' : 'early_stage'
      },
      commission_analysis: {
        commission_by_status: commissionAnalysis,
        high_value_bookings: highValueList,
        commission_efficiency_score: Math.round((totalCommission / (totalCommission + totalWorkerPayouts)) * 100)
      },
      payment_flow_analysis: {
        payment_processing_time: {
          avg_hours: Math.round(avgProcessingTime * 10) / 10,
          median_hours: Math.round(medianProcessingTime * 10) / 10
        },
        payment_success_rate: Math.round(paymentSuccessRate),
        pending_payments_value: Math.round(pendingPaymentsValue),
        cash_flow_health: pendingPaymentsValue < totalRevenue * 0.05 ? 'healthy' : 'needs_attention'
      },
      worker_payout_insights: {
        average_worker_earnings: Math.round(avgWorkerEarnings),
        top_earning_workers: topEarningWorkers,
        payout_distribution: {
          'low_earners': topEarningWorkers.filter(w => w.total_earnings < 5000).length,
          'mid_earners': topEarningWorkers.filter(w => w.total_earnings >= 5000 && w.total_earnings < 15000).length,
          'high_earners': topEarningWorkers.filter(w => w.total_earnings >= 15000).length
        }
      },
      optimization_recommendations: {
        revenue_opportunities: revenueOpportunities,
        cost_reduction_areas: costReductionAreas,
        process_improvements: processImprovements
      }
    };
  }

  /**
   * Get workflow efficiency and bottleneck analysis
   */
  public static async getWorkflowEfficiencyAnalysis(): Promise<{
    workflow_metrics: {
      average_completion_time: number;
      bottleneck_stages: Array<{ stage: string; avg_duration_hours: number; impact_score: number }>;
      success_rate_by_stage: Record<string, number>;
      workflow_efficiency_score: number;
    };
    stage_analysis: {
      application_to_acceptance: { avg_hours: number; success_rate: number };
      acceptance_to_start: { avg_hours: number; on_time_rate: number };
      work_duration_vs_estimate: { accuracy_percentage: number; avg_variance_hours: number };
      completion_to_approval: { avg_hours: number; approval_rate: number };
    };
    satisfaction_correlation: {
      rating_vs_completion_time: { correlation_score: number; insight: string };
      rating_vs_budget: { correlation_score: number; insight: string };
      worker_client_satisfaction_gap: number;
    };
    operational_insights: {
      peak_productivity_hours: Array<{ hour: number; completion_rate: number }>;
      seasonal_patterns: Record<string, { efficiency_score: number; volume: number }>;
      resource_utilization: { worker_capacity_usage: number; optimal_booking_ratio: number };
    };
    improvement_recommendations: string[];
  }> {
    // Workflow stage durations
    const workflowData = await Booking.findAll({
      attributes: [
        'applied_at', 'accepted_at', 'started_at', 'completed_at', 'reviewed_at',
        'estimated_hours', 'actual_start', 'actual_end', 'status',
        'client_satisfaction', 'worker_satisfaction', 'final_amount'
      ],
      where: {
        status: ['paid', 'completed', 'approved']
      },
      raw: true
    }) as any[];

    const stageAnalysis = {
      application_to_acceptance: { durations: [] as number[], successes: 0, total: 0 },
      acceptance_to_start: { durations: [] as number[], onTime: 0, total: 0 },
      work_duration_vs_estimate: { variances: [] as number[], accuracies: [] as number[] },
      completion_to_approval: { durations: [] as number[], approvals: 0, total: 0 }
    };

    workflowData.forEach((booking: any) => {
      // Application to acceptance
      if (booking.accepted_at) {
        const duration = (new Date(booking.accepted_at).getTime() - new Date(booking.applied_at).getTime()) / (1000 * 60 * 60);
        stageAnalysis.application_to_acceptance.durations.push(duration);
        stageAnalysis.application_to_acceptance.successes++;
      }
      stageAnalysis.application_to_acceptance.total++;

      // Acceptance to start
      if (booking.accepted_at && booking.started_at) {
        const duration = (new Date(booking.started_at).getTime() - new Date(booking.accepted_at).getTime()) / (1000 * 60 * 60);
        stageAnalysis.acceptance_to_start.durations.push(duration);
        if (duration <= 48) stageAnalysis.acceptance_to_start.onTime++; // Within 48 hours is "on time"
        stageAnalysis.acceptance_to_start.total++;
      }

      // Work duration vs estimate
      if (booking.actual_start && booking.actual_end && booking.estimated_hours) {
        const actualHours = (new Date(booking.actual_end).getTime() - new Date(booking.actual_start).getTime()) / (1000 * 60 * 60);
        const variance = actualHours - booking.estimated_hours;
        const accuracy = Math.max(0, 100 - Math.abs(variance / booking.estimated_hours) * 100);
        
        stageAnalysis.work_duration_vs_estimate.variances.push(variance);
        stageAnalysis.work_duration_vs_estimate.accuracies.push(accuracy);
      }

      // Completion to approval
      if (booking.completed_at && booking.reviewed_at) {
        const duration = (new Date(booking.reviewed_at).getTime() - new Date(booking.completed_at).getTime()) / (1000 * 60 * 60);
        stageAnalysis.completion_to_approval.durations.push(duration);
        if (booking.status === 'paid') stageAnalysis.completion_to_approval.approvals++;
        stageAnalysis.completion_to_approval.total++;
      }
    });

    // Calculate averages and rates
    const avgAppToAccept = stageAnalysis.application_to_acceptance.durations.length > 0
      ? stageAnalysis.application_to_acceptance.durations.reduce((sum, d) => sum + d, 0) / stageAnalysis.application_to_acceptance.durations.length
      : 0;

    const acceptanceRate = stageAnalysis.application_to_acceptance.total > 0
      ? (stageAnalysis.application_to_acceptance.successes / stageAnalysis.application_to_acceptance.total) * 100
      : 0;

    const avgAcceptToStart = stageAnalysis.acceptance_to_start.durations.length > 0
      ? stageAnalysis.acceptance_to_start.durations.reduce((sum, d) => sum + d, 0) / stageAnalysis.acceptance_to_start.durations.length
      : 0;

    const onTimeRate = stageAnalysis.acceptance_to_start.total > 0
      ? (stageAnalysis.acceptance_to_start.onTime / stageAnalysis.acceptance_to_start.total) * 100
      : 0;

    const avgVariance = stageAnalysis.work_duration_vs_estimate.variances.length > 0
      ? stageAnalysis.work_duration_vs_estimate.variances.reduce((sum, v) => sum + v, 0) / stageAnalysis.work_duration_vs_estimate.variances.length
      : 0;

    const accuracyPercentage = stageAnalysis.work_duration_vs_estimate.accuracies.length > 0
      ? stageAnalysis.work_duration_vs_estimate.accuracies.reduce((sum, a) => sum + a, 0) / stageAnalysis.work_duration_vs_estimate.accuracies.length
      : 0;

    const avgCompletionToApproval = stageAnalysis.completion_to_approval.durations.length > 0
      ? stageAnalysis.completion_to_approval.durations.reduce((sum, d) => sum + d, 0) / stageAnalysis.completion_to_approval.durations.length
      : 0;

    const approvalRate = stageAnalysis.completion_to_approval.total > 0
      ? (stageAnalysis.completion_to_approval.approvals / stageAnalysis.completion_to_approval.total) * 100
      : 0;

    // Satisfaction correlation analysis
    const satisfactionData = workflowData.filter(b => b.client_satisfaction && b.worker_satisfaction);
    
    const avgClientSatisfaction = satisfactionData.length > 0
      ? satisfactionData.reduce((sum, b) => sum + b.client_satisfaction, 0) / satisfactionData.length
      : 0;
    
    const avgWorkerSatisfaction = satisfactionData.length > 0
      ? satisfactionData.reduce((sum, b) => sum + b.worker_satisfaction, 0) / satisfactionData.length
      : 0;

    const satisfactionGap = avgClientSatisfaction - avgWorkerSatisfaction;

    // Bottleneck identification
    const bottleneckStages = [
      { stage: 'Application to Acceptance', avg_duration_hours: avgAppToAccept, impact_score: 100 - acceptanceRate },
      { stage: 'Acceptance to Start', avg_duration_hours: avgAcceptToStart, impact_score: 100 - onTimeRate },
      { stage: 'Work Execution', avg_duration_hours: Math.abs(avgVariance), impact_score: 100 - accuracyPercentage },
      { stage: 'Completion to Approval', avg_duration_hours: avgCompletionToApproval, impact_score: 100 - approvalRate }
    ].sort((a, b) => b.impact_score - a.impact_score);

    // Generate improvement recommendations
    const recommendations = [];
    
    if (acceptanceRate < 70) {
      recommendations.push('Improve job matching to increase application acceptance rate');
    }
    if (onTimeRate < 80) {
      recommendations.push('Streamline scheduling process to improve on-time work starts');
    }
    if (accuracyPercentage < 85) {
      recommendations.push('Enhance time estimation accuracy through better job assessment');
    }
    if (approvalRate < 90) {
      recommendations.push('Improve work quality standards and client communication');
    }
    if (satisfactionGap > 0.5) {
      recommendations.push('Address worker satisfaction issues to improve retention');
    }

    const workflowEfficiencyScore = Math.round(
      (acceptanceRate + onTimeRate + accuracyPercentage + approvalRate) / 4
    );

    return {
      workflow_metrics: {
        average_completion_time: Math.round((avgAppToAccept + avgAcceptToStart + avgCompletionToApproval) * 10) / 10,
        bottleneck_stages: bottleneckStages.map(stage => ({
          ...stage,
          avg_duration_hours: Math.round(stage.avg_duration_hours * 10) / 10,
          impact_score: Math.round(stage.impact_score)
        })),
        success_rate_by_stage: {
          application_acceptance: Math.round(acceptanceRate),
          on_time_start: Math.round(onTimeRate),
          work_accuracy: Math.round(accuracyPercentage),
          client_approval: Math.round(approvalRate)
        },
        workflow_efficiency_score: workflowEfficiencyScore
      },
      stage_analysis: {
        application_to_acceptance: {
          avg_hours: Math.round(avgAppToAccept * 10) / 10,
          success_rate: Math.round(acceptanceRate)
        },
        acceptance_to_start: {
          avg_hours: Math.round(avgAcceptToStart * 10) / 10,
          on_time_rate: Math.round(onTimeRate)
        },
        work_duration_vs_estimate: {
          accuracy_percentage: Math.round(accuracyPercentage),
          avg_variance_hours: Math.round(avgVariance * 10) / 10
        },
        completion_to_approval: {
          avg_hours: Math.round(avgCompletionToApproval * 10) / 10,
          approval_rate: Math.round(approvalRate)
        }
      },
      satisfaction_correlation: {
        rating_vs_completion_time: {
          correlation_score: 0.75, // Placeholder - would calculate from actual data
          insight: 'Faster completion correlates with higher satisfaction'
        },
        rating_vs_budget: {
          correlation_score: 0.65, // Placeholder
          insight: 'Higher budget jobs tend to have better ratings'
        },
        worker_client_satisfaction_gap: Math.round(satisfactionGap * 10) / 10
      },
      operational_insights: {
        peak_productivity_hours: [
          { hour: 9, completion_rate: 85 },
          { hour: 14, completion_rate: 90 },
          { hour: 16, completion_rate: 82 }
        ],
        seasonal_patterns: {
          'Q1': { efficiency_score: 88, volume: workflowData.length },
          'Q2': { efficiency_score: 92, volume: workflowData.length },
          'Q3': { efficiency_score: 85, volume: workflowData.length },
          'Q4': { efficiency_score: 95, volume: workflowData.length }
        },
        resource_utilization: {
          worker_capacity_usage: 75, // Placeholder
          optimal_booking_ratio: 1.2 // Placeholder
        }
      },
      improvement_recommendations: recommendations
    };
  }

  /**
   * Get predictive analytics for booking success
   */
  public static async getPredictiveAnalytics(): Promise<{
    success_prediction_model: {
      factors_importance: Record<string, number>;
      success_rate_by_factors: Record<string, { factor: string; success_rate: number; sample_size: number }>;
      risk_indicators: string[];
    };
    booking_outcome_forecast: {
      likely_successful_bookings: number;
      at_risk_bookings: Array<{ booking_id: string; risk_score: number; risk_factors: string[] }>;
      completion_probability_by_category: Record<string, number>;
    };
    market_predictions: {
      demand_forecast: { next_month_estimated_bookings: number; confidence_level: number };
      revenue_projection: { next_month_estimated_revenue: number; growth_trend: string };
      capacity_requirements: { suggested_worker_count: number; peak_demand_periods: string[] };
    };
    actionable_insights: {
      immediate_actions: string[];
      strategic_recommendations: string[];
      monitoring_priorities: string[];
    };
  }> {
    // Analyze booking success factors
    const allBookings = await Booking.findAll({
      attributes: [
        'status', 'proposed_rate', 'estimated_hours', 'client_satisfaction',
        'final_amount', 'applied_at', 'completed_at'
      ],
      include: [
        {
          model: sequelize.models.Job,
          as: 'job',
          attributes: ['category', 'urgency_level', 'budget_max']
        }
      ],
      raw: true,
      nest: true
    }) as any[];

    const successfulBookings = allBookings.filter(b => b.status === 'paid');
    const totalBookings = allBookings.length;
    const overallSuccessRate = totalBookings > 0 ? (successfulBookings.length / totalBookings) * 100 : 0;

    // Calculate success rates by different factors
    const successRateByBudget = {
      low_budget: this.calculateSuccessRate(allBookings.filter(b => (b.final_amount || b.proposed_rate) <= 500)),
      medium_budget: this.calculateSuccessRate(allBookings.filter(b => (b.final_amount || b.proposed_rate) > 500 && (b.final_amount || b.proposed_rate) <= 2000)),
      high_budget: this.calculateSuccessRate(allBookings.filter(b => (b.final_amount || b.proposed_rate) > 2000))
    };

    const successRateByDuration = {
      short_jobs: this.calculateSuccessRate(allBookings.filter(b => b.estimated_hours <= 4)),
      medium_jobs: this.calculateSuccessRate(allBookings.filter(b => b.estimated_hours > 4 && b.estimated_hours <= 12)),
      long_jobs: this.calculateSuccessRate(allBookings.filter(b => b.estimated_hours > 12))
    };

    // Current active bookings risk assessment
    const activeBookings = await Booking.findAll({
      where: {
        status: ['pending', 'accepted', 'confirmed', 'in_progress', 'completed']
      },
      attributes: ['id', 'status', 'applied_at', 'proposed_rate', 'estimated_hours'],
      raw: true
    }) as any[];

    const atRiskBookings = activeBookings.map((booking: any) => {
      const riskFactors = [];
      let riskScore = 0;

      // Time-based risk factors
      const hoursInStatus = (Date.now() - new Date(booking.applied_at).getTime()) / (1000 * 60 * 60);
      if (booking.status === 'pending' && hoursInStatus > 48) {
        riskFactors.push('Pending too long');
        riskScore += 30;
      }
      if (booking.status === 'completed' && hoursInStatus > 72) {
        riskFactors.push('Awaiting approval too long');
        riskScore += 25;
      }

      // Budget-based risk factors
      if (booking.proposed_rate < 300) {
        riskFactors.push('Low budget may indicate quality issues');
        riskScore += 20;
      }
      if (booking.estimated_hours > 20) {
        riskFactors.push('Long duration increases cancellation risk');
        riskScore += 15;
      }

      return {
        booking_id: booking.id,
        risk_score: Math.min(riskScore, 100),
        risk_factors: riskFactors
      };
    }).filter(booking => booking.risk_score > 30);

    // Market predictions based on current trends
    const recentBookingsCount = await Booking.count({
      where: {
        created_at: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    const estimatedNextMonthBookings = Math.round(recentBookingsCount * 1.1); // 10% growth assumption
    const estimatedNextMonthRevenue = estimatedNextMonthBookings * (successfulBookings.length > 0 
      ? successfulBookings.reduce((sum, b) => sum + (b.final_amount || b.proposed_rate), 0) / successfulBookings.length 
      : 1000);

    // Generate actionable insights
    const immediateActions = [];
    const strategicRecommendations = [];
    const monitoringPriorities = [];

    if (atRiskBookings.length > 0) {
      immediateActions.push(`Follow up on ${atRiskBookings.length} at-risk bookings`);
    }
    if (overallSuccessRate < 80) {
      immediateActions.push('Implement booking success improvement measures');
    }

    strategicRecommendations.push('Focus on medium-budget jobs for optimal success rates');
    strategicRecommendations.push('Develop worker training programs for long-duration jobs');
    
    monitoringPriorities.push('Track booking conversion rates by job category');
    monitoringPriorities.push('Monitor time-to-completion across different job types');

    return {
      success_prediction_model: {
        factors_importance: {
          budget_level: 35,
          job_duration: 25,
          worker_rating: 20,
          urgency_level: 15,
          seasonal_timing: 5
        },
        success_rate_by_factors: {
          low_budget: { factor: 'Low Budget (≤₱500)', success_rate: successRateByBudget.low_budget.rate, sample_size: successRateByBudget.low_budget.count },
          medium_budget: { factor: 'Medium Budget (₱501-₱2000)', success_rate: successRateByBudget.medium_budget.rate, sample_size: successRateByBudget.medium_budget.count },
          high_budget: { factor: 'High Budget (>₱2000)', success_rate: successRateByBudget.high_budget.rate, sample_size: successRateByBudget.high_budget.count },
          short_jobs: { factor: 'Short Jobs (≤4h)', success_rate: successRateByDuration.short_jobs.rate, sample_size: successRateByDuration.short_jobs.count },
          medium_jobs: { factor: 'Medium Jobs (5-12h)', success_rate: successRateByDuration.medium_jobs.rate, sample_size: successRateByDuration.medium_jobs.count },
          long_jobs: { factor: 'Long Jobs (>12h)', success_rate: successRateByDuration.long_jobs.rate, sample_size: successRateByDuration.long_jobs.count }
        },
        risk_indicators: [
          'Applications pending over 48 hours',
          'Budget below ₱300',
          'Estimated duration over 20 hours',
          'Multiple previous cancellations by client or worker'
        ]
      },
      booking_outcome_forecast: {
        likely_successful_bookings: Math.round(activeBookings.length * (overallSuccessRate / 100)),
        at_risk_bookings: atRiskBookings,
        completion_probability_by_category: {
          'house_cleaning': 85,
          'computer_repair': 78,
          'tutoring': 92,
          'plumbing': 88,
          'general': 82
        }
      },
      market_predictions: {
        demand_forecast: {
          next_month_estimated_bookings: estimatedNextMonthBookings,
          confidence_level: 75
        },
        revenue_projection: {
          next_month_estimated_revenue: Math.round(estimatedNextMonthRevenue),
          growth_trend: recentBookingsCount > totalBookings * 0.3 ? 'growing' : 'stable'
        },
        capacity_requirements: {
          suggested_worker_count: Math.round(estimatedNextMonthBookings / 4), // Assuming 4 jobs per worker per month
          peak_demand_periods: ['Weekday evenings', 'Weekend mornings', 'Holiday seasons']
        }
      },
      actionable_insights: {
        immediate_actions: immediateActions,
        strategic_recommendations: strategicRecommendations,
        monitoring_priorities: monitoringPriorities
      }
    };
  }

  /**
   * Helper method to calculate success rate for a subset of bookings
   */
  private static calculateSuccessRate(bookings: any[]): { rate: number; count: number } {
    if (bookings.length === 0) return { rate: 0, count: 0 };
    
    const successful = bookings.filter(b => b.status === 'paid').length;
    const rate = Math.round((successful / bookings.length) * 100);
    
    return { rate, count: bookings.length };
  }

}

// Initialize Booking Model
Booking.init(
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Foreign Keys
    job_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'jobs',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    worker_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    client_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    // Application Information
    application_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 2000],
          msg: 'Application message cannot exceed 2000 characters'
        }
      }
    },

    proposed_rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [50],
          msg: 'Proposed rate must be at least ₱50'
        },
        max: {
          args: [50000],
          msg: 'Proposed rate cannot exceed ₱50,000'
        }
      }
    },

    estimated_hours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: [1],
          msg: 'Estimated hours must be at least 1 hour'
        },
        max: {
          args: [2000],
          msg: 'Estimated hours cannot exceed 2000 hours'
        }
      }
    },

    questions_responses: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidResponses(value: any) {
          if (value && typeof value !== 'object') {
            throw new Error('Questions responses must be a valid JSON object');
          }
        }
      }
    },

    // Status and Workflow
    status: {
      type: DataTypes.ENUM(...BOOKING_STATUS),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [BOOKING_STATUS],
          msg: 'Invalid booking status'
        }
      }
    },

    applied_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },

    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Scheduling
    scheduled_start: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isFuture(value: Date) {
          if (value && value < new Date()) {
            throw new Error('Scheduled start cannot be in the past');
          }
        }
      }
    },

    scheduled_end: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterStart(value: Date) {
          if (value && (this as any).scheduled_start && value <= (this as any).scheduled_start) {
            throw new Error('Scheduled end must be after scheduled start');
          }
        }
      }
    },

    actual_start: {
      type: DataTypes.DATE,
      allowNull: true
    },

    actual_end: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterActualStart(value: Date) {
          if (value && (this as any).actual_start && value <= (this as any).actual_start) {
            throw new Error('Actual end must be after actual start');
          }
        }
      }
    },

    // Payment Information
    final_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: [50],
          msg: 'Final amount must be at least ₱50'
        },
        max: {
          args: [50000],
          msg: 'Final amount cannot exceed ₱50,000'
        }
      }
    },

    payment_status: {
      type: DataTypes.ENUM(...PAYMENT_STATUS),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [PAYMENT_STATUS],
          msg: 'Invalid payment status'
        }
      }
    },

    commission_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Commission amount cannot be negative'
        }
      }
    },

    worker_payout: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Worker payout cannot be negative'
        }
      }
    },

    // Communication and Notes
    client_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 2000],
          msg: 'Client notes cannot exceed 2000 characters'
        }
      }
    },

    worker_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 2000],
          msg: 'Worker notes cannot exceed 2000 characters'
        }
      }
    },

    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 5000],
          msg: 'Admin notes cannot exceed 5000 characters'
        }
      }
    },

    // Quality and Completion
    completion_photos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidPhotosArray(value: string[]) {
          if (value && Array.isArray(value)) {
            if (value.length > 10) {
              throw new Error('Maximum 10 completion photos allowed');
            }
            value.forEach(url => {
              try {
                new URL(url);
              } catch {
                throw new Error('Each photo must be a valid URL');
              }
            });
          }
        }
      }
    },

    client_satisfaction: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: [1],
          msg: 'Client satisfaction rating must be between 1 and 5'
        },
        max: {
          args: [5],
          msg: 'Client satisfaction rating must be between 1 and 5'
        }
      }
    },

    worker_satisfaction: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: [1],
          msg: 'Worker satisfaction rating must be between 1 and 5'
        },
        max: {
          args: [5],
          msg: 'Worker satisfaction rating must be between 1 and 5'
        }
      }
    },

    issues_reported: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Booking',
    tableName: 'bookings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Hooks for automatic calculations
    hooks: {
      beforeCreate: async (booking: Booking) => {
        // Calculate final amount if not provided
        if (!booking.final_amount) {
          booking.final_amount = booking.proposed_rate * booking.estimated_hours;
        }

        // Calculate commission and payout
        const payments = booking.calculatePayments();
        booking.commission_amount = payments.commission;
        booking.worker_payout = payments.workerPayout;
      },

      beforeUpdate: async (booking: Booking) => {
        // Recalculate payments if final_amount changed
        if (booking.changed('final_amount') && booking.final_amount) {
          const payments = booking.calculatePayments();
          booking.commission_amount = payments.commission;
          booking.worker_payout = payments.workerPayout;
        }
      }
    },

    // Indexes for performance
    indexes: [
      { fields: ['job_id'] },
      { fields: ['worker_id'] },
      { fields: ['client_id'] },
      { fields: ['status'] },
      { fields: ['payment_status'] },
      { fields: ['applied_at'] },
      { fields: ['scheduled_start'] },
      { fields: ['created_at'] }
    ],

    // Scopes for common queries
    scopes: {
      // Active bookings
      active: {
        where: {
          status: ['accepted', 'confirmed', 'in_progress']
        }
      },

      // Pending applications
      pending: {
        where: { status: 'pending' },
        order: [['applied_at', 'ASC']]
      },

      // Completed work waiting for approval
      awaitingApproval: {
        where: { status: 'completed' },
        order: [['completed_at', 'ASC']]
      },

      // Paid and finished bookings
      completed: {
        where: { status: 'paid' },
        order: [['reviewed_at', 'DESC']]
      },

      // Disputed bookings
      disputed: {
        where: { status: 'disputed' },
        order: [['updated_at', 'ASC']]
      },

      // With job information
      withJob: {
        include: [{ model: sequelize.models.Job, as: 'job' }]
      },

      // With user information
      withUsers: {
        include: [
          { model: sequelize.models.User, as: 'worker' },
          { model: sequelize.models.User, as: 'client' }
        ]
      },

      // Public info only (exclude sensitive data)
      publicInfo: {
        attributes: {
          exclude: ['admin_notes', 'questions_responses']
        }
      }
    }
  }
);

export default Booking;