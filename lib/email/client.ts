/**
 * Resend Email Client
 * 
 * Handles email sending via Resend API
 */

import { Resend } from 'resend';
import { logger } from '@/lib/monitoring/logger';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'DevSentinel <notifications@devsentinel.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devsentinel.com';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Sending email', {
      to: options.to,
      subject: options.subject,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      logger.error('Failed to send email', {
        error: error.message,
        to: options.to,
        subject: options.subject,
      });
      return { success: false, error: error.message };
    }

    logger.info('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      emailId: data?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get unsubscribe link for a user
 */
export function getUnsubscribeLink(userId: string): string {
  return `${APP_URL}/api/email/unsubscribe?userId=${userId}`;
}

export { resend };
