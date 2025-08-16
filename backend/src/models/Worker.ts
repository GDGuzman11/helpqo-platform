import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

// Define Worker attributes interface
export interface WorkerAttributes {
  id: string;
  user_id: string;
  
  // Professional Information
  skills: string[];
  hourly_rate?: number;
  experience_years: number;
  bio?: string;
  
  // Availability & Scheduling
  availability?: any; // JSONB - flexible schedule structure
  is_available: boolean;
  
  // Philippine Compliance
  nbi_clearance_status: 'pending' | 'approved' | 'rejected' | 'expired';
  nbi_clearance_number?: string;
  nbi_clearance_expires?: Date;
  
  // Service Areas & Coverage
  service_areas: string[];
  max_travel_distance: number;
  
  // Portfolio & Ratings
  portfolio_images: string[];
  rating_average: number;
  total_jobs_completed: number;
  total_reviews: number;
  
  // Financial
  preferred_payment_methods: string[];
  bank_account_verified: boolean;
  
  // Status & Verification
  profile_completion_percentage: number;
  is_featured: boolean;
  verification_level: 'basic' | 'verified' | 'premium';
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Define creation attributes (optional fields for creation)
export interface WorkerCreationAttributes extends Optional<WorkerAttributes,
  'id' | 'hourly_rate' | 'bio' | 'availability' | 'nbi_clearance_number' | 
  'nbi_clearance_expires' | 'experience_years' | 'is_available' | 
  'nbi_clearance_status' | 'service_areas' | 'max_travel_distance' |
  'portfolio_images' | 'rating_average' | 'total_jobs_completed' | 
  'total_reviews' | 'preferred_payment_methods' | 'bank_account_verified' |
  'profile_completion_percentage' | 'is_featured' | 'verification_level' |
  'created_at' | 'updated_at'
> {}

// Worker Model Class
class Worker extends Model<WorkerAttributes, WorkerCreationAttributes> implements WorkerAttributes {
  public id!: string;
  public user_id!: string;
  
  // Professional Information
  public skills!: string[];
  public hourly_rate?: number;
  public experience_years!: number;
  public bio?: string;
  
  // Availability & Scheduling
  public availability?: any;
  public is_available!: boolean;
  
  // Philippine Compliance
  public nbi_clearance_status!: 'pending' | 'approved' | 'rejected' | 'expired';
  public nbi_clearance_number?: string;
  public nbi_clearance_expires?: Date;
  
  // Service Areas & Coverage
  public service_areas!: string[];
  public max_travel_distance!: number;
  
  // Portfolio & Ratings
  public portfolio_images!: string[];
  public rating_average!: number;
  public total_jobs_completed!: number;
  public total_reviews!: number;
  
  // Financial
  public preferred_payment_methods!: string[];
  public bank_account_verified!: boolean;
  
  // Status & Verification
  public profile_completion_percentage!: number;
  public is_featured!: boolean;
  public verification_level!: 'basic' | 'verified' | 'premium';
  
  // Timestamps
  public created_at!: Date;
  public updated_at!: Date;

  // Instance Methods

  /**
   * Calculate and update profile completion percentage
   * @returns number - Completion percentage (0-100)
   */
  public calculateProfileCompletion(): number {
    let completion = 20; // Base for having a worker profile
    
    // Skills (+15%)
    if (this.skills && this.skills.length >= 3) completion += 15;
    
    // Bio (+10%)
    if (this.bio && this.bio.length >= 50) completion += 10;
    
    // Hourly Rate (+10%)
    if (this.hourly_rate && this.hourly_rate > 0) completion += 10;
    
    // Portfolio (+15%)
    if (this.portfolio_images && this.portfolio_images.length >= 2) completion += 15;
    
    // NBI Clearance (+20%)
    if (this.nbi_clearance_status === 'approved') completion += 20;
    
    // Service Areas (+10%)
    if (this.service_areas && this.service_areas.length >= 1) completion += 10;
    
    return Math.min(completion, 100);
  }

  /**
   * Check if worker is fully verified and ready for premium jobs
   * @returns boolean
   */
  public isFullyVerified(): boolean {
    return this.nbi_clearance_status === 'approved' && 
           this.profile_completion_percentage >= 80 &&
           this.skills.length >= 3;
  }

