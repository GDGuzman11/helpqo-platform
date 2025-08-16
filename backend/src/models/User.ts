import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

// Define User attributes interface
export interface UserAttributes {
  id: string;
  email: string;
  phone: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'client' | 'worker' | 'admin';
  is_verified: boolean;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  profile_picture?: string;
  date_of_birth?: Date;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  last_login?: Date;
  is_active: boolean;
  verification_token?: string;
  password_reset_token?: string;
  password_reset_expires?: Date;
  created_at: Date;
  updated_at: Date;
}

// Define creation attributes (optional fields for creation)
export interface UserCreationAttributes extends Optional<UserAttributes, 
  'id' | 'is_verified' | 'is_phone_verified' | 'is_email_verified' | 
  'profile_picture' | 'date_of_birth' | 'address' | 'city' | 'province' | 
  'postal_code' | 'emergency_contact_name' | 'emergency_contact_phone' | 
  'last_login' | 'is_active' | 'verification_token' | 'password_reset_token' | 
  'password_reset_expires' | 'created_at' | 'updated_at'
> {}

// User Model Class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public phone!: string;
  public password_hash!: string;
  public first_name!: string;
  public last_name!: string;
  public role!: 'client' | 'worker' | 'admin';
  public is_verified!: boolean;
  public is_phone_verified!: boolean;
  public is_email_verified!: boolean;
  public profile_picture?: string;
  public date_of_birth?: Date;
  public address?: string;
  public city?: string;
  public province?: string;
  public postal_code?: string;
  public emergency_contact_name?: string;
  public emergency_contact_phone?: string;
  public last_login?: Date;
  public is_active!: boolean;
  public verification_token?: string;
  public password_reset_token?: string;
  public password_reset_expires?: Date;
  public created_at!: Date;
  public updated_at!: Date;

  // Instance Methods
  
  /**
   * Compare provided password with stored hash
   * @param password - Plain text password to verify
   * @returns Promise<boolean> - True if password matches
   */
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  /**
   * Get user's full name
   * @returns string - Full name
   */
  public getFullName(): string {
    return `${this.first_name} ${this.last_name}`;
  }

  /**
   * Check if user is fully verified (phone + email + documents)
   * @returns boolean - True if fully verified
   */
  public isFullyVerified(): boolean {
    return this.is_verified && this.is_phone_verified && this.is_email_verified;
  }

  /**
   * Get user's public profile (without sensitive data)
   * @returns object - Public user data
   */
  public getPublicProfile() {
    return {
      id: this.id,
      first_name: this.first_name,
      last_name: this.last_name,
      role: this.role,
      profile_picture: this.profile_picture,
      city: this.city,
      province: this.province,
      is_verified: this.is_verified,
      created_at: this.created_at
    };
  }

  /**
   * Update last login timestamp
   */
  public async updateLastLogin(): Promise<void> {
    this.last_login = new Date();
    await this.save();
  }

  // Association Methods (automatically added by Sequelize associations)
  public getWorkerProfile!: () => Promise<any>;
  public createWorkerProfile!: (workerData: any) => Promise<any>;
  public setWorkerProfile!: (worker: any) => Promise<void>;
  public hasWorkerProfile!: () => Promise<boolean>;
  
  // Association Properties (automatically added by Sequelize includes)
  public workerProfile?: any;

  // Job associations (added in Step 46)
  public jobsPosted?: any[];

  // Job association methods (automatically added by Sequelize associations)
  public getJobsPosted!: () => Promise<any[]>;
  public createJob!: (jobData: any) => Promise<any>;
  public addJob!: (job: any) => Promise<void>;
  public setJobsPosted!: (jobs: any[]) => Promise<void>;

    // Booking associations (added in Step 47)
  public workerBookings?: any[];      // Bookings where user is the worker
  public clientBookings?: any[];      // Bookings where user is the client

  // Booking association methods (automatically added by Sequelize associations)
  public getWorkerBookings!: () => Promise<any[]>;
  public getClientBookings!: () => Promise<any[]>;
  public createWorkerBooking!: (bookingData: any) => Promise<any>;
  public createClientBooking!: (bookingData: any) => Promise<any>;
  public addWorkerBooking!: (booking: any) => Promise<void>;
  public addClientBooking!: (booking: any) => Promise<void>;

  // Review associations (added in Step 48)
  public reviewsGiven?: any[];        // Reviews written by this user
  public reviewsReceived?: any[];     // Reviews received by this user

  // Review association methods (automatically added by Sequelize associations)
  public getReviewsGiven!: () => Promise<any[]>;
  public getReviewsReceived!: () => Promise<any[]>;
  public createReviewGiven!: (reviewData: any) => Promise<any>;
  public createReviewReceived!: (reviewData: any) => Promise<any>;
  public addReviewGiven!: (review: any) => Promise<void>;
  public addReviewReceived!: (review: any) => Promise<void>;
  public countReviewsGiven!: () => Promise<number>;
  public countReviewsReceived!: () => Promise<number>;

  // Static Methods

  /**
   * Hash password using bcrypt
   * @param password - Plain text password
   * @returns Promise<string> - Hashed password
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Find user by email or phone
   * @param identifier - Email or phone number
   * @returns Promise<User | null>
   */
  public static async findByEmailOrPhone(identifier: string): Promise<User | null> {
    return User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });
  }

  /**
   * Find active users only
   * @param options - Additional query options
   * @returns Promise<User[]>
   */
  public static async findActiveUsers(options: any = {}): Promise<User[]> {
    return User.findAll({
      where: {
        is_active: true,
        ...options.where
      },
      ...options
    });
  }

