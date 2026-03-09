/**
 * Email Unsubscribe Endpoint
 * 
 * Handles email unsubscribe requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Update user's email notification preference
    const { error } = await supabaseAdmin
      .from('users')
      .update({ email_notifications_enabled: false })
      .eq('id', userId);

    if (error) {
      logger.error('Error unsubscribing user', { userId, error: error.message });
      return NextResponse.json(
        { error: 'Failed to unsubscribe' },
        { status: 500 }
      );
    }

    logger.info('User unsubscribed from emails', { userId });

    // Return HTML page confirming unsubscribe
    return new NextResponse(
      `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - DevSentinel</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      max-width: 500px;
      background-color: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 20px;
      color: #0a0a0a;
    }
    p {
      font-size: 16px;
      color: #666;
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #0a0a0a;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
    .button:hover {
      background-color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive email notifications from DevSentinel.</p>
    <p>You can re-enable email notifications anytime from your account settings.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://devsentinel.com'}/dashboard" class="button">
      Go to Dashboard
    </a>
  </div>
</body>
</html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    logger.error('Error in unsubscribe endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