  /**
   * Get worker's current availability status
   * @returns object - Availability status and next available time
   */
  public getAvailabilityStatus() {
    return {
      isAvailable: this.is_available,
      nbiStatus: this.nbi_clearance_status,
      profileComplete: this.profile_completion_percentage >= 60,
      canAcceptJobs: this.is_available && 
                     this.nbi_clearance_status === 'approved' &&
                     this.profile_completion_percentage >= 60,
      nextAvailable: this.availability ? this.getNextAvailableSlot() : null
    };
  }

  /**
   * Get next available time slot (basic implementation)
   * @returns string | null
   */
  private getNextAvailableSlot(): string | null {
    // This would contain complex scheduling logic
    // For now, return a simple response
    if (this.is_available) {
      return 'Available now';
    }
    return 'Check availability calendar';
  }

  /**
   * Get worker's public profile for job matching
   * @returns object - Public worker profile
   */
  public getPublicProfile() {
    return {
      id: this.id,
      skills: this.skills,
      hourly_rate: this.hourly_rate,
      experience_years: this.experience_years,
      bio: this.bio,
      rating_average: this.rating_average,
      total_jobs_completed: this.total_jobs_completed,
      total_reviews: this.total_reviews,
      service_areas: this.service_areas,
      max_travel_distance: this.max_travel_distance,
      portfolio_images: this.portfolio_images,
      is_available: this.is_available,
      verification_level: this.verification_level,
      nbi_verified: this.nbi_clearance_status === 'approved',
      profile_completion: this.profile_completion_percentage,
      created_at: this.created_at
    };
  }

  /**
   * Update worker rating after job completion
   * @param newRating - Rating from 1-5
   * @param isNewReview - Whether this is a new review or update
   */
  public async updateRating(newRating: number, isNewReview: boolean = true): Promise<void> {
    if (isNewReview) {
      // Add new review
      const totalScore = this.rating_average * this.total_reviews;
      this.total_reviews += 1;
      this.rating_average = (totalScore + newRating) / this.total_reviews;
    }
    
    // Round to 2 decimal places
    this.rating_average = Math.round(this.rating_average * 100) / 100;
    await this.save();
  }

  /**
   * Check if worker can serve a specific location
   * @param targetCity - City where job is located
   * @param targetDistance - Distance from worker's base (optional)
   * @returns boolean
   */
  public canServeLocation(targetCity: string, targetDistance?: number): boolean {
    // Check if city is in service areas
    const cityMatch = this.service_areas.some(area => 
      area.toLowerCase().includes(targetCity.toLowerCase()) ||
      targetCity.toLowerCase().includes(area.toLowerCase())
    );
    
    // Check distance if provided
    const distanceOk = targetDistance ? targetDistance <= this.max_travel_distance : true;
    
    return cityMatch && distanceOk;
  }

  // Static Methods

  /**
   * Find workers by skills
   * @param requiredSkills - Array of required skills
   * @param exactMatch - Whether all skills must match
   * @returns Promise<Worker[]>
   */
  public static async findBySkills(
    requiredSkills: string[], 
    exactMatch: boolean = false
  ): Promise<Worker[]> {
    const whereCondition = exactMatch
      ? { skills: { [Op.contains]: requiredSkills } }
      : { skills: { [Op.overlap]: requiredSkills } };

    return Worker.findAll({
      where: {
        ...whereCondition,
        is_available: true,
        nbi_clearance_status: 'approved'
      },
      order: [['rating_average', 'DESC'], ['total_jobs_completed', 'DESC']]
    });
  }

  /**
   * Find available workers in specific area
   * @param city - Target city
   * @param maxDistance - Maximum travel distance
   * @returns Promise<Worker[]>
   */
  public static async findInArea(city: string, maxDistance?: number): Promise<Worker[]> {
    const whereCondition: any = {
      is_available: true,
      nbi_clearance_status: 'approved',
      service_areas: { [Op.contains]: [city] }
    };

    if (maxDistance) {
      whereCondition.max_travel_distance = { [Op.gte]: maxDistance };
    }

    return Worker.findAll({
      where: whereCondition,
      order: [['rating_average', 'DESC']]
    });
  }

