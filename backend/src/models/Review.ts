import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../config/database';

// Category Ratings for detailed feedback
export const RATING_CATEGORIES = [
  'quality',        // Work quality
  'punctuality',    // On-time arrival/completion
  'communication',  // Clear communication
  'professionalism',// Professional behavior
  'cleanliness',    // Work area cleanliness
  'value'          // Value for money
] as const;

export type RatingCategory = typeof RATING_CATEGORIES[number];

// Review Interface for TypeScript
export interface ReviewAttributes {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  
  // Rating System
  overall_rating: number;
  category_ratings?: Record<RatingCategory, number>;
  
  // Review Content
  review_title?: string;
  review_text: string;
  review_photos?: string[];
  
  // Response System
  response_text?: string;
  response_date?: Date;
  
  // Trust & Verification
  is_verified_review: boolean;
  helpful_count: number;
  unhelpful_count: number;
  
  // Moderation
  is_flagged: boolean;
  admin_notes?: string;
  is_public: boolean;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Review Model Class
class Review extends Model<ReviewAttributes> implements ReviewAttributes {
  public id!: string;
  public booking_id!: string;
  public reviewer_id!: string;
  public reviewee_id!: string;
  
  public overall_rating!: number;
  public category_ratings?: Record<RatingCategory, number>;
  
  public review_title?: string;
  public review_text!: string;
  public review_photos?: string[];
  
  public response_text?: string;
  public response_date?: Date;
  
  public is_verified_review!: boolean;
  public helpful_count!: number;
  public unhelpful_count!: number;
  
  public is_flagged!: boolean;
  public admin_notes?: string;
  public is_public!: boolean;
  
  public created_at!: Date;
  public updated_at!: Date;

  // Association properties (will be added by Sequelize)
  public booking?: any;
  public reviewer?: any;
  public reviewee?: any;

  // INSTANCE METHODS

  /**
   * Get review summary with key metrics
   */
  public getReviewSummary(): {
    id: string;
    overall_rating: number;
    category_average: number;
    title: string;
    excerpt: string;
    has_photos: boolean;
    has_response: boolean;
    helpful_ratio: number;
    is_verified: boolean;
  } {
    const categoryAverage = this.category_ratings 
      ? Object.values(this.category_ratings).reduce((sum, rating) => sum + rating, 0) / Object.keys(this.category_ratings).length
      : this.overall_rating;

    const totalVotes = this.helpful_count + this.unhelpful_count;
    const helpfulRatio = totalVotes > 0 ? this.helpful_count / totalVotes : 0;

    return {
      id: this.id,
      overall_rating: this.overall_rating,
      category_average: Math.round(categoryAverage * 10) / 10,
      title: this.review_title || 'Review',
      excerpt: this.review_text.substring(0, 150) + (this.review_text.length > 150 ? '...' : ''),
      has_photos: !!(this.review_photos && this.review_photos.length > 0),
      has_response: !!this.response_text,
      helpful_ratio: Math.round(helpfulRatio * 100) / 100,
      is_verified: this.is_verified_review
    };
  }

  /**
   * Add a response to the review
   */
  public async addResponse(responseText: string): Promise<void> {
    this.response_text = responseText.trim();
    this.response_date = new Date();
    await this.save();
  }

  /**
   * Mark review as helpful
   */
  public async markHelpful(): Promise<void> {
    this.helpful_count += 1;
    await this.save();
  }

  /**
   * Mark review as unhelpful
   */
  public async markUnhelpful(): Promise<void> {
    this.unhelpful_count += 1;
    await this.save();
  }

  /**
   * Flag review for moderation
   */
  public async flagForReview(reason?: string): Promise<void> {
    this.is_flagged = true;
    if (reason) {
      this.admin_notes = this.admin_notes 
        ? `${this.admin_notes}\n[${new Date().toISOString()}] Flagged: ${reason}`
        : `[${new Date().toISOString()}] Flagged: ${reason}`;
    }
    await this.save();
  }

  /**
   * Verify review (admin function)
   */
  public async verifyReview(adminId: string): Promise<void> {
    this.is_verified_review = true;
    this.admin_notes = this.admin_notes 
      ? `${this.admin_notes}\n[${new Date().toISOString()}] Verified by admin: ${adminId}`
      : `[${new Date().toISOString()}] Verified by admin: ${adminId}`;
    await this.save();
  }

  /**
   * Get public review data (exclude sensitive information)
   */
  public getPublicInfo(): Partial<ReviewAttributes> {
    return {
      id: this.id,
      overall_rating: this.overall_rating,
      category_ratings: this.category_ratings,
      review_title: this.review_title,
      review_text: this.review_text,
      review_photos: this.review_photos,
      response_text: this.response_text,
      response_date: this.response_date,
      is_verified_review: this.is_verified_review,
      helpful_count: this.helpful_count,
      unhelpful_count: this.unhelpful_count,
      created_at: this.created_at
    };
  }

