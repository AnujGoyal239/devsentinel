/**
 * User Data Deletion Endpoint
 * 
 * Handles user account deletion requests
 * Deletes user record and all associated data within 30 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';
import { inngest } from '@/inngest/client';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('User deletion requested', { userId: user.id });

    // Schedule deletion for 30 days from now
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Mark user for deletion
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        deletion_scheduled_at: deletionDate.toISOString(),
        email_notifications_enabled: false, // Stop sending emails
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Error scheduling user deletion', {
        userId: user.id,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: 'Failed to schedule deletion' },
        { status: 500 }
      );
    }

    // Send event to Inngest to process deletion in 30 days
    await inngest.send({
      name: 'user/delete',
      data: {
        user_id: user.id,
        scheduled_at: deletionDate.toISOString(),
      },
    });

    logger.info('User deletion scheduled', {
      userId: user.id,
      deletionDate: deletionDate.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Your account will be deleted in 30 days',
      deletion_date: deletionDate.toISOString(),
    });
  } catch (error) {
    logger.error('Error in user deletion endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Cancel scheduled deletion
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('User deletion cancellation requested', { userId: user.id });

    // Remove deletion schedule
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        deletion_scheduled_at: null,
        email_notifications_enabled: true, // Re-enable emails
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Error cancelling user deletion', {
        userId: user.id,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: 'Failed to cancel deletion' },
        { status: 500 }
      );
    }

    logger.info('User deletion cancelled', { userId: user.id });

    return NextResponse.json({
      success: true,
      message: 'Account deletion cancelled',
    });
  } catch (error) {
    logger.error('Error in user deletion cancellation endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
