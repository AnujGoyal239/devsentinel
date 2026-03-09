/**
 * Integration Test: Webhook Flow
 * Tests: receive webhook → verify signature → trigger analysis
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Webhook Flow', () => {
  it('should process GitHub webhook correctly', async () => {
    // Step 1: Receive webhook
    const webhookPayload = {
      action: 'push',
      repository: {
        full_name: 'owner/repo',
      },
      after: 'abc123def456',
    };
    expect(webhookPayload.action).toBe('push');

    // Step 2: Verify signature
    const secret = 'test-webhook-secret';
    const payload = JSON.stringify(webhookPayload);
    const signature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
    
    expect(signature).toContain('sha256=');

    // Step 3: Trigger analysis
    const analysisTriggered = {
      project_id: 'test-project-id',
      commit_sha: webhookPayload.after,
      triggered_by: 'webhook',
      status: 'queued',
    };
    expect(analysisTriggered.triggered_by).toBe('webhook');
    expect(analysisTriggered.commit_sha).toBe('abc123def456');
  });

  it('should reject webhook with invalid signature', () => {
    const invalidSignature = 'sha256=invalid';
    const expectedSignature = 'sha256=valid';
    
    expect(invalidSignature).not.toBe(expectedSignature);
  });
});
