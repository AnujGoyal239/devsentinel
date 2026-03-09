/**
 * PostHog Analytics Configuration
 * 
 * Tracks product usage, funnels, and feature adoption.
 * Use this to understand how users interact with DevSentinel.
 */

import posthog from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

/**
 * Initialize PostHog for client-side analytics.
 * Call this once in app/layout.tsx or a client component.
 */
export function initPostHog() {
  if (!posthogKey) {
    console.warn('NEXT_PUBLIC_POSTHOG_KEY not set. Analytics disabled.');
    return;
  }

  if (typeof window !== 'undefined') {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug();
        }
      },
      capture_pageview: true,
      capture_pageleave: true,
    });
  }
}

/**
 * Identify a user in PostHog
 */
export function identifyUser(userId: string, properties?: {
  username?: string;
  email?: string;
  created_at?: string;
}) {
  if (!posthogKey) return;
  posthog.identify(userId, properties);
}

/**
 * Track a custom event
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (!posthogKey) return;
  posthog.capture(eventName, properties);
}

/**
 * Reset user identity (on logout)
 */
export function resetUser() {
  if (!posthogKey) return;
  posthog.reset();
}

/**
 * Pre-defined event tracking functions
 */
export const analytics = {
  /**
   * Track user sign-in
   */
  userSignedIn(userId: string, username: string) {
    identifyUser(userId, { username });
    trackEvent('user_signed_in', { username });
  },

  /**
   * Track analysis started
   */
  analysisStarted(projectId: string, repoSize?: number, hasPrd?: boolean) {
    trackEvent('analysis_started', {
      project_id: projectId,
      repo_size: repoSize,
      has_prd: hasPrd,
    });
  },

  /**
   * Track analysis completed
   */
  analysisCompleted(
    projectId: string,
    durationMs: number,
    healthScore: number,
    findingCounts: {
      bug: number;
      security: number;
      production: number;
      prd_compliance: number;
    }
  ) {
    trackEvent('analysis_completed', {
      project_id: projectId,
      duration_ms: durationMs,
      health_score: healthScore,
      ...findingCounts,
    });
  },

  /**
   * Track analysis failed
   */
  analysisFailed(projectId: string, stage: string, errorType: string) {
    trackEvent('analysis_failed', {
      project_id: projectId,
      stage,
      error_type: errorType,
    });
  },

  /**
   * Track fix triggered
   */
  fixTriggered(findingId: string, severity: string, category: string) {
    trackEvent('fix_triggered', {
      finding_id: findingId,
      severity,
      category,
    });
  },

  /**
   * Track PR opened
   */
  fixPrOpened(findingId: string, durationMs: number, prUrl: string) {
    trackEvent('fix_pr_opened', {
      finding_id: findingId,
      duration_ms: durationMs,
      pr_url: prUrl,
    });
  },

  /**
   * Track report exported
   */
  reportExported(projectId: string, format: 'pdf' | 'json') {
    trackEvent('report_exported', {
      project_id: projectId,
      format,
    });
  },

  /**
   * Track page view
   */
  pageView(path: string) {
    trackEvent('$pageview', { path });
  },
};
