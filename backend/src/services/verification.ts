// backend/src/services/verification.ts
import crypto from 'crypto';
import  User  from '../models/User';
import  Worker  from '../models/Worker';

/**
 * Verification Service - Philippine Market Compliance
 * Handles phone verification, email verification, and account activation
 */

export interface VerificationCode {
  code: string;
  expires: Date;
  attempts: number;
  lastSent: Date;
}

export interface PhoneVerificationResult {
  success: boolean;
  message: string;
  phoneNumber?: string;
  codeExpiry?: Date;
  attemptsRemaining?: number;
}

export interface EmailVerificationResult {
  success: boolean;
  message: string;
  email?: string;
  tokenExpiry?: Date;
}

export interface AccountVerificationStatus {
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isFullyVerified: boolean;
  verificationLevel: 'none' | 'partial' | 'complete';
  missingVerifications: string[];
  canProceed: boolean;
}

class VerificationService {
  // Phone verification storage (in production, use Redis)
  private phoneVerificationCodes = new Map<string, VerificationCode>();
  
  // Email verification storage
  private emailVerificationTokens = new Map<string, VerificationCode>();

  /**
   * Generate Philippine phone verification code
   * Supports +639XXXXXXXXX format with 6-digit codes
   */
  generatePhoneVerificationCode(phoneNumber: string): VerificationCode {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    const verificationData: VerificationCode = {
      code,
      expires,
      attempts: 0,
      lastSent: new Date()
    };

    this.phoneVerificationCodes.set(phoneNumber, verificationData);
    
    console.log(`📱 Phone verification code for ${phoneNumber}: ${code}`);
    return verificationData;
  }