  // STATIC METHODS

  /**
   * Calculate user's average rating
   */
  public static async calculateUserRating(userId: string): Promise<{
    average_rating: number;
    total_reviews: number;
    rating_breakdown: Record<number, number>;
    category_averages: Record<RatingCategory, number>;
  }> {
    const reviews = await Review.findAll({
      where: { 
        reviewee_id: userId,
        is_public: true 
      }
    });

    if (reviews.length === 0) {
      return {
        average_rating: 0,
        total_reviews: 0,
        rating_breakdown: {},
        category_averages: {} as Record<RatingCategory, number>
      };
    }

    // Calculate overall average
    const totalRating = reviews.reduce((sum, review) => sum + review.overall_rating, 0);
    const averageRating = totalRating / reviews.length;

    // Rating breakdown (1-5 stars)
    const ratingBreakdown: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      ratingBreakdown[i] = reviews.filter(review => review.overall_rating === i).length;
    }

    // Category averages
    const categoryAverages: Record<RatingCategory, number> = {} as Record<RatingCategory, number>;
    RATING_CATEGORIES.forEach(category => {
      const categoryReviews = reviews.filter(review => 
        review.category_ratings && review.category_ratings[category]
      );
      
      if (categoryReviews.length > 0) {
        const categoryTotal = categoryReviews.reduce((sum, review) => 
          sum + (review.category_ratings![category] || 0), 0
        );
        categoryAverages[category] = Math.round((categoryTotal / categoryReviews.length) * 10) / 10;
      }
    });

    return {
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: reviews.length,
      rating_breakdown: ratingBreakdown,
      category_averages: categoryAverages
    };
  }