// ==================== BUSINESS INTELLIGENCE METHODS ====================

  /**
   * Get comprehensive marketplace analytics
   */
  public static async getMarketplaceAnalytics(): Promise<{
    total_users: number;
    user_distribution: {
      clients: number;
      workers: number;
      admins: number;
      client_percentage: number;
      worker_percentage: number;
    };
    verification_metrics: {
      verified_users: number;
      verification_rate: number;
      phone_verified: number;
      email_verified: number;
    };
    geographic_distribution: Record<string, number>;
    engagement_metrics: {
      active_users_7_days: number;
      active_users_30_days: number;
      new_users_this_month: number;
      retention_rate: number;
    };
    growth_metrics: {
      monthly_growth_rate: number;
      weekly_signups: number;
      user_acquisition_trend: string;
    };
  }> {
    const totalUsers = await User.count({ where: { is_active: true } });
    
    // User distribution by role
    const clients = await User.count({ where: { role: 'client', is_active: true } });
    const workers = await User.count({ where: { role: 'worker', is_active: true } });
    const admins = await User.count({ where: { role: 'admin', is_active: true } });
    
    // Verification metrics
    const verifiedUsers = await User.count({ where: { is_verified: true, is_active: true } });
    const phoneVerified = await User.count({ where: { is_phone_verified: true, is_active: true } });
    const emailVerified = await User.count({ where: { is_email_verified: true, is_active: true } });
    
    // Geographic distribution (top cities)
    const geoDistribution = await User.findAll({
      attributes: [
        'city',
        [sequelize.fn('COUNT', sequelize.col('id')), 'user_count']
      ],
      where: { is_active: true },
      group: ['city'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    }) as any[];

    const geographicDistribution: Record<string, number> = {};
    geoDistribution.forEach((item: any) => {
      if (item.city) {
        geographicDistribution[item.city] = parseInt(item.user_count);
      }
    });

    // Engagement metrics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

    const activeUsers7Days = await User.count({
      where: {
        last_login: { [Op.gte]: sevenDaysAgo },
        is_active: true
      }
    });

    const activeUsers30Days = await User.count({
      where: {
        last_login: { [Op.gte]: thirtyDaysAgo },
        is_active: true
      }
    });

    const newUsersThisMonth = await User.count({
      where: {
        created_at: { [Op.gte]: thisMonthStart },
        is_active: true
      }
    });

    const newUsersLastMonth = await User.count({
      where: {
        created_at: { 
          [Op.gte]: lastMonthStart, 
          [Op.lt]: thisMonthStart 
        },
        is_active: true
      }
    });

    // Calculate growth rate
    const monthlyGrowthRate = newUsersLastMonth > 0 
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 
      : 0;

    const weeklySignups = await User.count({
      where: {
        created_at: { [Op.gte]: sevenDaysAgo },
        is_active: true
      }
    });

    return {
      total_users: totalUsers,
      user_distribution: {
        clients,
        workers,
        admins,
        client_percentage: totalUsers > 0 ? Math.round((clients / totalUsers) * 100) : 0,
        worker_percentage: totalUsers > 0 ? Math.round((workers / totalUsers) * 100) : 0
      },
      verification_metrics: {
        verified_users: verifiedUsers,
        verification_rate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
        phone_verified: phoneVerified,
        email_verified: emailVerified
      },
      geographic_distribution: geographicDistribution,
      engagement_metrics: {
        active_users_7_days: activeUsers7Days,
        active_users_30_days: activeUsers30Days,
        new_users_this_month: newUsersThisMonth,
        retention_rate: totalUsers > 0 ? Math.round((activeUsers30Days / totalUsers) * 100) : 0
      },
      growth_metrics: {
        monthly_growth_rate: Math.round(monthlyGrowthRate * 10) / 10,
        weekly_signups: weeklySignups,
        user_acquisition_trend: monthlyGrowthRate > 0 ? 'growing' : monthlyGrowthRate < 0 ? 'declining' : 'stable'
      }
    };
  }

  /**
   * Get user engagement scoring (simplified to avoid circular dependencies)
   */
  public static async getUserEngagementScore(userId: string): Promise<{
    user_id: string;
    engagement_score: number;
    score_breakdown: {
      profile_completion: number;
      activity_level: number;
      verification_status: number;
      account_age: number;
    };
    engagement_level: 'low' | 'medium' | 'high' | 'exceptional';
    recommendations: string[];
  }> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Profile completion scoring (0-25 points)
    let profileCompletion = 0;
    if (user.profile_picture) profileCompletion += 5;
    if (user.address && user.city && user.province) profileCompletion += 5;
    if (user.emergency_contact_name && user.emergency_contact_phone) profileCompletion += 5;
    if (user.date_of_birth) profileCompletion += 5;
    if (user.first_name && user.last_name) profileCompletion += 5;

    // Activity level scoring (0-25 points)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogin = user.last_login && user.last_login > thirtyDaysAgo;
    
    let activityLevel = 0;
    if (recentLogin) activityLevel += 15;
    if (user.is_active) activityLevel += 10;

    // Verification status scoring (0-25 points)
    let verificationStatus = 0;
    if (user.is_email_verified) verificationStatus += 8;
    if (user.is_phone_verified) verificationStatus += 8;
    if (user.is_verified) verificationStatus += 9;

    // Account age scoring (0-25 points)
    const accountAgeInDays = Math.floor((Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24));
    let accountAge = 0;
    if (accountAgeInDays > 7) accountAge += 8;
    if (accountAgeInDays > 30) accountAge += 8;
    if (accountAgeInDays > 90) accountAge += 9;

    const totalScore = profileCompletion + activityLevel + verificationStatus + accountAge;
    
    // Determine engagement level
    let engagementLevel: 'low' | 'medium' | 'high' | 'exceptional';
    if (totalScore >= 80) engagementLevel = 'exceptional';
    else if (totalScore >= 60) engagementLevel = 'high';
    else if (totalScore >= 40) engagementLevel = 'medium';
    else engagementLevel = 'low';

    // Generate recommendations
    const recommendations: string[] = [];
    if (profileCompletion < 20) recommendations.push('Complete your profile for better visibility');
    if (activityLevel < 15) recommendations.push('Stay active by logging in regularly');
    if (verificationStatus < 15) recommendations.push('Verify your email and phone number');
    if (accountAge < 15) recommendations.push('Continue using the platform to build trust');
    if (recommendations.length === 0) recommendations.push('Keep up the excellent engagement!');

    return {
      user_id: userId,
      engagement_score: totalScore,
      score_breakdown: {
        profile_completion: profileCompletion,
        activity_level: activityLevel,
        verification_status: verificationStatus,
        account_age: accountAge
      },
      engagement_level: engagementLevel,
      recommendations
    };
  }

  /**
   * Get market penetration analysis
   */
  public static async getMarketPenetrationAnalysis(): Promise<{
    total_addressable_market: {
      metro_manila_population: number;
      estimated_target_demographic: number;
      current_user_base: number;
      market_penetration_percentage: number;
    };
    geographic_penetration: Record<string, {
      users: number;
      estimated_population: number;
      penetration_rate: number;
    }>;
    role_distribution_by_city: Record<string, {
      clients: number;
      workers: number;
      client_worker_ratio: number;
    }>;
    growth_opportunities: {
      underserved_cities: string[];
      high_potential_areas: string[];
      expansion_recommendations: string[];
    };
  }> {
    // Philippine market data (approximate)
    const marketData = {
      'Metro Manila': 13000000,
      'Cebu City': 950000,
      'Davao City': 1800000,
      'Quezon City': 3000000,
      'Manila': 1800000,
      'Makati': 600000,
      'Pasig': 800000,
      'Taguig': 900000,
      'Caloocan': 1600000,
      'Las Piñas': 600000
    };

    const totalUsers = await User.count({ where: { is_active: true } });
    const estimatedTargetDemographic = 13000000 * 0.15; // 15% of Metro Manila (middle class)

    // Geographic penetration analysis
    const geographicPenetration: Record<string, any> = {};
    const roleDistributionByCity: Record<string, any> = {};

    for (const [city, population] of Object.entries(marketData)) {
      const cityUsers = await User.count({
        where: { 
          city: { [Op.iLike]: `%${city}%` },
          is_active: true 
        }
      });

      const cityClients = await User.count({
        where: { 
          city: { [Op.iLike]: `%${city}%` },
          role: 'client',
          is_active: true 
        }
      });

      const cityWorkers = await User.count({
        where: { 
          city: { [Op.iLike]: `%${city}%` },
          role: 'worker',
          is_active: true 
        }
      });

      geographicPenetration[city] = {
        users: cityUsers,
        estimated_population: population,
        penetration_rate: Math.round((cityUsers / (population * 0.15)) * 10000) / 100 // Target 15% of population
      };

      roleDistributionByCity[city] = {
        clients: cityClients,
        workers: cityWorkers,
        client_worker_ratio: cityWorkers > 0 ? Math.round((cityClients / cityWorkers) * 100) / 100 : 0
      };
    }

    // Identify growth opportunities
    const underservedCities = Object.entries(geographicPenetration)
      .filter(([_, data]) => data.penetration_rate < 0.1)
      .map(([city, _]) => city);

    const highPotentialAreas = Object.entries(geographicPenetration)
      .filter(([_, data]) => data.penetration_rate > 0 && data.penetration_rate < 0.5)
      .map(([city, _]) => city);

    const expansionRecommendations = [];
    if (underservedCities.length > 0) {
      expansionRecommendations.push(`Focus marketing efforts in: ${underservedCities.slice(0, 3).join(', ')}`);
    }
    if (highPotentialAreas.length > 0) {
      expansionRecommendations.push(`Expand services in: ${highPotentialAreas.slice(0, 3).join(', ')}`);
    }
    expansionRecommendations.push('Target middle-class households with digital marketing');

    return {
      total_addressable_market: {
        metro_manila_population: 13000000,
        estimated_target_demographic: Math.round(estimatedTargetDemographic),
        current_user_base: totalUsers,
        market_penetration_percentage: Math.round((totalUsers / estimatedTargetDemographic) * 10000) / 100
      },
      geographic_penetration: geographicPenetration,
      role_distribution_by_city: roleDistributionByCity,
      growth_opportunities: {
        underserved_cities: underservedCities,
        high_potential_areas: highPotentialAreas,
        expansion_recommendations: expansionRecommendations
      }
    };
  }

}