  /**
   * Send SMS verification code (Philippine networks)
   * In production: integrate with Twilio for Philippine carriers
   */
  async sendPhoneVerificationCode(
    phoneNumber: string, 
    userName: string
  ): Promise<PhoneVerificationResult> {
    try {
      // Validate Philippine phone number format
      const phoneRegex = /^(\+63|0)9\d{9}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return {
          success: false,
          message: 'Invalid Philippine phone number format. Use +639XXXXXXXXX or 09XXXXXXXXX'
        };
      }

      // Normalize to +639XXXXXXXXX format
      const normalizedPhone = phoneNumber.startsWith('0') 
        ? '+63' + phoneNumber.slice(1)
        : phoneNumber;

      // Check rate limiting (max 3 codes per 15 minutes)
      const existing = this.phoneVerificationCodes.get(normalizedPhone);
      if (existing && existing.attempts >= 3) {
        const timeSinceLastSent = Date.now() - existing.lastSent.getTime();
        if (timeSinceLastSent < 15 * 60 * 1000) {
          return {
            success: false,
            message: 'Too many verification attempts. Please wait 15 minutes before requesting another code.'
          };
        }
      }

      // Generate new verification code
      const verificationData = this.generatePhoneVerificationCode(normalizedPhone);

      // TODO: In production, integrate with Twilio
      // const twilioResult = await this.sendSMSViaTwilio(normalizedPhone, verificationData.code, userName);
      
      // For development: log the code
      console.log(`🇵🇭 SMS Verification for ${userName} (${normalizedPhone})`);
      console.log(`📝 Your HelpQo verification code: ${verificationData.code}`);
      console.log(`⏰ Expires at: ${verificationData.expires.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`);

      return {
        success: true,
        message: 'Verification code sent successfully to your Philippine mobile number',
        phoneNumber: normalizedPhone,
        codeExpiry: verificationData.expires,
        attemptsRemaining: 3 - (existing?.attempts || 0)
      };

    } catch (error) {
      console.error('❌ Phone verification error:', error);
      return {
        success: false,
        message: 'Failed to send verification code. Please try again.'
      };
    }
  }

  /**
   * Verify phone verification code
   */
  async verifyPhoneCode(
    phoneNumber: string, 
    code: string, 
    userId: string
  ): Promise<PhoneVerificationResult> {
    try {
      // Normalize phone number
      const normalizedPhone = phoneNumber.startsWith('0') 
        ? '+63' + phoneNumber.slice(1)
        : phoneNumber;

      const verificationData = this.phoneVerificationCodes.get(normalizedPhone);
      
      if (!verificationData) {
        return {
          success: false,
          message: 'No verification code found. Please request a new code.'
        };
      }

      // Check expiry
      if (new Date() > verificationData.expires) {
        this.phoneVerificationCodes.delete(normalizedPhone);
        return {
          success: false,
          message: 'Verification code has expired. Please request a new code.'
        };
      }

      // Check code
      if (verificationData.code !== code) {
        verificationData.attempts++;
        
        if (verificationData.attempts >= 5) {
          this.phoneVerificationCodes.delete(normalizedPhone);
          return {
            success: false,
            message: 'Too many failed attempts. Please request a new verification code.'
          };
        }

        return {
          success: false,
          message: `Invalid verification code. ${5 - verificationData.attempts} attempts remaining.`,
          attemptsRemaining: 5 - verificationData.attempts
        };
      }

      // Code is valid - update user
      await User.update(
        { 
          is_phone_verified: true,
          phone: normalizedPhone,
          last_login: new Date()
        },
        { where: { id: userId } }
      );

      // Clean up verification data
      this.phoneVerificationCodes.delete(normalizedPhone);

      console.log(`✅ Phone verified successfully for user ${userId}: ${normalizedPhone}`);

      return {
        success: true,
        message: 'Phone number verified successfully!',
        phoneNumber: normalizedPhone
      };

    } catch (error) {
      console.error('❌ Phone verification error:', error);
      return {
        success: false,
        message: 'Failed to verify phone number. Please try again.'
      };
    }
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(email: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const verificationData: VerificationCode = {
      code: token,
      expires,
      attempts: 0,
      lastSent: new Date()
    };

    this.emailVerificationTokens.set(email, verificationData);
    return token;
  }

  /**
   * Send email verification (Philippine market compliance)
   */
  async sendEmailVerification(
    email: string, 
    userName: string, 
    userId: string
  ): Promise<EmailVerificationResult> {
    try {
      const token = this.generateEmailVerificationToken(email);
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

      // TODO: In production, integrate with email service (SendGrid, AWS SES)
      console.log(`📧 Email Verification for ${userName} (${email})`);
      console.log(`🔗 Verification URL: ${verificationUrl}`);
      console.log(`🎫 Token: ${token}`);

      // Store verification token in user record
      await User.update(
        { verification_token: token },
        { where: { id: userId } }
      );

      return {
        success: true,
        message: 'Verification email sent successfully',
        email,
        tokenExpiry: this.emailVerificationTokens.get(email)?.expires
      };

    } catch (error) {
      console.error('❌ Email verification error:', error);
      return {
        success: false,
        message: 'Failed to send verification email. Please try again.'
      };
    }
  }

  /**
   * Verify email token
   */
  async verifyEmailToken(email: string, token: string): Promise<EmailVerificationResult> {
    try {
      const verificationData = this.emailVerificationTokens.get(email);
      
      if (!verificationData || verificationData.code !== token) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }

      if (new Date() > verificationData.expires) {
        this.emailVerificationTokens.delete(email);
        return {
          success: false,
          message: 'Verification token has expired. Please request a new verification email.'
        };
      }

      // Update user verification status
      await User.update(
        { 
          is_email_verified: true,
          is_verified: true, // Basic verification complete
          verification_token: undefined
        },
        { where: { email } }
      );

      // Clean up verification data
      this.emailVerificationTokens.delete(email);

      console.log(`✅ Email verified successfully: ${email}`);

      return {
        success: true,
        message: 'Email verified successfully!',
        email
      };

    } catch (error) {
      console.error('❌ Email verification error:', error);
      return {
        success: false,
        message: 'Failed to verify email. Please try again.'
      };
    }
  }

  /**
   * Get comprehensive account verification status
   */
  async getAccountVerificationStatus(userId: string): Promise<AccountVerificationStatus> {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Worker,
            as: 'workerProfile',
            required: false
          }
        ]
      });

      if (!user) {
        throw new Error('User not found');
      }

      const isPhoneVerified = user.is_phone_verified || false;
      const isEmailVerified = user.is_email_verified || false;
      const isFullyVerified = isPhoneVerified && isEmailVerified;

      const missingVerifications: string[] = [];
      if (!isPhoneVerified) missingVerifications.push('phone');
      if (!isEmailVerified) missingVerifications.push('email');

      // For workers, check additional requirements
      if (user.role === 'worker' && user.workerProfile) {
        const profileCompletion = await user.workerProfile.calculateProfileCompletion();
        if (profileCompletion < 80) {
          missingVerifications.push('profile_completion');
        }
        
        if (user.workerProfile.nbi_clearance_status !== 'approved') {
          missingVerifications.push('nbi_clearance');
        }
      }

      let verificationLevel: 'none' | 'partial' | 'complete' = 'none';
      if (isFullyVerified && missingVerifications.length === 0) {
        verificationLevel = 'complete';
      } else if (isPhoneVerified || isEmailVerified) {
        verificationLevel = 'partial';
      }

      const canProceed = isPhoneVerified && isEmailVerified;

      return {
        isPhoneVerified,
        isEmailVerified,
        isFullyVerified,
        verificationLevel,
        missingVerifications,
        canProceed
      };

    } catch (error) {
      console.error('❌ Get verification status error:', error);
      throw error;
    }
  }

  /**
   * Resend verification code/email with rate limiting
   */
  async resendVerification(
    type: 'phone' | 'email',
    identifier: string,
    userId: string,
    userName: string
  ): Promise<PhoneVerificationResult | EmailVerificationResult> {
    if (type === 'phone') {
      return this.sendPhoneVerificationCode(identifier, userName);
    } else {
      return this.sendEmailVerification(identifier, userName, userId);
    }
  }
}

// Export singleton instance
export const verificationService = new VerificationService();
export default verificationService;