  /**
   * Find top-rated workers
   * @param limit - Number of workers to return
   * @param minimumJobs - Minimum completed jobs
   * @returns Promise<Worker[]>
   */
  public static async findTopRated(limit: number = 10, minimumJobs: number = 5): Promise<Worker[]> {
    return Worker.findAll({
      where: {
        is_available: true,
        nbi_clearance_status: 'approved',
        total_jobs_completed: { [Op.gte]: minimumJobs },
        rating_average: { [Op.gte]: 4.0 }
      },
      order: [
        ['rating_average', 'DESC'],
        ['total_jobs_completed', 'DESC']
      ],
      limit
    });
  }

  /**
   * Get workers needing profile completion
   * @param threshold - Minimum completion percentage
   * @returns Promise<Worker[]>
   */
  public static async findIncompleteProfiles(threshold: number = 80): Promise<Worker[]> {
    return Worker.findAll({
      where: {
        profile_completion_percentage: { [Op.lt]: threshold }
      },
      order: [['created_at', 'DESC']]
    });
  }

  // ==================== BUSINESS INTELLIGENCE METHODS ====================

  /**
   * Get comprehensive worker marketplace analytics
   */
  public static async getWorkerMarketplaceAnalytics(): Promise<{
    total_workers: number;
    verification_distribution: {
      basic: number;
      verified: number;
      premium: number;
      nbi_approved: number;
      nbi_approval_rate: number;
    };
    availability_metrics: {
      available_workers: number;
      availability_rate: number;
      featured_workers: number;
    };
    performance_metrics: {
      average_rating: number;
      top_performers: number;
      profile_completion_rate: number;
      average_completion_percentage: number;
    };
    skill_demand_analysis: {
      most_demanded_skills: Array<{ skill: string; worker_count: number; percentage: number }>;
      skill_coverage: number;
      skills_gap: string[];
    };
    earning_insights: {
      average_hourly_rate: number;
      rate_distribution: {
        budget_friendly: number;    // ₱50-₱200
        mid_range: number;          // ₱201-₱500  
        premium: number;            // ₱501-₱1000
        luxury: number;             // ₱1000+
      };
      top_earner_threshold: number;
    };
  }> {
    const totalWorkers = await Worker.count();
    
    // Verification distribution
    const basicWorkers = await Worker.count({ where: { verification_level: 'basic' } });
    const verifiedWorkers = await Worker.count({ where: { verification_level: 'verified' } });
    const premiumWorkers = await Worker.count({ where: { verification_level: 'premium' } });
    const nbiApproved = await Worker.count({ where: { nbi_clearance_status: 'approved' } });

    // Availability metrics
    const availableWorkers = await Worker.count({ where: { is_available: true } });
    const featuredWorkers = await Worker.count({ where: { is_featured: true } });

    // Performance metrics
    const performanceStats = await Worker.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating_average')), 'avg_rating'],
        [sequelize.fn('AVG', sequelize.col('profile_completion_percentage')), 'avg_completion']
      ],
      raw: true
    }) as any[];

    const averageRating = parseFloat(performanceStats[0]?.avg_rating || '0');
    const averageCompletion = parseFloat(performanceStats[0]?.avg_completion || '0');
    const topPerformers = await Worker.count({ 
      where: { 
        rating_average: { [Op.gte]: 4.5 },
        total_reviews: { [Op.gte]: 5 }
      } 
    });

    // Skills demand analysis
    const skillsData = await Worker.findAll({
      attributes: ['skills'],
        where: {
          [Op.and]: [
            sequelize.literal("array_length(skills, 1) > 0")
          ]
        },
      raw: true
    }) as any[];

    const skillCounts: Record<string, number> = {};
    let totalSkillEntries = 0;

    skillsData.forEach((worker) => {
      if (worker.skills && Array.isArray(worker.skills)) {
        worker.skills.forEach((skill: string) => {
          const normalizedSkill = skill.trim().toLowerCase();
          skillCounts[normalizedSkill] = (skillCounts[normalizedSkill] || 0) + 1;
          totalSkillEntries++;
        });
      }
    });

    const mostDemandedSkills = Object.entries(skillCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        worker_count: count,
        percentage: Math.round((count / totalWorkers) * 100)
      }));

    // Identify skills gaps (common job categories with low worker coverage)
    const commonJobSkills = [
      'house cleaning', 'plumbing', 'electrical work', 'cooking', 
      'childcare', 'gardening', 'tutoring', 'computer repair'
    ];
    
    const skillsGap = commonJobSkills.filter(skill => 
      !skillCounts[skill] || skillCounts[skill] < totalWorkers * 0.1
    );

    // Earning insights
    const rateStats = await Worker.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('hourly_rate')), 'avg_rate'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN hourly_rate BETWEEN 50 AND 200 THEN 1 END")), 'budget_friendly'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN hourly_rate BETWEEN 201 AND 500 THEN 1 END")), 'mid_range'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN hourly_rate BETWEEN 501 AND 1000 THEN 1 END")), 'premium'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN hourly_rate > 1000 THEN 1 END")), 'luxury']
      ],
      raw: true
    }) as any[];

    const avgRate = parseFloat(rateStats[0]?.avg_rate || '0');
    const topEarnerThreshold = avgRate * 1.5; // 50% above average

    return {
      total_workers: totalWorkers,
      verification_distribution: {
        basic: basicWorkers,
        verified: verifiedWorkers,
        premium: premiumWorkers,
        nbi_approved: nbiApproved,
        nbi_approval_rate: totalWorkers > 0 ? Math.round((nbiApproved / totalWorkers) * 100) : 0
      },
      availability_metrics: {
        available_workers: availableWorkers,
        availability_rate: totalWorkers > 0 ? Math.round((availableWorkers / totalWorkers) * 100) : 0,
        featured_workers: featuredWorkers
      },
      performance_metrics: {
        average_rating: Math.round(averageRating * 10) / 10,
        top_performers: topPerformers,
        profile_completion_rate: totalWorkers > 0 ? Math.round((totalWorkers / totalWorkers) * 100) : 0,
        average_completion_percentage: Math.round(averageCompletion)
      },
      skill_demand_analysis: {
        most_demanded_skills: mostDemandedSkills,
        skill_coverage: Object.keys(skillCounts).length,
        skills_gap: skillsGap
      },
      earning_insights: {
        average_hourly_rate: Math.round(avgRate),
        rate_distribution: {
          budget_friendly: parseInt(rateStats[0]?.budget_friendly || '0'),
          mid_range: parseInt(rateStats[0]?.mid_range || '0'),
          premium: parseInt(rateStats[0]?.premium || '0'),
          luxury: parseInt(rateStats[0]?.luxury || '0')
        },
        top_earner_threshold: Math.round(topEarnerThreshold)
      }
    };
  }

  /**
   * Get individual worker performance benchmarking
   */
  public static async getWorkerPerformanceBenchmark(workerId: string): Promise<{
    worker_id: string;
    performance_score: number;
    benchmark_analysis: {
      rating_percentile: number;
      rate_percentile: number;
      experience_percentile: number;
      profile_completeness_percentile: number;
    };
    market_position: 'top_10_percent' | 'top_25_percent' | 'above_average' | 'average' | 'below_average';
    improvement_recommendations: string[];
    competitive_analysis: {
      similar_workers_count: number;
      avg_competitor_rate: number;
      rate_competitiveness: 'very_competitive' | 'competitive' | 'average' | 'expensive' | 'overpriced';
    };
  }> {
    const worker = await Worker.findByPk(workerId);
    if (!worker) {
      throw new Error('Worker not found');
    }

    // Get benchmark data
    const allWorkers = await Worker.findAll({
      attributes: ['rating_average', 'hourly_rate', 'experience_years', 'profile_completion_percentage'],
      raw: true
    });

    if (allWorkers.length === 0) {
      throw new Error('No benchmark data available');
    }

    // Calculate percentiles
    const calculatePercentile = (value: number, dataset: number[]): number => {
      const sorted = dataset.filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      
      const lowerCount = sorted.filter(v => v < value).length;
      return Math.round((lowerCount / sorted.length) * 100);
    };

    const ratings = allWorkers.map(w => w.rating_average || 0);
    const rates = allWorkers.map(w => w.hourly_rate || 0);
    const experiences = allWorkers.map(w => w.experience_years || 0);
    const completions = allWorkers.map(w => w.profile_completion_percentage || 0);

    const ratingPercentile = calculatePercentile(worker.rating_average || 0, ratings);
    const ratePercentile = calculatePercentile(worker.hourly_rate || 0, rates);
    const experiencePercentile = calculatePercentile(worker.experience_years || 0, experiences);
    const completionPercentile = calculatePercentile(worker.profile_completion_percentage || 0, completions);

    // Calculate overall performance score
    const performanceScore = Math.round((ratingPercentile + ratePercentile + experiencePercentile + completionPercentile) / 4);

    // Determine market position
    let marketPosition: 'top_10_percent' | 'top_25_percent' | 'above_average' | 'average' | 'below_average';
    if (performanceScore >= 90) marketPosition = 'top_10_percent';
    else if (performanceScore >= 75) marketPosition = 'top_25_percent';
    else if (performanceScore >= 60) marketPosition = 'above_average';
    else if (performanceScore >= 40) marketPosition = 'average';
    else marketPosition = 'below_average';

    // Generate improvement recommendations
    const recommendations: string[] = [];
    if (ratingPercentile < 50) recommendations.push('Focus on improving service quality to boost ratings');
    if (completionPercentile < 50) recommendations.push('Complete your profile to improve visibility');
    if (experiencePercentile < 30) recommendations.push('Highlight your experience and completed jobs');
    if (ratePercentile > 80) recommendations.push('Consider adjusting rates to be more competitive');
    if (ratePercentile < 30) recommendations.push('You may be able to increase your rates');

    if (recommendations.length === 0) {
      recommendations.push('Excellent performance! Focus on maintaining quality service');
    }

    // Competitive analysis (workers with similar skills)
    const similarWorkers = await Worker.findAll({
      where: {
        id: { [Op.ne]: workerId },
        skills: { [Op.overlap]: worker.skills || [] }
      },
      attributes: ['hourly_rate'],
      raw: true
    });

    const avgCompetitorRate = similarWorkers.length > 0
      ? similarWorkers.reduce((sum, w) => sum + (w.hourly_rate || 0), 0) / similarWorkers.length
      : 0;

    let rateCompetitiveness: 'very_competitive' | 'competitive' | 'average' | 'expensive' | 'overpriced';
    const rateRatio = avgCompetitorRate > 0 ? (worker.hourly_rate || 0) / avgCompetitorRate : 1;
    
    if (rateRatio <= 0.8) rateCompetitiveness = 'very_competitive';
    else if (rateRatio <= 0.95) rateCompetitiveness = 'competitive';
    else if (rateRatio <= 1.1) rateCompetitiveness = 'average';
    else if (rateRatio <= 1.3) rateCompetitiveness = 'expensive';
    else rateCompetitiveness = 'overpriced';

    return {
      worker_id: workerId,
      performance_score: performanceScore,
      benchmark_analysis: {
        rating_percentile: ratingPercentile,
        rate_percentile: ratePercentile,
        experience_percentile: experiencePercentile,
        profile_completeness_percentile: completionPercentile
      },
      market_position: marketPosition,
      improvement_recommendations: recommendations,
      competitive_analysis: {
        similar_workers_count: similarWorkers.length,
        avg_competitor_rate: Math.round(avgCompetitorRate),
        rate_competitiveness: rateCompetitiveness
      }
    };
  }

  /**
   * Get earning potential analysis for workers
   */
  public static async getEarningPotentialAnalysis(): Promise<{
    market_overview: {
      highest_earning_skills: Array<{ skill: string; avg_rate: number; worker_count: number }>;
      fastest_growing_categories: string[];
      premium_opportunities: string[];
    };
    rate_optimization: {
      undervalued_skills: Array<{ skill: string; suggested_rate_increase: number }>;
      oversaturated_skills: string[];
      emerging_opportunities: string[];
    };
    geographic_insights: {
      high_paying_areas: Array<{ city: string; avg_rate: number; worker_count: number }>;
      underserved_markets: string[];
      expansion_opportunities: string[];
    };
    recommendations: {
      for_new_workers: string[];
      for_existing_workers: string[];
      market_opportunities: string[];
    };
  }> {
    // Get skill-based earning data
    const skillEarnings = await Worker.findAll({
      attributes: [
        'skills',
        'hourly_rate',
        'service_areas'
      ],
      where: {
        hourly_rate: { [Op.ne]: undefined },
        [Op.and]: [
          sequelize.literal("array_length(skills, 1) > 0")
        ]
      },
      include: [{
        model: sequelize.models.User,
        as: 'user',
        attributes: ['city'],
        required: true
      }],
      raw: true
    }) as any[];

    // Analyze highest earning skills
    const skillRates: Record<string, { total: number; count: number; rates: number[] }> = {};
    const cityRates: Record<string, { total: number; count: number }> = {};

    skillEarnings.forEach((worker) => {
      const rate = worker.hourly_rate || 0;
      const city = worker['user.city'] || 'Unknown';

      // Process skills
      if (worker.skills && Array.isArray(worker.skills)) {
        worker.skills.forEach((skill: string) => {
          const normalizedSkill = skill.trim().toLowerCase();
          if (!skillRates[normalizedSkill]) {
            skillRates[normalizedSkill] = { total: 0, count: 0, rates: [] };
          }
          skillRates[normalizedSkill].total += rate;
          skillRates[normalizedSkill].count += 1;
          skillRates[normalizedSkill].rates.push(rate);
        });
      }

      // Process cities
      if (!cityRates[city]) {
        cityRates[city] = { total: 0, count: 0 };
      }
      cityRates[city].total += rate;
      cityRates[city].count += 1;
    });

    // Calculate highest earning skills
    const highestEarningSkills = Object.entries(skillRates)
      .map(([skill, data]) => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        avg_rate: Math.round(data.total / data.count),
        worker_count: data.count
      }))
      .filter(item => item.worker_count >= 2) // At least 2 workers for reliable data
      .sort((a, b) => b.avg_rate - a.avg_rate)
      .slice(0, 10);

    // Identify undervalued skills (high demand, low rates)
    const marketAverage = skillEarnings.reduce((sum, w) => sum + (w.hourly_rate || 0), 0) / skillEarnings.length;
    const undervaluedSkills = Object.entries(skillRates)
      .map(([skill, data]) => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        avg_rate: data.total / data.count,
        worker_count: data.count
      }))
      .filter(item => item.avg_rate < marketAverage * 0.8 && item.worker_count >= 3)
      .map(item => ({
        skill: item.skill,
        suggested_rate_increase: Math.round((marketAverage - item.avg_rate) * 0.5)
      }))
      .slice(0, 5);

    // High paying geographic areas
    const highPayingAreas = Object.entries(cityRates)
      .map(([city, data]) => ({
        city,
        avg_rate: Math.round(data.total / data.count),
        worker_count: data.count
      }))
      .filter(item => item.worker_count >= 2)
      .sort((a, b) => b.avg_rate - a.avg_rate)
      .slice(0, 8);

    // Generate recommendations
    const newWorkerRecommendations = [
      `Focus on high-earning skills: ${highestEarningSkills.slice(0, 3).map(s => s.skill).join(', ')}`,
      'Complete NBI clearance to access premium opportunities',
      'Start with competitive rates and increase based on reviews'
    ];

    const existingWorkerRecommendations = [
      'Regularly review and adjust your rates based on market trends',
      'Consider expanding to underserved geographic areas',
      'Invest in skill development for higher-paying categories'
    ];

    if (undervaluedSkills.length > 0) {
      existingWorkerRecommendations.push(
        `Consider rate increases for: ${undervaluedSkills.slice(0, 2).map(s => s.skill).join(', ')}`
      );
    }

    const marketOpportunities = [
      'Digital services and computer repair show strong growth potential',
      'Home healthcare and elderly care have increasing demand',
      'Eco-friendly cleaning and maintenance services are emerging'
    ];

    return {
      market_overview: {
        highest_earning_skills: highestEarningSkills,
        fastest_growing_categories: ['Computer Repair', 'Elderly Care', 'Home Healthcare'],
        premium_opportunities: ['Specialized Plumbing', 'Electrical Installation', 'Professional Cleaning']
      },
      rate_optimization: {
        undervalued_skills: undervaluedSkills,
        oversaturated_skills: ['Basic House Cleaning', 'General Labor'],
        emerging_opportunities: ['Smart Home Setup', 'Eco-friendly Services', 'Senior Care']
      },
      geographic_insights: {
        high_paying_areas: highPayingAreas,
        underserved_markets: ['Antipolo', 'Bacoor', 'General Santos'],
        expansion_opportunities: ['Expanding Metro Manila suburbs', 'Growing provincial cities']
      },
      recommendations: {
        for_new_workers: newWorkerRecommendations,
        for_existing_workers: existingWorkerRecommendations,
        market_opportunities: marketOpportunities
      }
    };
  }

  // Association Methods (added by Sequelize)
  public getUser!: () => Promise<any>;
  public setUser!: (user: any) => Promise<void>;
  public user?: any;
}

