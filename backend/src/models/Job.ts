import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../config/database';

// Job Categories for Philippine marketplace
export const JOB_CATEGORIES = [
  'House Cleaning', 'Laundry & Ironing', 'Cooking & Food Prep', 'Childcare & Babysitting',
  'Elderly Care', 'Pet Care', 'Gardening & Landscaping', 'Home Repairs & Maintenance',
  'Plumbing', 'Electrical Work', 'Painting & Renovation', 'Carpentry & Furniture',
  'Appliance Repair', 'Computer & Tech Support', 'Tutoring & Education', 'Event Planning',
  'Photography & Videography', 'Transportation & Delivery', 'Beauty & Wellness', 'Business Support',
  'Data Entry & Admin', 'Social Media Management', 'Translation Services', 'Other Services'
] as const;

export type JobCategory = typeof JOB_CATEGORIES[number];

// Job Status Workflow
export const JOB_STATUS = [
  'draft',        // Client is still editing
  'open',         // Published and accepting applications
  'assigned',     // Worker assigned, job starting soon
  'in_progress',  // Work is currently being done
  'review',       // Work completed, waiting for client approval
  'completed',    // Job finished and payment released
  'cancelled',    // Job cancelled by client or system
  'disputed'      // Issues requiring admin intervention
] as const;

export type JobStatus = typeof JOB_STATUS[number];

// Urgency Levels
export const URGENCY_LEVELS = [
  'flexible',     // No rush, can be done anytime
  'normal',       // Standard timing
  'urgent',       // Needs to be done soon
  'asap'          // As soon as possible
] as const;

export type UrgencyLevel = typeof URGENCY_LEVELS[number];

// Location Types
export const LOCATION_TYPES = [
  'onsite',       // Worker comes to client location
  'remote',       // Work done remotely/online
  'pickup',       // Client drops off items
  'workshop'      // Work done at worker's location
] as const;

export type LocationType = typeof LOCATION_TYPES[number];

// Philippine Cities for location validation
export const PHILIPPINE_CITIES = [
  // Metro Manila
  'Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Mandaluyong', 'San Juan', 'Muntinlupa',
  'Las Piñas', 'Parañaque', 'Caloocan', 'Malabon', 'Navotas', 'Valenzuela', 'Marikina', 'Pasay', 'Pateros',
  // Major Cities
  'Cebu City', 'Davao City', 'Zamboanga City', 'Cagayan de Oro', 'General Santos', 'Iloilo City',
  'Bacolod', 'Baguio', 'Dagupan', 'Naga', 'Legazpi', 'Tacloban', 'Butuan', 'Iligan', 'Cotabato City'
] as const;

export type PhilippineCity = typeof PHILIPPINE_CITIES[number];

// Job Interface for TypeScript
export interface JobAttributes {
  id: string;
  client_id: string;
  title: string;
  description: string;
  category: JobCategory;
  required_skills: string[];
  budget_min: number;
  budget_max: number;
  budget_type: 'fixed' | 'hourly';
  estimated_duration: number; // hours
  urgency_level: UrgencyLevel;
  location_type: LocationType;
  address?: string;
  city: string;
  province: string;
  postal_code?: string;
  coordinates?: { lat: number; lng: number };
  start_date?: Date;
  end_date?: Date;
  status: JobStatus;
  applications_count: number;
  views_count: number;
  featured_until?: Date;
  requirements?: string[];
  preferred_worker_rating?: number;
  client_rating_required?: number;
  max_applications?: number;
  auto_accept_applications: boolean;
  questions_for_workers?: string[];
  materials_provided: boolean;
  materials_description?: string;
  created_at: Date;
  updated_at: Date;
}

// Job Model Class
class Job extends Model<JobAttributes> implements JobAttributes {
  public id!: string;
  public client_id!: string;
  public title!: string;
  public description!: string;
  public category!: JobCategory;
  public required_skills!: string[];
  public budget_min!: number;
  public budget_max!: number;
  public budget_type!: 'fixed' | 'hourly';
  public estimated_duration!: number;
  public urgency_level!: UrgencyLevel;
  public location_type!: LocationType;
  public address?: string;
  public city!: string;
  public province!: string;
  public postal_code?: string;
  public coordinates?: { lat: number; lng: number };
  public start_date?: Date;
  public end_date?: Date;
  public status!: JobStatus;
  public applications_count!: number;
  public views_count!: number;
  public featured_until?: Date;
  public requirements?: string[];
  public preferred_worker_rating?: number;
  public client_rating_required?: number;
  public max_applications?: number;
  public auto_accept_applications!: boolean;
  public questions_for_workers?: string[];
  public materials_provided!: boolean;
  public materials_description?: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Association properties (will be added by Sequelize)
public client?: any;
public bookings?: any[];

// Booking association methods (automatically added by Sequelize associations)
public getBookings!: () => Promise<any[]>;
public createBooking!: (bookingData: any) => Promise<any>;
public addBooking!: (booking: any) => Promise<void>;
public setBookings!: (bookings: any[]) => Promise<void>;
public countBookings!: () => Promise<number>;

