import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service to handle sending emails.
 */
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Sends a welcome email with account credentials.
   * 
   * @param to Recipient email address.
   * @param name User's full name.
   * @param password Generated password.
   */
  async sendWelcomeEmail(to: string, name: string, password: string): Promise<void> {
    const mailOptions = {
      from: `"MIS Admin" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Welcome to MIS - Your Account Details',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #4f46e5;">Welcome to MIS, ${name}!</h2>
          <p>An administrator has created an account for you on the Management Information System (MIS).</p>
          <p>Here are your login credentials:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${to}</p>
            <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <p>Please log in and change your password as soon as possible.</p>
          <p style="color: #64748b; font-size: 0.875rem; margin-top: 40px;">This is an automated message. Please do not reply.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${to}`);
    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${to}:`, error);
    }
  }

  /**
   * Sends a password reset OTP to the user.
   * 
   * @param to Recipient email address.
   * @param name User's full name.
   * @param otp 6-digit one-time password.
   */
  async sendPasswordResetOTP(to: string, name: string, otp: string): Promise<void> {
    const mailOptions = {
      from: `"MIS Security" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Your Password Reset OTP - MIS',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5;">Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password for your MIS account. Use the following code to proceed:</p>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otp}</span>
          </div>
          <p>This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
          <p style="color: #64748b; font-size: 0.875rem; margin-top: 40px;">This is an automated security message. Please do not reply.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset OTP sent to ${to}`);
    } catch (error) {
      console.error(`❌ Failed to send password reset OTP to ${to}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }
}
