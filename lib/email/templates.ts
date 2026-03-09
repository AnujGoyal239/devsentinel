/**
 * Email Templates
 * 
 * HTML email templates with DevSentinel branding
 */

import { getUnsubscribeLink } from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devsentinel.com';

/**
 * Base email template with DevSentinel branding
 */
function baseTemplate(content: string, userId: string): string {
  const unsubscribeLink = getUnsubscribeLink(userId);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevSentinel</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #0a0a0a;
      color: #ffffff;
      padding: 30px 40px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #0a0a0a;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #333;
    }
    .footer {
      background-color: #f5f5f5;
      padding: 30px 40px;
      text-align: center;
      font-size: 14px;
      color: #666;
    }
    .footer a {
      color: #0a0a0a;
      text-decoration: none;
    }
    .health-score {
      font-size: 48px;
      font-weight: 700;
      margin: 20px 0;
    }
    .health-score.green {
      color: #16a34a;
    }
    .health-score.yellow {
      color: #ca8a04;
    }
    .health-score.red {
      color: #dc2626;
    }
    .stats {
      display: flex;
      justify-content: space-around;
      margin: 30px 0;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 8px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DevSentinel</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© 2026 DevSentinel. All rights reserved.</p>
      <p>
        <a href="${APP_URL}">Visit Dashboard</a> • 
        <a href="${unsubscribeLink}">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Analysis completion success email template
 */
export function analysisCompleteTemplate(params: {
  userId: string;
  projectName: string;
  healthScore: number;
  totalTests: number;
  passed: number;
  failed: number;
  reportUrl: string;
}): { html: string; text: string } {
  const { userId, projectName, healthScore, totalTests, passed, failed, reportUrl } = params;

  const healthScoreClass = healthScore >= 80 ? 'green' : healthScore >= 50 ? 'yellow' : 'red';

  const html = baseTemplate(
    `
      <h2>Analysis Complete: ${projectName}</h2>
      <p>Your code analysis has finished successfully!</p>
      
      <div style="text-align: center;">
        <div class="health-score ${healthScoreClass}">${healthScore}/100</div>
        <p style="font-size: 18px; color: #666;">Health Score</p>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-value" style="color: #16a34a;">${passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #dc2626;">${failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalTests}</div>
          <div class="stat-label">Total</div>
        </div>
      </div>

      <p>Your analysis found ${failed} issue${failed !== 1 ? 's' : ''} across bug detection, security audit, and production readiness checks.</p>

      <div style="text-align: center;">
        <a href="${reportUrl}" class="button">View Full Report</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        This analysis was run on <strong>${projectName}</strong>. You can trigger fixes for individual findings directly from the report.
      </p>
    `,
    userId
  );

  const text = `
Analysis Complete: ${projectName}

Your code analysis has finished successfully!

Health Score: ${healthScore}/100
Passed: ${passed}
Failed: ${failed}
Total: ${totalTests}

Your analysis found ${failed} issue${failed !== 1 ? 's' : ''} across bug detection, security audit, and production readiness checks.

View Full Report: ${reportUrl}

This analysis was run on ${projectName}. You can trigger fixes for individual findings directly from the report.

---
© 2026 DevSentinel. All rights reserved.
Visit Dashboard: ${APP_URL}
Unsubscribe: ${getUnsubscribeLink(userId)}
  `.trim();

  return { html, text };
}

/**
 * Analysis failure email template
 */
export function analysisFailedTemplate(params: {
  userId: string;
  projectName: string;
  errorMessage: string;
  projectUrl: string;
}): { html: string; text: string } {
  const { userId, projectName, errorMessage, projectUrl } = params;

  const html = baseTemplate(
    `
      <h2>Analysis Failed: ${projectName}</h2>
      <p>Unfortunately, your code analysis encountered an error and could not complete.</p>
      
      <div style="padding: 20px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b; font-weight: 600;">Error Details:</p>
        <p style="margin: 10px 0 0 0; color: #7f1d1d;">${errorMessage}</p>
      </div>

      <p>This could be due to:</p>
      <ul>
        <li>Repository access issues</li>
        <li>Invalid PRD document format</li>
        <li>Temporary service disruption</li>
        <li>Repository size exceeding limits</li>
      </ul>

      <div style="text-align: center;">
        <a href="${projectUrl}" class="button">Try Again</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        If this issue persists, please contact support or check your repository settings.
      </p>
    `,
    userId
  );

  const text = `
Analysis Failed: ${projectName}

Unfortunately, your code analysis encountered an error and could not complete.

Error Details:
${errorMessage}

This could be due to:
- Repository access issues
- Invalid PRD document format
- Temporary service disruption
- Repository size exceeding limits

Try Again: ${projectUrl}

If this issue persists, please contact support or check your repository settings.

---
© 2026 DevSentinel. All rights reserved.
Visit Dashboard: ${APP_URL}
Unsubscribe: ${getUnsubscribeLink(userId)}
  `.trim();

  return { html, text };
}

/**
 * Fix completion email template
 */
export function fixCompleteTemplate(params: {
  userId: string;
  projectName: string;
  bugType: string;
  filePath: string;
  prUrl: string;
  prNumber: number;
}): { html: string; text: string } {
  const { userId, projectName, bugType, filePath, prUrl, prNumber } = params;

  const html = baseTemplate(
    `
      <h2>Fix Complete: ${projectName}</h2>
      <p>Great news! DevSentinel has successfully created a pull request to fix an issue in your code.</p>
      
      <div style="padding: 20px; background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #166534; font-weight: 600;">Issue Fixed:</p>
        <p style="margin: 10px 0 0 0; color: #15803d;">${bugType} in ${filePath}</p>
      </div>

      <p>A pull request has been opened on GitHub:</p>
      <p style="font-size: 18px; font-weight: 600; margin: 20px 0;">
        PR #${prNumber}
      </p>

      <div style="text-align: center;">
        <a href="${prUrl}" class="button">Review Pull Request</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        The fix has been tested in an isolated sandbox environment. Please review the changes and merge when ready.
      </p>

      <p style="font-size: 14px; color: #666;">
        <strong>Note:</strong> DevSentinel never auto-merges pull requests. You maintain full control over what gets merged into your codebase.
      </p>
    `,
    userId
  );

  const text = `
Fix Complete: ${projectName}

Great news! DevSentinel has successfully created a pull request to fix an issue in your code.

Issue Fixed:
${bugType} in ${filePath}

A pull request has been opened on GitHub:
PR #${prNumber}

Review Pull Request: ${prUrl}

The fix has been tested in an isolated sandbox environment. Please review the changes and merge when ready.

Note: DevSentinel never auto-merges pull requests. You maintain full control over what gets merged into your codebase.

---
© 2026 DevSentinel. All rights reserved.
Visit Dashboard: ${APP_URL}
Unsubscribe: ${getUnsubscribeLink(userId)}
  `.trim();

  return { html, text };
}
