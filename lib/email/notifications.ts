/**
 * Email Notification Functions
 * 
 * High-level functions for sending notification emails
 */

import { sendEmail } from './client';
import {
  analysisCompleteTemplate,
  analysisFailedTemplate,
  fixCompleteTemplate,
} from './templates';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devsentinel.com';

/**
 * Check if user has unsubscribed from emails
 */
async function isUserUnsubscribed(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email_notifications_enabled')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error checking user subscription status', { userId, error: error.message });
      return false; // Default to sending email if we can't check
    }

    return data?.email_notifications_enabled === false;
  } catch (error) {
    logger.error('Error checking user subscription status', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get user's GitHub email address
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('github_email')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user email', { userId, error: error.message });
      return null;
    }

    return data?.github_email || null;
  } catch (error) {
    logger.error('Error fetching user email', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Send analysis completion email
 */
export async function sendAnalysisCompleteEmail(params: {
  userId: string;
  projectId: string;
  projectName: string;
  healthScore: number;
  totalTests: number;
  passed: number;
  failed: number;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, projectId, projectName, healthScore, totalTests, passed, failed } = params;

  try {
    // Check if user has unsubscribed
    const unsubscribed = await isUserUnsubscribed(userId);
    if (unsubscribed) {
      logger.info('User has unsubscribed from emails', { userId });
      return { success: true }; // Not an error, just skip sending
    }

    // Get user's email
    const email = await getUserEmail(userId);
    if (!email) {
      logger.error('User email not found', { userId });
      return { success: false, error: 'User email not found' };
    }

    // Generate email content
    const reportUrl = `${APP_URL}/project/${projectId}/report`;
    const { html, text } = analysisCompleteTemplate({
      userId,
      projectName,
      healthScore,
      totalTests,
      passed,
      failed,
      reportUrl,
    });

    // Send email
    return await sendEmail({
      to: email,
      subject: `Analysis Complete: ${projectName} - Health Score ${healthScore}/100`,
      html,
      text,
    });
  } catch (error) {
    logger.error('Error sending analysis complete email', {
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send analysis failure email
 */
export async function sendAnalysisFailedEmail(params: {
  userId: string;
  projectId: string;
  projectName: string;
  errorMessage: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, projectId, projectName, errorMessage } = params;

  try {
    // Check if user has unsubscribed
    const unsubscribed = await isUserUnsubscribed(userId);
    if (unsubscribed) {
      logger.info('User has unsubscribed from emails', { userId });
      return { success: true };
    }

    // Get user's email
    const email = await getUserEmail(userId);
    if (!email) {
      logger.error('User email not found', { userId });
      return { success: false, error: 'User email not found' };
    }

    // Generate email content
    const projectUrl = `${APP_URL}/project/${projectId}`;
    const { html, text } = analysisFailedTemplate({
      userId,
      projectName,
      errorMessage,
      projectUrl,
    });

    // Send email
    return await sendEmail({
      to: email,
      subject: `Analysis Failed: ${projectName}`,
      html,
      text,
    });
  } catch (error) {
    logger.error('Error sending analysis failed email', {
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send fix completion email
 */
export async function sendFixCompleteEmail(params: {
  userId: string;
  projectName: string;
  bugType: string;
  filePath: string;
  prUrl: string;
  prNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, projectName, bugType, filePath, prUrl, prNumber } = params;

  try {
    // Check if user has unsubscribed
    const unsubscribed = await isUserUnsubscribed(userId);
    if (unsubscribed) {
      logger.info('User has unsubscribed from emails', { userId });
      return { success: true };
    }

    // Get user's email
    const email = await getUserEmail(userId);
    if (!email) {
      logger.error('User email not found', { userId });
      return { success: false, error: 'User email not found' };
    }

    // Generate email content
    const { html, text } = fixCompleteTemplate({
      userId,
      projectName,
      bugType,
      filePath,
      prUrl,
      prNumber,
    });

    // Send email
    return await sendEmail({
      to: email,
      subject: `Fix Complete: ${bugType} in ${projectName}`,
      html,
      text,
    });
  } catch (error) {
    logger.error('Error sending fix complete email', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
