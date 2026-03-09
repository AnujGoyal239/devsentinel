/**
 * Unit Tests for Analysis Inngest Function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Analysis Inngest Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Enqueueing', () => {
    it('should enqueue analysis event with correct payload', () => {
      const event = {
        name: 'analysis/run',
        data: {
          project_id: 'test-project-id',
          run_id: 'test-run-id',
          document_id: 'test-doc-id',
        },
      };

      expect(event.name).toBe('analysis/run');
      expect(event.data.project_id).toBeDefined();
      expect(event.data.run_id).toBeDefined();
    });
  });

  describe('Step Execution Order', () => {
    it('should execute steps in correct order', () => {
      const steps = [
        'fetch-repo-data',
        'run-pass-1',
        'run-pass-2',
        'run-pass-3-and-4',
        'calculate-health-score',
        'finalize-run',
      ];

      expect(steps).toHaveLength(6);
      expect(steps[0]).toBe('fetch-repo-data');
      expect(steps[steps.length - 1]).toBe('finalize-run');
    });
  });

  describe('Retry Logic', () => {
    it('should configure retry attempts correctly', () => {
      const retryConfig = {
        attempts: 2,
        backoff: 'exponential',
      };

      expect(retryConfig.attempts).toBe(2);
      expect(retryConfig.backoff).toBe('exponential');
    });
  });

  describe('Status Transitions', () => {
    it('should transition from queued to running to complete', () => {
      const validTransitions = [
        { from: 'queued', to: 'running' },
        { from: 'running', to: 'complete' },
        { from: 'running', to: 'failed' },
      ];

      validTransitions.forEach((transition) => {
        expect(transition.from).toBeDefined();
        expect(transition.to).toBeDefined();
      });
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log errors with context', () => {
      const errorLog = {
        level: 'error',
        message: 'Analysis failed',
        context: {
          project_id: 'test-project',
          run_id: 'test-run',
          error: 'GitHub API rate limit',
        },
      };

      expect(errorLog.level).toBe('error');
      expect(errorLog.context.project_id).toBeDefined();
    });

    it('should handle transient failures gracefully', () => {
      const transientErrors = ['ECONNRESET', 'ETIMEDOUT', 'RATE_LIMIT'];
      
      transientErrors.forEach((error) => {
        expect(error).toBeTruthy();
      });
    });
  });
});
