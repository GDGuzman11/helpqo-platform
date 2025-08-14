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
  public reviews?: any[];

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