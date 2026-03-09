'use client';

/**
 * Client Providers
 * 
 * Initializes client-side services:
 * - Sentry error tracking
 * - PostHog analytics
 * - Theme management
 */

import { useEffect } from 'react';
import { initSentryClient } from '@/lib/monitoring/sentry';
import { initPostHog } from '@/lib/monitoring/posthog';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize client-side monitoring
    initSentryClient();
    initPostHog();
  }, []);

  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