// Initialize User Model
User.init(
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Authentication Fields
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'unique_email',
        msg: 'Email address already exists'
      },
      validate: {
        isEmail: {
          msg: 'Must be a valid email address'
        },
        len: {
          args: [5, 255],
          msg: 'Email must be between 5 and 255 characters'
        }
      },
      set(value: string) {
        // Always store email in lowercase
        this.setDataValue('email', value.toLowerCase().trim());
      }
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: {
        name: 'unique_phone',
        msg: 'Phone number already exists'
      },
      validate: {
        isValidPhoneNumber(value: string) {
          // Philippine phone number validation
          const phoneRegex = /^(\+63|0)9\d{9}$/;
          if (!phoneRegex.test(value)) {
            throw new Error('Must be a valid Philippine phone number');
          }
        }
      },
      set(value: string) {
        // Normalize phone number format
        let normalized = value.replace(/\s+/g, '').trim();
        if (normalized.startsWith('09')) {
          normalized = '+63' + normalized.substring(1);
        }
        this.setDataValue('phone', normalized);
      }
    },

password_hash: {
  type: DataTypes.STRING(255),
  allowNull: false,
  validate: {
    notEmpty: {
      msg: 'Password is required'
    }
  }
},
    // Personal Information
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: {
          args: [1, 100],
          msg: 'First name must be between 1 and 100 characters'
        },
        isValidName(value: string) {
          if (!/^[a-zA-Z\s'-]+$/.test(value)) {
            throw new Error('First name can only contain letters, spaces, hyphens, and apostrophes');
          }
        }
      },
      set(value: string) {
        // Capitalize first letter
        this.setDataValue('first_name', value.trim().charAt(0).toUpperCase() + value.trim().slice(1).toLowerCase());
      }
    },

    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: {
          args: [1, 100],
          msg: 'Last name must be between 1 and 100 characters'
        },
        isValidName(value: string) {
          if (!/^[a-zA-Z\s'-]+$/.test(value)) {
            throw new Error('Last name can only contain letters, spaces, hyphens, and apostrophes');
          }
        }
      },
      set(value: string) {
        // Capitalize first letter
        this.setDataValue('last_name', value.trim().charAt(0).toUpperCase() + value.trim().slice(1).toLowerCase());
      }
    },

    // Role and Status
    role: {
      type: DataTypes.ENUM('client', 'worker', 'admin'),
      allowNull: false,
      defaultValue: 'client',
      validate: {
        isIn: {
          args: [['client', 'worker', 'admin']],
          msg: 'Role must be client, worker, or admin'
        }
      }
    },

    // Verification Status
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Overall verification status (documents approved)'
    },

    is_phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Phone number verified via SMS'
    },

    is_email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Email address verified via link'
    },

    // Optional Profile Information
    profile_picture: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isValidUrl(value: string) {
          if (value) {
            try {
              new URL(value);
            } catch {
              throw new Error('Profile picture must be a valid URL');
            }
          }
        }
      }
    },

    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isAdult(value: string) {
          if (value) {
            const today = new Date();
            const birthDate = new Date(value);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            
            if (age < 18) {
              throw new Error('Must be at least 18 years old');
            }
          }
        }
      }
    },

    // Address Information
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Address must be less than 500 characters'
        }
      }
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'City must be less than 100 characters'
        }
      }
    },

    province: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'Province must be less than 100 characters'
        }
      }
    },

    postal_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        isValidPostalCode(value: string) {
          if (value && !/^\d{4,10}$/.test(value)) {
            throw new Error('Postal code must contain only numbers (4-10 digits)');
          }
        }
      }
    },

    // Emergency Contact
    emergency_contact_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: {
          args: [0, 200],
          msg: 'Emergency contact name must be less than 200 characters'
        }
      }
    },

    emergency_contact_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isValidEmergencyPhone(value: string) {
          if (value) {
            const phoneRegex = /^(\+63|0)9\d{9}$/;
            if (!phoneRegex.test(value)) {
              throw new Error('Emergency contact must be a valid Philippine phone number');
            }
          }
        }
      }
    },

    // Account Management
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last login timestamp'
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Account active status'
    },

    // Security Tokens
    verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Email verification token'
    },

    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Password reset token'
    },

    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Password reset token expiration'
    },

    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    
    // Indexes for performance
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        unique: true,
        fields: ['phone']
      },
      {
        fields: ['role']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['city', 'province']
      },
      {
        fields: ['created_at']
      }
    ],

    // Hooks for password hashing and data processing
    hooks: {
      beforeCreate: async (user: User) => {
        // Hash password before saving
        if (user.password_hash && !user.password_hash.startsWith('$2a$')) {
          user.password_hash = await User.hashPassword(user.password_hash);
        }
      },
      
      beforeUpdate: async (user: User) => {
        // Hash password before updating if changed
        if (user.changed('password_hash') && user.password_hash && !user.password_hash.startsWith('$2a$')) {
          user.password_hash = await User.hashPassword(user.password_hash);
        }
      },
      
      beforeSave: async (user: User) => {
        // Update verification status based on individual verifications
        if (user.is_phone_verified && user.is_email_verified) {
          // Auto-verify for clients with phone + email verification
          if (user.role === 'client') {
            user.is_verified = true;
          }
          // Workers require manual document verification
        }
      }
    },

    // Scopes for common queries
    scopes: {
      active: {
        where: {
          is_active: true
        }
      },
      verified: {
        where: {
          is_verified: true
        }
      },
      clients: {
        where: {
          role: 'client'
        }
      },
      workers: {
        where: {
          role: 'worker'
        }
      },
      withoutPassword: {
        attributes: {
          exclude: ['password_hash', 'verification_token', 'password_reset_token']
        }
      }
    }
  }
);

export default User;