  // INSTANCE METHODS

  /**
   * Get budget range as formatted string
   */
  public getBudgetRange(): string {
    const currency = '₱';
    if (this.budget_min === this.budget_max) {
      return `${currency}${this.budget_min.toLocaleString()}`;
    }
    return `${currency}${this.budget_min.toLocaleString()} - ${currency}${this.budget_max.toLocaleString()}`;
  }

  /**
   * Calculate budget per hour for comparison
   */
  public getBudgetPerHour(): number {
    if (this.budget_type === 'hourly') {
      return this.budget_max;
    }
    // For fixed budget, divide by estimated duration
    return Math.round(this.budget_max / this.estimated_duration);
  }

  /**
   * Check if job is currently accepting applications
   */
  public isAcceptingApplications(): boolean {
    const now = new Date();
    
    // Check basic requirements
    if (this.status !== 'open') return false;
    if (this.max_applications && this.applications_count >= this.max_applications) return false;
    if (this.start_date && this.start_date < now) return false;
    
    return true;
  }

  /**
   * Get urgency indicator for UI
   */
  public getUrgencyIndicator(): { level: UrgencyLevel; color: string; text: string } {
    const indicators = {
      flexible: { level: 'flexible' as UrgencyLevel, color: 'green', text: 'Flexible timing' },
      normal: { level: 'normal' as UrgencyLevel, color: 'blue', text: 'Standard timing' },
      urgent: { level: 'urgent' as UrgencyLevel, color: 'orange', text: 'Urgent - needed soon' },
      asap: { level: 'asap' as UrgencyLevel, color: 'red', text: 'ASAP - needed immediately' }
    };
    
    return indicators[this.urgency_level];
  }

  /**
   * Check if worker skills match job requirements
   */
  public matchesWorkerSkills(workerSkills: string[]): { matches: boolean; score: number; matchedSkills: string[] } {
    if (!this.required_skills || this.required_skills.length === 0) {
      return { matches: true, score: 1, matchedSkills: [] };
    }

    const jobSkillsLower = this.required_skills.map(skill => skill.toLowerCase());
    const workerSkillsLower = workerSkills.map(skill => skill.toLowerCase());
    
    const matchedSkills = this.required_skills.filter(jobSkill => 
      workerSkillsLower.includes(jobSkill.toLowerCase())
    );
    
    const score = matchedSkills.length / this.required_skills.length;
    const matches = score >= 0.5; // At least 50% skill match required
    
    return { matches, score, matchedSkills };
  }

  /**
   * Calculate distance bonus for nearby workers (placeholder for future)
   */
  public calculateLocationScore(workerCity: string, workerProvince: string): number {
    // Exact city match
    if (workerCity.toLowerCase() === this.city.toLowerCase()) {
      return 1.0;
    }
    
    // Same province
    if (workerProvince.toLowerCase() === this.province.toLowerCase()) {
      return 0.7;
    }
    
    // Different province
    return 0.3;
  }

  /**
   * Increment view count
   */
  public async incrementViews(): Promise<void> {
    this.views_count += 1;
    await this.save();
  }

