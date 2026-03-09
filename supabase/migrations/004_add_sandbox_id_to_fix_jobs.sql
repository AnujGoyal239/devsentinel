-- ═══════════════════════════════════════════════════════════════════════════
-- Add sandbox_id column to fix_jobs table
-- Migration for Task 15: Auto-Fix Agent - Initialization and Sandbox Setup
-- ═══════════════════════════════════════════════════════════════════════════

-- Add sandbox_id column to track E2B sandbox instances
ALTER TABLE fix_jobs
ADD COLUMN sandbox_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN fix_jobs.sandbox_id IS 'E2B sandbox ID for tracking and cleanup';