// Initialize Worker Model
Worker.init(
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Foreign Key to Users
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: {
        name: 'unique_user_worker',
        msg: 'User can only have one worker profile'
      },
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    // Professional Information
    skills: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
      validate: {
        hasMinimumSkills(value: string[]) {
          if (!value || value.length < 1) {
            throw new Error('Worker must have at least one skill');
          }
          if (value.length > 20) {
            throw new Error('Maximum 20 skills allowed');
          }
        },
        validSkills(value: string[]) {
          const invalidSkills = value.filter(skill => 
            !skill || skill.trim().length < 2 || skill.trim().length > 50
          );
          if (invalidSkills.length > 0) {
            throw new Error('Each skill must be 2-50 characters long');
          }
        }
      },
      set(value: string[]) {
        // Clean and capitalize skills
        const cleanedSkills = value.map(skill => 
          skill.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
        );
        this.setDataValue('skills', cleanedSkills);
      }
    },

    hourly_rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: [50], // Minimum ₱50 per hour
          msg: 'Hourly rate must be at least ₱50'
        },
        max: {
          args: [5000], // Maximum ₱5000 per hour
          msg: 'Hourly rate cannot exceed ₱5000'
        }
      }
    },

    experience_years: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Experience years cannot be negative'
        },
        max: {
          args: [50],
          msg: 'Experience years cannot exceed 50'
        }
      }
    },

    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Bio must be less than 1000 characters'
        }
      }
    },

    // Availability & Scheduling
    availability: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Weekly schedule and available time slots'
    },

    is_available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Currently accepting new jobs'
    },

    // Philippine Compliance
    nbi_clearance_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'NBI clearance verification status'
    },

    nbi_clearance_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'NBI clearance number must be less than 100 characters'
        }
      }
    },

    nbi_clearance_expires: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isFutureDate(value: string) {
          if (value && new Date(value) <= new Date()) {
            throw new Error('NBI clearance expiration must be in the future');
          }
        }
      }
    },

    // Service Areas & Coverage
    service_areas: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
      validate: {
        hasServiceAreas(value: string[]) {
          if (!value || value.length < 1) {
            throw new Error('Worker must serve at least one area');
          }
          if (value.length > 10) {
            throw new Error('Maximum 10 service areas allowed');
          }
        }
      },
      set(value: string[]) {
        // Clean and standardize area names
        const cleanedAreas = value.map(area => 
          area.trim().replace(/\b\w/g, l => l.toUpperCase())
        );
        this.setDataValue('service_areas', cleanedAreas);
      }
    },

    max_travel_distance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: {
          args: [1],
          msg: 'Travel distance must be at least 1 km'
        },
        max: {
          args: [100],
          msg: 'Travel distance cannot exceed 100 km'
        }
      },
      comment: 'Maximum travel distance in kilometers'
    },

    // Portfolio & Ratings
    portfolio_images: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
      validate: {
        maxImages(value: string[]) {
          if (value && value.length > 10) {
            throw new Error('Maximum 10 portfolio images allowed');
          }
        },
        validUrls(value: string[]) {
          if (value) {
            const invalidUrls = value.filter(url => {
              try {
                new URL(url);
                return false;
              } catch {
                return true;
              }
            });
            if (invalidUrls.length > 0) {
              throw new Error('All portfolio images must be valid URLs');
            }
          }
        }
      }
    },

    rating_average: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0.00],
          msg: 'Rating cannot be negative'
        },
        max: {
          args: [5.00],
          msg: 'Rating cannot exceed 5.00'
        }
      },
      comment: 'Average rating from 0.00 to 5.00'
    },

    total_jobs_completed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Jobs completed cannot be negative'
        }
      }
    },

    total_reviews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Total reviews cannot be negative'
        }
      }
    },

    // Financial
    preferred_payment_methods: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: ['GCash'],
      validate: {
        validMethods(value: string[]) {
          const validMethods = ['GCash', 'PayMaya', 'Bank Transfer', 'Cash'];
          const invalidMethods = value.filter(method => !validMethods.includes(method));
          if (invalidMethods.length > 0) {
            throw new Error(`Invalid payment methods: ${invalidMethods.join(', ')}`);
          }
        }
      }
    },

    bank_account_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Bank account verified for payouts'
    },

    // Status & Verification
    profile_completion_percentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Profile completion cannot be negative'
        },
        max: {
          args: [100],
          msg: 'Profile completion cannot exceed 100%'
        }
      }
    },

    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Featured in premium listings'
    },

    verification_level: {
      type: DataTypes.ENUM('basic', 'verified', 'premium'),
      allowNull: false,
      defaultValue: 'basic',
      comment: 'Worker verification tier'
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
    modelName: 'Worker',
    tableName: 'workers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    
    // Indexes for performance
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      },
      {
        fields: ['is_available']
      },
      {
        fields: ['nbi_clearance_status']
      },
      {
        fields: ['rating_average']
      },
      {
        fields: ['total_jobs_completed']
      },
      {
        fields: ['verification_level']
      },
      {
        fields: ['is_featured']
      },
      {
        name: 'worker_skills_gin',
        using: 'GIN',
        fields: ['skills']
      },
      {
        name: 'worker_service_areas_gin', 
        using: 'GIN',
        fields: ['service_areas']
      },
      {
        fields: ['created_at']
      }
    ],

    // Hooks for data processing
    hooks: {
      beforeSave: async (worker: Worker) => {
        // Update profile completion percentage
        worker.profile_completion_percentage = worker.calculateProfileCompletion();
        
        // Auto-upgrade verification level based on completion and NBI
        if (worker.nbi_clearance_status === 'approved' && 
            worker.profile_completion_percentage >= 90) {
          worker.verification_level = 'verified';
        }
      },
      
      afterCreate: async (worker: Worker) => {
        console.log(`✅ Worker profile created for user ${worker.user_id}`);
      },
      
      afterUpdate: async (worker: Worker) => {
        // Log important status changes
        if (worker.changed('nbi_clearance_status')) {
          console.log(`🛡️ NBI status updated for worker ${worker.id}: ${worker.nbi_clearance_status}`);
        }
        if (worker.changed('verification_level')) {
          console.log(`⭐ Verification level updated for worker ${worker.id}: ${worker.verification_level}`);
        }
      }
    },

    // Scopes for common queries
    scopes: {
      available: {
        where: {
          is_available: true,
          nbi_clearance_status: 'approved'
        }
      },
      verified: {
        where: {
          nbi_clearance_status: 'approved',
          verification_level: ['verified', 'premium']
        }
      },
      topRated: {
        where: {
          rating_average: { [Op.gte]: 4.0 },
          total_reviews: { [Op.gte]: 5 }
        },
        order: [['rating_average', 'DESC']]
      },
      featured: {
        where: {
          is_featured: true,
          is_available: true,
          nbi_clearance_status: 'approved'
        }
      },
      needsCompletion: {
        where: {
          profile_completion_percentage: { [Op.lt]: 80 }
        }
      },
      withoutSensitive: {
        attributes: {
          exclude: ['nbi_clearance_number']
        }
      }
    }
  }
);

export default Worker;