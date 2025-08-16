import crypto from 'crypto';
import User from '../models/User';

/**
 * Email Verification Service
 * Handles email verification tokens and verification logic
 */
export class EmailService {
  
  /**
   * Generate a secure verification token
   * @returns string - 32-character hex token
   */
  public static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate email verification token and update user
   * @param userId - User ID to generate token for
   * @returns Promise<string> - Generated token
   */
  public static async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = this.generateVerificationToken();
    
    await User.update(
      { verification_token: token },
      { where: { id: userId } }
    );

    console.log(`📧 Email verification token generated for user: ${userId}`);
    return token;
  }

  /**
   * Verify email with token
   * @param token - Verification token from email link
   * @returns Promise<{ success: boolean; user?: any; message: string }>
   */
  public static async verifyEmailToken(token: string): Promise<{
    success: boolean;
    user?: any;
    message: string;
  }> {
    try {
      const user = await User.findOne({
        where: { 
          verification_token: token,
          is_active: true 
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }

      if (user.is_email_verified) {
        return {
          success: true,
          user: user.getPublicProfile(),
          message: 'Email already verified'
        };
      }

      // Update user as email verified
      await user.update({
        is_email_verified: true,
        verification_token: undefined // Clear token after use
      });

      console.log(`✅ Email verified for user: ${user.email}`);

      return {
        success: true,
        user: user.getPublicProfile(),
        message: 'Email successfully verified'
      };

    } catch (error: any) {
      console.error('❌ Email verification error:', error);
      return {
        success: false,
        message: 'Email verification failed'
      };
    }
  }

  /**
   * Resend verification email (regenerate token)
   * @param email - User email to resend verification
   * @returns Promise<{ success: boolean; message: string; token?: string }>
   */
  public static async resendVerificationEmail(email: string): Promise<{
    success: boolean;
    message: string;
    token?: string;
  }> {
    try {
      const user = await User.findOne({
        where: { 
          email: email.toLowerCase(),
          is_active: true 
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (user.is_email_verified) {
        return {
          success: false,
          message: 'Email is already verified'
        };
      }

      const token = await this.generateEmailVerificationToken(user.id);

      console.log(`🔄 Verification email resent for: ${email}`);

      return {
        success: true,
        message: 'Verification email sent successfully',
        token // In production, this would trigger actual email sending
      };

    } catch (error: any) {
      console.error('❌ Resend verification error:', error);
      return {
        success: false,
        message: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Check if user needs email verification
   * @param userId - User ID to check
   * @returns Promise<{ needsVerification: boolean; user?: any }>
   */
  public static async checkVerificationStatus(userId: string): Promise<{
    needsVerification: boolean;
    user?: any;
  }> {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'is_email_verified', 'is_phone_verified', 'is_verified', 'role']
      });

      if (!user) {
        return { needsVerification: false };
      }

      return {
        needsVerification: !user.is_email_verified,
        user: {
          id: user.id,
          email: user.email,
          is_email_verified: user.is_email_verified,
          is_phone_verified: user.is_phone_verified,
          is_verified: user.is_verified,
          role: user.role
        }
      };

    } catch (error: any) {
      console.error('❌ Verification status check error:', error);
      return { needsVerification: false };
    }
  }

  /**
   * Get verification progress for user onboarding
   * @param userId - User ID to check progress
   * @returns Promise<VerificationProgress>
   */
  public static async getVerificationProgress(userId: string): Promise<{
    user_id: string;
    email_verified: boolean;
    phone_verified: boolean;
    profile_completed: boolean;
    overall_progress: number;
    next_steps: string[];
    can_access_full_features: boolean;
  }> {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: require('../models/Worker').default,
          as: 'workerProfile',
          required: false
        }]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Calculate profile completion
      let profileCompleted = false;
      let profileScore = 0;

      if (user.first_name && user.last_name) profileScore += 20;
      if (user.city && user.province) profileScore += 20;
      if (user.date_of_birth) profileScore += 15;
      if (user.emergency_contact_name && user.emergency_contact_phone) profileScore += 15;
      if (user.address) profileScore += 10;

      // Additional checks for workers
      if (user.role === 'worker' && user.workerProfile) {
        if (user.workerProfile.skills && user.workerProfile.skills.length >= 3) profileScore += 10;
        if (user.workerProfile.bio && user.workerProfile.bio.length >= 50) profileScore += 10;
      } else if (user.role === 'client') {
        profileScore += 20; // Clients need less profile info
      }

      profileCompleted = profileScore >= 80;

      // Calculate overall progress
      let overallProgress = 0;
      if (user.is_email_verified) overallProgress += 30;
      if (user.is_phone_verified) overallProgress += 30;
      if (profileCompleted) overallProgress += 40;

      // Generate next steps
      const nextSteps: string[] = [];
      if (!user.is_email_verified) nextSteps.push('Verify your email address');
      if (!user.is_phone_verified) nextSteps.push('Verify your phone number');
      if (!profileCompleted) {
        if (user.role === 'worker') {
          nextSteps.push('Complete your worker profile (skills, bio, experience)');
        } else {
          nextSteps.push('Complete your profile information');
        }
      }
      if (user.role === 'worker' && (!user.workerProfile || user.workerProfile.nbi_clearance_status !== 'approved')) {
        nextSteps.push('Submit NBI clearance for verification');
      }

      if (nextSteps.length === 0) {
        nextSteps.push('Your account is fully set up! Start exploring jobs.');
      }

      return {
        user_id: userId,
        email_verified: user.is_email_verified,
        phone_verified: user.is_phone_verified,
        profile_completed: profileCompleted,
        overall_progress: overallProgress,
        next_steps: nextSteps,
        can_access_full_features: overallProgress >= 60
      };

    } catch (error: any) {
      console.error('❌ Verification progress error:', error);
      throw error;
    }
  }

  /**
   * Send welcome email content (placeholder for actual email service)
   * @param user - User object
   * @param verificationToken - Email verification token
   * @returns WelcomeEmailContent
   */
  public static generateWelcomeEmailContent(user: any, verificationToken: string): {
    subject: string;
    htmlContent: string;
    textContent: string;
    verificationLink: string;
  } {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

    const subject = `Welcome to HelpQo! Please verify your email`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to HelpQo</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Welcome to HelpQo, ${user.first_name}!</h1>
          
          <p>Thank you for joining HelpQo, the Philippines' trusted marketplace for skilled professionals.</p>
          
          <p>To complete your registration as a <strong>${user.role}</strong>, please verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 5px;">
            ${verificationLink}
          </p>
          
          <h3>What's Next?</h3>
          <ul>
            ${user.role === 'worker' ? `
              <li>Complete your worker profile with skills and experience</li>
              <li>Upload your portfolio and set your rates</li>
              <li>Submit NBI clearance for verification</li>
              <li>Start receiving job opportunities!</li>
            ` : `
              <li>Complete your profile information</li>
              <li>Browse skilled professionals in your area</li>
              <li>Post your first job request</li>
              <li>Experience secure, quality service!</li>
            `}
          </ul>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            If you didn't create this account, please ignore this email.<br>
            Need help? Contact us at support@helpqo.ph
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            Best regards,<br>
            The HelpQo Team
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Welcome to HelpQo, ${user.first_name}!
      
      Thank you for joining HelpQo, the Philippines' trusted marketplace for skilled professionals.
      
      To complete your registration as a ${user.role}, please verify your email address by visiting:
      ${verificationLink}
      
      What's Next?
      ${user.role === 'worker' ? `
      - Complete your worker profile with skills and experience
      - Upload your portfolio and set your rates  
      - Submit NBI clearance for verification
      - Start receiving job opportunities!
      ` : `
      - Complete your profile information
      - Browse skilled professionals in your area
      - Post your first job request
      - Experience secure, quality service!
      `}
      
      If you didn't create this account, please ignore this email.
      Need help? Contact us at support@helpqo.ph
      
      Best regards,
      The HelpQo Team
    `;

    return {
      subject,
      htmlContent,
      textContent,
      verificationLink
    };
  }
}

export default EmailService;