  /**
   * Find reviews by rating
   */
  public static async findByRating(rating: number, limit: number = 20): Promise<Review[]> {
    return await Review.findAll({
      where: {
        overall_rating: rating,
        is_public: true
      },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Find helpful reviews
   */
  public static async findHelpfulReviews(limit: number = 10): Promise<Review[]> {
    return await Review.findAll({
      where: {
        is_public: true,
        helpful_count: { [Op.gte]: 3 }
      },
      order: [['helpful_count', 'DESC']],
      limit
    });
  }

  /**
   * Find reviews needing moderation
   */
  public static async findFlaggedReviews(): Promise<Review[]> {
    return await Review.findAll({
      where: { is_flagged: true },
      order: [['updated_at', 'ASC']]
    });
  }

  /**
   * Get platform review statistics
   */
  public static async getPlatformStats(): Promise<{
  total_reviews: number;
  average_platform_rating: number;
  verified_reviews: number;
  reviews_with_response: number;
  flagged_reviews: number;
  rating_distribution: Record<number, number>;
  monthly_review_count: number;
}> {
const totalReviews = await Review.count({ where: { is_public: true } });
const verifiedReviews = await Review.count({ where: { is_verified_review: true, is_public: true } });
const reviewsWithResponse = await Review.count({ 
  where: sequelize.literal("response_text IS NOT NULL AND is_public = true")
});
const flaggedReviews = await Review.count({ where: { is_flagged: true } });

  // Calculate average platform rating
  const allReviews = await Review.findAll({
    attributes: ['overall_rating'],
    where: { is_public: true }
  });

  const averageRating = allReviews.length > 0
    ? allReviews.reduce((sum, review) => sum + review.overall_rating, 0) / allReviews.length
    : 0;

  // Rating distribution
  const ratingDistribution: Record<number, number> = {};
  for (let i = 1; i <= 5; i++) {
    ratingDistribution[i] = allReviews.filter(review => review.overall_rating === i).length;
  }

  // Monthly review count (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const monthlyReviewCount = await Review.count({
    where: {
      is_public: true,
      created_at: { [Op.gte]: thirtyDaysAgo }
    }
  });

  return {
    total_reviews: totalReviews,
    average_platform_rating: Math.round(averageRating * 10) / 10,
    verified_reviews: verifiedReviews,
    reviews_with_response: reviewsWithResponse,
    flagged_reviews: flaggedReviews,
    rating_distribution: ratingDistribution,
    monthly_review_count: monthlyReviewCount
  };
}

  /**
   * Search reviews by text
   */
  public static async searchReviews(
    searchTerm: string, 
    options: {
      rating?: number;
      verified_only?: boolean;
      limit?: number;
    } = {}
  ): Promise<Review[]> {
    const whereCondition: any = {
      is_public: true,
      [Op.or]: [
        { review_title: { [Op.iLike]: `%${searchTerm}%` } },
        { review_text: { [Op.iLike]: `%${searchTerm}%` } }
      ]
    };

    if (options.rating) {
      whereCondition.overall_rating = options.rating;
    }

    if (options.verified_only) {
      whereCondition.is_verified_review = true;
    }

    return await Review.findAll({
      where: whereCondition,
      order: [['created_at', 'DESC']],
      limit: options.limit || 20
    });
  }
}

// Initialize Review Model
Review.init(
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Foreign Keys
    booking_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true, // One review per booking
      references: {
        model: 'bookings',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    reviewer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    reviewee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    // Rating System
    overall_rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: [1],
          msg: 'Rating must be between 1 and 5 stars'
        },
        max: {
          args: [5],
          msg: 'Rating must be between 1 and 5 stars'
        }
      }
    },

    category_ratings: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidCategoryRatings(value: any) {
          if (value && typeof value === 'object') {
            for (const [category, rating] of Object.entries(value)) {
              if (!RATING_CATEGORIES.includes(category as RatingCategory)) {
                throw new Error(`Invalid rating category: ${category}`);
              }
              if (typeof rating !== 'number' || rating < 1 || rating > 5) {
                throw new Error(`Category rating must be between 1 and 5 for ${category}`);
              }
            }
          }
        }
      }
    },

    // Review Content
    review_title: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: {
          args: [0, 200],
          msg: 'Review title cannot exceed 200 characters'
        }
      }
    },

    review_text: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Review text is required'
        },
        len: {
          args: [10, 2000],
          msg: 'Review text must be between 10 and 2000 characters'
        }
      }
    },

    review_photos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidPhotosArray(value: string[]) {
          if (value && Array.isArray(value)) {
            if (value.length > 5) {
              throw new Error('Maximum 5 review photos allowed');
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

    // Response System
    response_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Response text cannot exceed 1000 characters'
        }
      }
    },

    response_date: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Trust & Verification
    is_verified_review: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    helpful_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Helpful count cannot be negative'
        }
      }
    },

    unhelpful_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Unhelpful count cannot be negative'
        }
      }
    },

    // Moderation
    is_flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 2000],
          msg: 'Admin notes cannot exceed 2000 characters'
        }
      }
    },

    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    modelName: 'Review',
    tableName: 'reviews',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Hooks for data processing
    hooks: {
      beforeCreate: async (review: Review) => {
        // Clean and validate review text
        review.review_text = review.review_text.trim();
        
        // Capitalize review title if provided
        if (review.review_title) {
          review.review_title = review.review_title.trim()
            .charAt(0).toUpperCase() + review.review_title.trim().slice(1);
        }

        // Ensure reviewer and reviewee are different
        if (review.reviewer_id === review.reviewee_id) {
          throw new Error('Users cannot review themselves');
        }
      },

      beforeUpdate: async (review: Review) => {
        // Clean response text if being added
        if (review.changed('response_text') && review.response_text) {
          review.response_text = review.response_text.trim();
          if (!review.response_date) {
            review.response_date = new Date();
          }
        }
      }
    },

    // Indexes for performance
    indexes: [
      { unique: true, fields: ['booking_id'] },
      { fields: ['reviewer_id'] },
      { fields: ['reviewee_id'] },
      { fields: ['overall_rating'] },
      { fields: ['is_public'] },
      { fields: ['is_flagged'] },
      { fields: ['created_at'] },
      { fields: ['helpful_count'] }
    ],

    // Scopes for common queries
    scopes: {
      // Public reviews only
      public: {
        where: { is_public: true }
      },

      // Verified reviews only
      verified: {
        where: { 
          is_verified_review: true,
          is_public: true 
        }
      },

      // High-rated reviews (4+ stars)
      highRated: {
        where: {
          overall_rating: { [Op.gte]: 4 },
          is_public: true
        },
        order: [['overall_rating', 'DESC']]
      },

      // Recent reviews
      recent: {
        where: { is_public: true },
        order: [['created_at', 'DESC']]
      },

      // Reviews with responses
        withResponse: {
        where: sequelize.literal("response_text IS NOT NULL AND is_public = true")
        },

      // Helpful reviews
      helpful: {
        where: {
          helpful_count: { [Op.gte]: 3 },
          is_public: true
        },
        order: [['helpful_count', 'DESC']]
      },

      // Flagged reviews (admin)
      flagged: {
        where: { is_flagged: true },
        order: [['updated_at', 'ASC']]
      },

      // Include related data
      withBooking: {
        include: [{ model: sequelize.models.Booking, as: 'booking' }]
      },

      withUsers: {
        include: [
          { model: sequelize.models.User, as: 'reviewer' },
          { model: sequelize.models.User, as: 'reviewee' }
        ]
      },

      // Public info only (exclude sensitive data)
      publicInfo: {
        attributes: {
          exclude: ['admin_notes', 'is_flagged']
        }
      }
    }
  }
);

export default Review;