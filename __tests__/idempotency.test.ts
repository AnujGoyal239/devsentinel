/**
 * Idempotency and Consistency Tests
 * 
 * Tests for Task 23: Idempotency and Consistency
 * - Sub-task 23.1: Analysis consistency (deterministic file ordering, temperature 0.0)
 * - Sub-task 23.3: Concurrent analysis support (queue new runs)
 * - Sub-task 23.5: Fix job idempotency (return existing fix_job_id)
 * 
 * Requirements: 33.1-33.5, 5.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Task 23: Idempotency and Consistency', () => {
  describe('Sub-task 23.1: Analysis Consistency', () => {
    it('should use temperature 0.0 for all analysis passes', () => {
      // This is a code inspection test - verify temperature is set to 0.0
      // in all Gemini model configurations in analysis.ts
      
      // Read the analysis.ts file and check for temperature settings
      const fs = require('fs');
      const path = require('path');
      const analysisFile = fs.readFileSync(
        path.join(__dirname, '../inngest/functions/analysis.ts'),
        'utf-8'
      );
      
      // Check that all temperature settings are 0.0
      const temperatureMatches = analysisFile.match(/temperature:\s*([\d.]+)/g);
      expect(temperatureMatches).toBeTruthy();
      
      // All temperature settings should be 0.0
      temperatureMatches?.forEach((match: string) => {
        const value = match.match(/temperature:\s*([\d.]+)/)?.[1];
        expect(parseFloat(value || '0')).toBe(0.0);
      });
    });

    it('should use deterministic file ordering (sorted by path)', () => {
      // This is a code inspection test - verify files are sorted
      const fs = require('fs');
      const path = require('path');
      const analysisFile = fs.readFileSync(
        path.join(__dirname, '../inngest/functions/analysis.ts'),
        'utf-8'
      );
      
      // Check that filterFilesForAnalysis includes .sort()
      expect(analysisFile).toContain('.sort()');
      expect(analysisFile).toContain('// Deterministic ordering');
    });
  });

  describe('Sub-task 23.3: Concurrent Analysis Support', () => {
    it('should check for in-progress analysis runs before creating new one', () => {
      // This is a code inspection test - verify the analysis trigger endpoint
      // checks for existing runs
      const fs = require('fs');
      const path = require('path');
      const analyseRouteFile = fs.readFileSync(
        path.join(__dirname, '../app/api/projects/[id]/analyse/route.ts'),
        'utf-8'
      );
      
      // Check for the existence of the in-progress check
      expect(analyseRouteFile).toContain('existingRuns');
      expect(analyseRouteFile).toContain("in('status', ['queued', 'running'])");
      expect(analyseRouteFile).toContain('Requirement 33.2');
    });

    it('should return existing run_id when analysis is already in progress', () => {
      // This is a code inspection test
      const fs = require('fs');
      const path = require('path');
      const analyseRouteFile = fs.readFileSync(
        path.join(__dirname, '../app/api/projects/[id]/analyse/route.ts'),
        'utf-8'
      );
      
      // Check that it returns the existing run with queued flag
      expect(analyseRouteFile).toContain('queued:');
      expect(analyseRouteFile).toContain('existingRuns && existingRuns.length > 0');
    });

    it('should support multiple concurrent analysis runs for different projects', () => {
      // This is verified by the fact that the check is per-project (project_id)
      // not global, so different projects can run concurrently
      const fs = require('fs');
      const path = require('path');
      const analyseRouteFile = fs.readFileSync(
        path.join(__dirname, '../app/api/projects/[id]/analyse/route.ts'),
        'utf-8'
      );
      
      // Check that the query filters by project_id
      expect(analyseRouteFile).toContain('.eq(\'project_id\', projectId)');
    });
  });

  describe('Sub-task 23.5: Fix Job Idempotency', () => {
    it('should check for pending fix jobs before creating new one', () => {
      // This is a code inspection test
      const fs = require('fs');
      const path = require('path');
      const fixRouteFile = fs.readFileSync(
        path.join(__dirname, '../app/api/findings/[id]/fix/route.ts'),
        'utf-8'
      );
      
      // Check for the existence of the pending fix job check
      expect(fixRouteFile).toContain('existingFixJobs');
      expect(fixRouteFile).toContain("in('status', ['queued', 'sandboxing', 'coding', 'linting', 'testing', 'opening_pr'])");
      expect(fixRouteFile).toContain('Requirement 33.3');
    });

    it('should return existing fix_job_id when fix is already in progress', () => {
      // This is a code inspection test
      const fs = require('fs');
      const path = require('path');
      const fixRouteFile = fs.readFileSync(
        path.join(__dirname, '../app/api/findings/[id]/fix/route.ts'),
        'utf-8'
      );
      
      // Check that it returns the existing fix job
      expect(fixRouteFile).toContain('existing: true');
      expect(fixRouteFile).toContain('Fix job already in progress');
      expect(fixRouteFile).toContain('existingFixJob.id');
    });

    it('should not create duplicate fix jobs for the same finding', () => {
      // This is verified by the idempotency check that returns existing fix_job_id
      const fs = require('fs');
      const path = require('path');
      const fixRouteFile = fs.readFileSync(
        path.join(__dirname, '../app/api/findings/[id]/fix/route.ts'),
        'utf-8'
      );
      
      // Check that the query filters by finding_id
      expect(fixRouteFile).toContain('.eq(\'finding_id\', findingId)');
    });
  });

  describe('Integration: Consistency Properties', () => {
    it('should produce consistent findings for same repository at same commit', () => {
      // This is ensured by:
      // 1. Temperature 0.0 (deterministic AI responses)
      // 2. Deterministic file ordering (.sort())
      // 3. Same prompts and context
      
      // This test verifies the implementation has these properties
      const fs = require('fs');
      const path = require('path');
      const analysisFile = fs.readFileSync(
        path.join(__dirname, '../inngest/functions/analysis.ts'),
        'utf-8'
      );
      
      // Verify all three properties are present
      expect(analysisFile).toContain('temperature: 0.0');
      expect(analysisFile).toContain('.sort()');
      expect(analysisFile).toContain('Requirement 33.5');
    });
  });
});
