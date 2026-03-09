-- Migration: Add webhook-related fields to analysis_runs
-- Description: Adds commit_sha and triggered_by fields for webhook-triggered analysis

-- Add webhook fields to analysis_runs table
ALTER TABLE analysis_runs
ADD COLUMN IF NOT EXISTS commit_sha TEXT,
ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'manual';

-- Create index for faster lookups by commit
CREATE INDEX IF NOT EXISTS idx_analysis_runs_commit_sha ON analysis_runs(commit_sha)
WHERE commit_sha IS NOT NULL;

-- Add comments
COMMENT ON COLUMN analysis_runs.commit_sha IS 'Git commit SHA that triggered this analysis (for webhook-triggered runs)';
COMMENT ON COLUMN analysis_runs.triggered_by IS 'Source that triggered the analysis (manual, webhook:push, webhook:pull_request, webhook:release)';