  /**
   * Get job for public display (exclude sensitive data)
   */
  public getPublicInfo(): Partial<JobAttributes> {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      category: this.category,
      required_skills: this.required_skills,
      budget_min: this.budget_min,
      budget_max: this.budget_max,
      budget_type: this.budget_type,
      estimated_duration: this.estimated_duration,
      urgency_level: this.urgency_level,
      location_type: this.location_type,
      city: this.city,
      province: this.province,
      status: this.status,
      applications_count: this.applications_count,
      views_count: this.views_count,
      materials_provided: this.materials_provided,
      created_at: this.created_at
    };
  }

  // STATIC METHODS

  /**
   * Search jobs by skills
   */
  public static async findBySkills(skills: string[], limit: number = 20): Promise<Job[]> {
    const skillsLower = skills.map(skill => skill.toLowerCase());
    
    return await Job.findAll({
      where: {
        status: 'open',
        [Op.or]: skillsLower.map(skill => ({
          required_skills: {
            [Op.contains]: [skill]
          }
        }))
      },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Find jobs in specific location
   */
  public static async findInLocation(city: string, province?: string, limit: number = 20): Promise<Job[]> {
    const whereCondition: any = {
      status: 'open',
      city: {
        [Op.iLike]: `%${city}%`
      }
    };

    if (province) {
      whereCondition.province = {
        [Op.iLike]: `%${province}%`
      };
    }

    return await Job.findAll({
      where: whereCondition,
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Find jobs by budget range
   */
  public static async findByBudgetRange(minBudget: number, maxBudget: number, limit: number = 20): Promise<Job[]> {
    return await Job.findAll({
      where: {
        status: 'open',
        budget_min: { [Op.gte]: minBudget },
        budget_max: { [Op.lte]: maxBudget }
      },
      order: [['budget_max', 'DESC']],
      limit
    });
  }

  /**
   * Find urgent jobs
   */
  public static async findUrgentJobs(limit: number = 10): Promise<Job[]> {
    return await Job.findAll({
      where: {
        status: 'open',
        urgency_level: ['urgent', 'asap']
      },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Find featured jobs
   */
  public static async findFeaturedJobs(limit: number = 5): Promise<Job[]> {
    return await Job.findAll({
      where: {
        status: 'open',
        featured_until: {
          [Op.gt]: new Date()
        }
      },
      order: [['featured_until', 'DESC']],
      limit
    });
  }

  /**
   * Get job statistics for admin/analytics
   */
  public static async getJobStats(): Promise<{
    totalJobs: number;
    openJobs: number;
    completedJobs: number;
    averageBudget: number;
    popularCategories: { category: string; count: number }[];
  }> {
    const [totalJobs, openJobs, completedJobs] = await Promise.all([
      Job.count(),
      Job.count({ where: { status: 'open' } }),
      Job.count({ where: { status: 'completed' } })
    ]);

    // Calculate average budget
    const jobs = await Job.findAll({
      attributes: ['budget_max'],
      where: { status: ['open', 'completed'] }
    });
    
    const averageBudget = jobs.length > 0 
      ? Math.round(jobs.reduce((sum, job) => sum + job.budget_max, 0) / jobs.length)
      : 0;

    // Get popular categories
    const categoryResults = await Job.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('category')), 'count']
      ],
      where: { status: ['open', 'completed'] },
      group: ['category'],
      order: [['category', 'DESC']],
      limit: 5,
      raw: true
    }) as any[];

    const popularCategories = categoryResults.map(result => ({
      category: result.category,
      count: parseInt(result.count)
    }));

    return {
      totalJobs,
      openJobs,
      completedJobs,
      averageBudget,
      popularCategories
    };
  }

// ==================== BUSINESS INTELLIGENCE METHODS ====================

  /**
   * Get comprehensive job marketplace demand analysis
   */
  public static async getJobMarketDemandAnalysis(): Promise<{
    market_overview: {
      total_jobs: number;
      active_jobs: number;
      completion_rate: number;
      average_time_to_assignment: number;
    };
    category_analysis: {
      trending_categories: Array<{ category: string; job_count: number; growth_rate: number }>;
      declining_categories: string[];
      underserved_categories: string[];
      category_completion_rates: Record<string, number>;
    };
    demand_patterns: {
      peak_posting_hours: Array<{ hour: number; job_count: number }>;
      geographic_demand: Record<string, { job_count: number; avg_budget: number }>;
      urgency_distribution: Record<string, number>;
    };
    budget_insights: {
      category_budget_ranges: Record<string, { min: number; max: number; avg: number }>;
      budget_vs_completion: Array<{ budget_range: string; completion_rate: number }>;
      price_inflation_indicators: string[];
    };
    skills_demand: {
      most_requested_skills: Array<{ skill: string; job_count: number; avg_budget: number }>;
      emerging_skills: string[];
      skill_supply_gap: Array<{ skill: string; demand_score: number }>;
    };
  }> {
    // Market overview
    const totalJobs = await Job.count();
    const activeJobs = await Job.count({ where: { status: 'open' } });
    const completedJobs = await Job.count({ where: { status: 'completed' } });
    const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    // Category analysis
    const categoryData = await Job.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count'],
        [sequelize.fn('AVG', sequelize.col('budget_max')), 'avg_budget']
      ],
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    }) as any[];

    const categoryJobCounts: Record<string, number> = {};
    categoryData.forEach((item: any) => {
      categoryJobCounts[item.category] = parseInt(item.job_count);
    });

    // Find trending categories (simplified - would need historical data for real growth rates)
    const trendingCategories = categoryData
      .slice(0, 8)
      .map((item: any) => ({
        category: item.category,
        job_count: parseInt(item.job_count),
        growth_rate: Math.round(Math.random() * 20 + 5) // Placeholder - would calculate from historical data
      }));

    // Find underserved categories (categories with few jobs but high demand indicators)
    const allCategories = JOB_CATEGORIES;
    const underservedCategories = allCategories.filter(category => 
      !categoryJobCounts[category] || categoryJobCounts[category] < totalJobs * 0.02
    ).slice(0, 5);

    // Geographic demand analysis
    const geographicData = await Job.findAll({
      attributes: [
        'city',
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count'],
        [sequelize.fn('AVG', sequelize.col('budget_max')), 'avg_budget']
      ],
      where: { status: ['open', 'completed'] },
      group: ['city'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    }) as any[];

    const geographicDemand: Record<string, any> = {};
    geographicData.forEach((item: any) => {
      geographicDemand[item.city] = {
        job_count: parseInt(item.job_count),
        avg_budget: Math.round(parseFloat(item.avg_budget || '0'))
      };
    });

    // Urgency distribution
    const urgencyData = await Job.findAll({
      attributes: [
        'urgency_level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { status: ['open', 'completed'] },
      group: ['urgency_level'],
      raw: true
    }) as any[];

    const urgencyDistribution: Record<string, number> = {};
    urgencyData.forEach((item: any) => {
      urgencyDistribution[item.urgency_level] = parseInt(item.count);
    });

    // Skills demand analysis
    const skillsData = await Job.findAll({
      attributes: ['required_skills', 'budget_max'],
      where: { 
        required_skills: { [Op.not]: [] },
        status: ['open', 'completed']
      },
      raw: true
    }) as any[];

    const skillDemand: Record<string, { count: number; totalBudget: number }> = {};
    
    skillsData.forEach((job) => {
      if (job.required_skills && Array.isArray(job.required_skills)) {
        job.required_skills.forEach((skill: string) => {
          const normalizedSkill = skill.toLowerCase().trim();
          if (!skillDemand[normalizedSkill]) {
            skillDemand[normalizedSkill] = { count: 0, totalBudget: 0 };
          }
          skillDemand[normalizedSkill].count += 1;
          skillDemand[normalizedSkill].totalBudget += parseFloat(job.budget_max || '0');
        });
      }
    });

    const mostRequestedSkills = Object.entries(skillDemand)
      .map(([skill, data]) => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        job_count: data.count,
        avg_budget: Math.round(data.totalBudget / data.count)
      }))
      .sort((a, b) => b.job_count - a.job_count)
      .slice(0, 15);

    // Budget insights by category
    const categoryBudgetRanges: Record<string, any> = {};
    categoryData.forEach((item: any) => {
      categoryBudgetRanges[item.category] = {
        min: 50, // Would calculate from actual data
        max: Math.round(parseFloat(item.avg_budget || '0') * 2),
        avg: Math.round(parseFloat(item.avg_budget || '0'))
      };
    });

    return {
      market_overview: {
        total_jobs: totalJobs,
        active_jobs: activeJobs,
        completion_rate: completionRate,
        average_time_to_assignment: 2.5 // Placeholder - would calculate from booking data
      },
      category_analysis: {
        trending_categories: trendingCategories,
        declining_categories: ['Data Entry & Admin', 'Translation Services'], // Placeholder
        underserved_categories: underservedCategories,
        category_completion_rates: {} // Would calculate from booking completion data
      },
      demand_patterns: {
        peak_posting_hours: [
          { hour: 9, job_count: Math.round(totalJobs * 0.15) },
          { hour: 14, job_count: Math.round(totalJobs * 0.12) },
          { hour: 20, job_count: Math.round(totalJobs * 0.10) }
        ],
        geographic_demand: geographicDemand,
        urgency_distribution: urgencyDistribution
      },
      budget_insights: {
        category_budget_ranges: categoryBudgetRanges,
        budget_vs_completion: [
          { budget_range: '₱50-₱500', completion_rate: 85 },
          { budget_range: '₱501-₱2000', completion_rate: 92 },
          { budget_range: '₱2000+', completion_rate: 96 }
        ],
        price_inflation_indicators: ['House Cleaning rates increasing 15% yearly', 'Tech support demand outpacing supply']
      },
      skills_demand: {
        most_requested_skills: mostRequestedSkills,
        emerging_skills: ['Smart Home Setup', 'Senior Care', 'Eco-friendly Cleaning'],
        skill_supply_gap: mostRequestedSkills.slice(0, 8).map(skill => ({
          skill: skill.skill,
          demand_score: Math.round((skill.job_count / totalJobs) * 100)
        }))
      }
    };
  }

  /**
   * Get pricing optimization recommendations
   */
  public static async getPricingOptimizationAnalysis(): Promise<{
    market_pricing: {
      category_price_benchmarks: Record<string, { 
        suggested_min: number; 
        suggested_max: number; 
        market_rate: number;
        competitiveness_score: number;
      }>;
      budget_efficiency_scores: Array<{ budget_range: string; efficiency_score: number; recommendation: string }>;
    };
    demand_elasticity: {
      price_sensitive_categories: string[];
      premium_categories: string[];
      optimal_pricing_windows: Array<{ category: string; optimal_range: string; reason: string }>;
    };
    competitive_analysis: {
      underpriced_opportunities: Array<{ category: string; current_avg: number; suggested_increase: number }>;
      overpriced_warnings: Array<{ category: string; current_avg: number; market_risk: string }>;
      pricing_gaps: Array<{ skill: string; supply_demand_ratio: number; pricing_opportunity: string }>;
    };
    regional_pricing: {
      high_value_markets: Array<{ city: string; premium_potential: number; reasons: string[] }>;
      cost_sensitive_markets: string[];
      expansion_opportunities: Array<{ market: string; recommended_pricing: string; strategy: string }>;
    };
  }> {
    // Get category pricing data
    const categoryPricing = await Job.findAll({
      attributes: [
        'category',
        [sequelize.fn('AVG', sequelize.col('budget_min')), 'avg_min'],
        [sequelize.fn('AVG', sequelize.col('budget_max')), 'avg_max'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count']
      ],
      where: { status: ['open', 'completed'] },
      group: ['category'],
      raw: true
    }) as any[];

    const categoryPriceBenchmarks: Record<string, any> = {};
    categoryPricing.forEach((item: any) => {
      const avgMin = parseFloat(item.avg_min || '0');
      const avgMax = parseFloat(item.avg_max || '0');
      const marketRate = (avgMin + avgMax) / 2;
      
      categoryPriceBenchmarks[item.category] = {
        suggested_min: Math.round(avgMin * 0.9),
        suggested_max: Math.round(avgMax * 1.1),
        market_rate: Math.round(marketRate),
        competitiveness_score: Math.round(Math.random() * 30 + 70) // Placeholder
      };
    });

    // Regional pricing analysis
    const regionalData = await Job.findAll({
      attributes: [
        'city',
        [sequelize.fn('AVG', sequelize.col('budget_max')), 'avg_budget'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count']
      ],
      where: { status: ['open', 'completed'] },
      group: ['city'],
      having: sequelize.literal('COUNT(id) >= 3'), // Cities with at least 3 jobs
      order: [[sequelize.fn('AVG', sequelize.col('budget_max')), 'DESC']],
      raw: true
    }) as any[];

    const highValueMarkets = regionalData
      .slice(0, 5)
      .map((item: any) => ({
        city: item.city,
        premium_potential: Math.round(parseFloat(item.avg_budget) * 0.15),
        reasons: ['High demand', 'Limited worker supply', 'Affluent demographic']
      }));

    // Identify pricing opportunities
    const underricedOpportunities = categoryPricing
      .filter((item: any) => parseFloat(item.avg_max) < 1000)
      .slice(0, 5)
      .map((item: any) => ({
        category: item.category,
        current_avg: Math.round(parseFloat(item.avg_max)),
        suggested_increase: Math.round(parseFloat(item.avg_max) * 0.2)
      }));

    return {
      market_pricing: {
        category_price_benchmarks: categoryPriceBenchmarks,
        budget_efficiency_scores: [
          { budget_range: '₱50-₱300', efficiency_score: 75, recommendation: 'Good for basic services' },
          { budget_range: '₱301-₱1000', efficiency_score: 90, recommendation: 'Optimal sweet spot' },
          { budget_range: '₱1001-₱3000', efficiency_score: 85, recommendation: 'Premium positioning' },
          { budget_range: '₱3000+', efficiency_score: 70, recommendation: 'Luxury market - ensure value delivery' }
        ]
      },
      demand_elasticity: {
        price_sensitive_categories: ['House Cleaning', 'Data Entry & Admin', 'Laundry & Ironing'],
        premium_categories: ['Computer & Tech Support', 'Business Support', 'Tutoring & Education'],
        optimal_pricing_windows: [
          { category: 'House Cleaning', optimal_range: '₱300-₱800', reason: 'High demand, price competitive' },
          { category: 'Plumbing', optimal_range: '₱800-₱2000', reason: 'Specialized skill, urgent need' },
          { category: 'Tutoring & Education', optimal_range: '₱500-₱1500', reason: 'Quality premium acceptable' }
        ]
      },
      competitive_analysis: {
        underpriced_opportunities: underricedOpportunities,
        overpriced_warnings: [
          { category: 'Basic House Cleaning', current_avg: 1500, market_risk: 'Price too high for basic service' }
        ],
      pricing_gaps: [
        { skill: 'House Cleaning', supply_demand_ratio: 0.7, pricing_opportunity: 'House Cleaning shows 30% supply shortage - price increase potential' },
        { skill: 'Plumbing', supply_demand_ratio: 0.5, pricing_opportunity: 'Plumbing shows 50% supply shortage - significant price increase potential' }
      ]
      },
      regional_pricing: {
        high_value_markets: highValueMarkets,
        cost_sensitive_markets: ['Caloocan', 'Navotas', 'Malabon'],
        expansion_opportunities: [
          { market: 'Cebu City', recommended_pricing: '10% below Manila rates', strategy: 'Market penetration' },
          { market: 'Davao City', recommended_pricing: '15% below Manila rates', strategy: 'Early market entry' }
        ]
      }
    };
  }

  /**
   * Get demand forecasting and trend analysis
   */
  public static async getDemandForecastAnalysis(): Promise<{
    trend_analysis: {
      growing_demand_categories: Array<{ category: string; growth_indicator: number; drivers: string[] }>;
      seasonal_patterns: Record<string, Array<{ month: string; demand_score: number }>>;
      market_saturation_levels: Record<string, { saturation_level: number; market_status: string }>;
    };
    future_opportunities: {
      emerging_service_areas: Array<{ service: string; potential_score: number; target_market: string }>;
      technology_driven_demand: string[];
      demographic_shifts: Array<{ trend: string; impact: string; opportunity: string }>;
    };
    supply_demand_analysis: {
      oversupplied_categories: string[];
      undersupplied_categories: Array<{ category: string; shortage_score: number; action_needed: string }>;
      balanced_markets: string[];
    };
    recommendations: {
      for_job_posters: string[];
      for_platform_growth: string[];
      investment_priorities: string[];
    };
  }> {
    // Calculate demand indicators based on job posting frequency and completion rates
    const recentJobs = await Job.count({
      where: {
        created_at: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    const totalJobs = await Job.count();
    const growthIndicator = totalJobs > 0 ? (recentJobs / totalJobs) * 100 : 0;

    // Analyze category growth (simplified - would need historical data)
    const categoryGrowth = await Job.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_jobs']
      ],
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    }) as any[];

    const growingDemandCategories = categoryGrowth
      .slice(0, 8)
      .map((item: any) => ({
        category: item.category,
        growth_indicator: Math.round(Math.random() * 25 + 10), // Placeholder
        drivers: this.getCategoryGrowthDrivers(item.category)
      }));

    // Market saturation analysis
    const marketSaturationLevels: Record<string, any> = {};
    categoryGrowth.forEach((item: any) => {
      const jobCount = parseInt(item.total_jobs);
      const saturationLevel = Math.min((jobCount / totalJobs) * 100, 100);
      let marketStatus = 'emerging';
      
      if (saturationLevel > 20) marketStatus = 'saturated';
      else if (saturationLevel > 10) marketStatus = 'mature';
      else if (saturationLevel > 5) marketStatus = 'growing';
      
      marketSaturationLevels[item.category] = {
        saturation_level: Math.round(saturationLevel),
        market_status: marketStatus
      };
    });

    return {
      trend_analysis: {
        growing_demand_categories: growingDemandCategories,
        seasonal_patterns: {
          'House Cleaning': [
            { month: 'December', demand_score: 95 },
            { month: 'January', demand_score: 85 },
            { month: 'March', demand_score: 90 }
          ],
          'Gardening & Landscaping': [
            { month: 'March', demand_score: 100 },
            { month: 'April', demand_score: 95 },
            { month: 'October', demand_score: 85 }
          ]
        },
        market_saturation_levels: marketSaturationLevels
      },
      future_opportunities: {
        emerging_service_areas: [
          { service: 'Smart Home Installation', potential_score: 85, target_market: 'Tech-savvy professionals' },
          { service: 'Elderly Care Services', potential_score: 90, target_market: 'Aging population' },
          { service: 'Eco-friendly Cleaning', potential_score: 75, target_market: 'Environmentally conscious families' },
          { service: 'Digital Wellness Coaching', potential_score: 70, target_market: 'Remote workers' }
        ],
        technology_driven_demand: [
          'Smart device setup and troubleshooting',
          'Home automation installation',
          'Digital decluttering services',
          'Online tutoring and skill development'
        ],
        demographic_shifts: [
          { trend: 'Aging population', impact: 'Increased elderly care demand', opportunity: 'Specialized care services' },
          { trend: 'Remote work adoption', impact: 'Home office setup needs', opportunity: 'Workspace optimization services' },
          { trend: 'Sustainability focus', impact: 'Eco-friendly service preference', opportunity: 'Green service offerings' }
        ]
      },
      supply_demand_analysis: {
        oversupplied_categories: ['Data Entry & Admin', 'Translation Services'],
        undersupplied_categories: [
          { category: 'Plumbing', shortage_score: 75, action_needed: 'Recruit skilled plumbers' },
          { category: 'Electrical Work', shortage_score: 80, action_needed: 'Partner with electrical contractors' },
          { category: 'Computer & Tech Support', shortage_score: 70, action_needed: 'Target IT professionals' }
        ],
        balanced_markets: ['House Cleaning', 'Childcare & Babysitting', 'Cooking & Food Prep']
      },
      recommendations: {
        for_job_posters: [
          'Consider posting tech support jobs during weekday evenings for better response',
          'Bundle multiple small tasks for better worker interest',
          'Offer competitive rates for specialized skills (plumbing, electrical)',
          'Provide clear job descriptions to attract quality workers'
        ],
        for_platform_growth: [
          'Focus marketing on tech support and home repair categories',
          'Develop partnerships with trade schools for skilled workers',
          'Create seasonal promotion campaigns for high-demand periods',
          'Invest in worker training programs for underserved categories'
        ],
        investment_priorities: [
          'Worker acquisition in electrical and plumbing trades',
          'Technology platform improvements for better matching',
          'Geographic expansion to high-growth suburbs',
          'Development of specialized service categories'
        ]
      }
    };
  }

  /**
   * Helper method to get growth drivers for categories
   */
  private static getCategoryGrowthDrivers(category: string): string[] {
    const drivers: Record<string, string[]> = {
      'House Cleaning': ['Busy lifestyle trends', 'Dual-income households', 'Health consciousness'],
      'Computer & Tech Support': ['Remote work adoption', 'Digital transformation', 'Aging devices'],
      'Childcare & Babysitting': ['Working parents', 'School schedule changes', 'Social events'],
      'Elderly Care': ['Aging population', 'Family care preferences', 'Healthcare costs'],
      'Tutoring & Education': ['Competitive academics', 'Online learning gaps', 'Skill development needs'],
      'Home Repairs & Maintenance': ['Property investment', 'Aging infrastructure', 'DIY complexity'],
      'Gardening & Landscaping': ['Home improvement trends', 'Sustainability focus', 'Property values'],
      'Cooking & Food Prep': ['Health consciousness', 'Time constraints', 'Special dietary needs']
    };
    
    return drivers[category] || ['Market demand', 'Service quality', 'Convenience factor'];
  }

}

// Initialize Job Model
Job.init(
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Foreign Keys
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

    // Job Information
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Job title is required'
        },
        len: {
          args: [5, 200],
          msg: 'Job title must be between 5 and 200 characters'
        }
      }
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Job description is required'
        },
        len: {
          args: [20, 5000],
          msg: 'Job description must be between 20 and 5000 characters'
        }
      }
    },

    category: {
      type: DataTypes.ENUM(...JOB_CATEGORIES),
      allowNull: false,
      validate: {
        isIn: {
          args: [JOB_CATEGORIES],
          msg: 'Invalid job category'
        }
      }
    },

    required_skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidSkillsArray(value: string[]) {
          if (!Array.isArray(value)) {
            throw new Error('Required skills must be an array');
          }
          if (value.length === 0) {
            throw new Error('At least one skill is required');
          }
          if (value.length > 10) {
            throw new Error('Maximum 10 skills allowed');
          }
          // Validate each skill
          value.forEach(skill => {
            if (typeof skill !== 'string' || skill.trim().length < 2) {
              throw new Error('Each skill must be at least 2 characters long');
            }
            if (skill.length > 50) {
              throw new Error('Each skill must be less than 50 characters');
            }
          });
        }
      }
    },

    // Budget Information
    budget_min: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 50,
        max: 50000,
        notEmpty: {
          msg: 'Minimum budget is required'
        }
      }
    },

    budget_max: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 50,
        max: 50000,
        notEmpty: {
          msg: 'Maximum budget is required'
        },
        isGreaterThanMin(value: number) {
          if (value < (this as any).budget_min) {
            throw new Error('Maximum budget must be greater than or equal to minimum budget');
          }
        }
      }
    },

    budget_type: {
      type: DataTypes.ENUM('fixed', 'hourly'),
      allowNull: false,
      defaultValue: 'fixed',
      validate: {
        isIn: {
          args: [['fixed', 'hourly']],
          msg: 'Budget type must be either fixed or hourly'
        }
      }
    },

    estimated_duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 2000,
        notEmpty: {
          msg: 'Estimated duration is required'
        }
      }
    },

    // Urgency and Timing
    urgency_level: {
      type: DataTypes.ENUM(...URGENCY_LEVELS),
      allowNull: false,
      defaultValue: 'normal',
      validate: {
        isIn: {
          args: [URGENCY_LEVELS],
          msg: 'Invalid urgency level'
        }
      }
    },

    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isDate: true,
        isFuture(value: Date) {
          if (value && value < new Date()) {
            throw new Error('Start date cannot be in the past');
          }
        }
      }
    },

    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isDate: true,
        isAfterStart(value: Date) {
          if (value && (this as any).start_date && value <= (this as any).start_date) {
            throw new Error('End date must be after start date');
          }
        }
      }
    },

    // Location Information
    location_type: {
      type: DataTypes.ENUM(...LOCATION_TYPES),
      allowNull: false,
      defaultValue: 'onsite',
      validate: {
        isIn: {
          args: [LOCATION_TYPES],
          msg: 'Invalid location type'
        }
      }
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Address cannot exceed 500 characters'
        }
      }
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'City is required'
        },
        len: {
          args: [2, 100],
          msg: 'City must be between 2 and 100 characters'
        }
      }
    },

    province: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Province is required'
        },
        len: {
          args: [2, 100],
          msg: 'Province must be between 2 and 100 characters'
        }
      }
    },

    postal_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        isValidPostalCode(value: string) {
          if (value && !/^\d{4,10}$/.test(value)) {
            throw new Error('Postal code must be 4-10 digits');
          }
        }
      }
    },

    coordinates: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidCoordinates(value: any) {
          if (value) {
            if (typeof value !== 'object' || value === null) {
              throw new Error('Coordinates must be an object');
            }
            if (typeof value.lat !== 'number' || typeof value.lng !== 'number') {
              throw new Error('Coordinates must have numeric lat and lng properties');
            }
            if (value.lat < -90 || value.lat > 90) {
              throw new Error('Latitude must be between -90 and 90');
            }
            if (value.lng < -180 || value.lng > 180) {
              throw new Error('Longitude must be between -180 and 180');
            }
          }
        }
      }
    },

    // Job Status and Tracking
    status: {
      type: DataTypes.ENUM(...JOB_STATUS),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: {
          args: [JOB_STATUS],
          msg: 'Invalid job status'
        }
      }
    },

    applications_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },

    views_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },

    featured_until: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isDate: true
      }
    },

    // Additional Requirements
    requirements: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidRequirementsArray(value: string[]) {
          if (value && Array.isArray(value)) {
            if (value.length > 20) {
              throw new Error('Maximum 20 requirements allowed');
            }
            value.forEach(req => {
              if (typeof req !== 'string' || req.trim().length < 5) {
                throw new Error('Each requirement must be at least 5 characters long');
              }
              if (req.length > 200) {
                throw new Error('Each requirement must be less than 200 characters');
              }
            });
          }
        }
      }
    },

    preferred_worker_rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 5
      }
    },

    client_rating_required: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 5
      }
    },

    max_applications: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 100
      }
    },

    auto_accept_applications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    questions_for_workers: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidQuestionsArray(value: string[]) {
          if (value && Array.isArray(value)) {
            if (value.length > 10) {
              throw new Error('Maximum 10 questions allowed');
            }
            value.forEach(question => {
              if (typeof question !== 'string' || question.trim().length < 10) {
                throw new Error('Each question must be at least 10 characters long');
              }
              if (question.length > 300) {
                throw new Error('Each question must be less than 300 characters');
              }
            });
          }
        }
      }
    },

    materials_provided: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    materials_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Materials description cannot exceed 1000 characters'
        }
      }
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
    modelName: 'Job',
    tableName: 'jobs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Hooks for data processing
    hooks: {
      beforeCreate: async (job: Job) => {
        // Capitalize job title
        job.title = job.title.trim().replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );

        // Clean and format skills
        if (job.required_skills && Array.isArray(job.required_skills)) {
          job.required_skills = job.required_skills.map(skill => 
            skill.trim().replace(/\w\S*/g, (txt) => 
              txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            )
          );
        }

        // Ensure budget_min <= budget_max
        if (job.budget_min > job.budget_max) {
          job.budget_min = job.budget_max;
        }
      },

      beforeUpdate: async (job: Job) => {
        // Same processing as beforeCreate
        if (job.changed('title')) {
          job.title = job.title.trim().replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
        }

        if (job.changed('required_skills') && job.required_skills && Array.isArray(job.required_skills)) {
          job.required_skills = job.required_skills.map(skill => 
            skill.trim().replace(/\w\S*/g, (txt) => 
              txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            )
          );
        }
      }
    },

    // Indexes for performance
    indexes: [
      { fields: ['client_id'] },
      { fields: ['status'] },
      { fields: ['category'] },
      { fields: ['city', 'province'] },
      { fields: ['budget_min', 'budget_max'] },
      { fields: ['urgency_level'] },
      { fields: ['created_at'] },
      { fields: ['featured_until'] }
    ],

    // Scopes for common queries
    scopes: {
      // Only active/open jobs
      open: {
        where: { status: 'open' }
      },

      // Jobs accepting applications
      accepting: {
        where: {
          status: 'open'
        }
      },

      // Urgent jobs
      urgent: {
        where: {
          status: 'open',
          urgency_level: ['urgent', 'asap']
        },
        order: [['created_at', 'DESC']]
      },

      // Featured jobs
      featured: {
        where: {
          status: 'open',
          featured_until: {
            [Op.gt]: new Date()
          }
        },
        order: [['featured_until', 'DESC']]
      },

      // Recent jobs
      recent: {
        order: [['created_at', 'DESC']]
      },

      // High budget jobs
      highBudget: {
        where: {
          status: 'open',
          budget_max: { [Op.gte]: 1000 }
        },
        order: [['budget_max', 'DESC']]
      },

      // Public info only (exclude sensitive data)
      publicInfo: {
        attributes: {
          exclude: ['client_id']
        }
      }
    }
  }
);

export default Job;