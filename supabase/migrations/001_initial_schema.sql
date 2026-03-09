-- ═══════════════════════════════════════════════════════════════════════════
-- DevSentinel Database Schema
-- Initial migration with all tables, RLS policies, and indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: users
-- Created on first Auth0 login
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id    TEXT UNIQUE NOT NULL,
  username     TEXT NOT NULL,
  avatar_url   TEXT,
  github_token TEXT,                    -- encrypted at rest
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: projects
-- One per repo+PRD pair
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  repo_url     TEXT NOT NULL,
  repo_owner   TEXT NOT NULL,
  repo_name    TEXT NOT NULL,
  branch       TEXT NOT NULL DEFAULT 'main',
  tech_stack   JSONB,                   -- { framework, language, dependencies[] }
  status       TEXT NOT NULL DEFAULT 'idle',
                                        -- idle | analysing | complete | fixing | error
  health_score INTEGER,                 -- 0-100
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: documents
-- Uploaded PRD files
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  file_type      TEXT NOT NULL,         -- pdf | docx | md
  storage_path   TEXT NOT NULL,         -- Supabase Storage path
  parsed_content TEXT,                  -- raw extracted text
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: requirements
-- AI-extracted from uploaded PRDs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE requirements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category          TEXT,               -- feature | endpoint | acceptance_criteria | edge_case
  feature_name      TEXT NOT NULL,
  description       TEXT,
  endpoint          TEXT,               -- e.g. POST /api/auth/login
  expected_behavior TEXT,
  priority          TEXT DEFAULT 'medium', -- high | medium | low
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: analysis_runs
-- One per "Run Analysis" click
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE analysis_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'queued',
                                        -- queued | running | complete | failed
  health_score     INTEGER,
  total_tests      INTEGER DEFAULT 0,
  passed           INTEGER DEFAULT 0,
  failed           INTEGER DEFAULT 0,
  codebase_context JSONB,               -- Pass 1 output: tech_stack, routes, imports
  current_stage    TEXT,                -- live progress label for SSE
  current_progress INTEGER DEFAULT 0,  -- 0-100
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: findings
-- One per discovered issue
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  requirement_id  UUID REFERENCES requirements(id),
  pass_number     INTEGER NOT NULL,     -- 1 | 2 | 3 | 4
  category        TEXT NOT NULL,        -- bug | security | production | prd_compliance
  severity        TEXT NOT NULL,        -- critical | high | medium | low | info
  bug_type        TEXT,
  status          TEXT NOT NULL,        -- pass | fail
  file_path       TEXT,
  line_start      INTEGER,
  line_end        INTEGER,
  code_snippet    TEXT,
  explanation     TEXT,
  fix_confidence  NUMERIC(3,2),         -- 0.00-1.00
  fix_original    TEXT,
  fix_suggested   TEXT,
  fix_explanation TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: fix_jobs
-- One per Auto-Fix invocation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fix_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id    UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued',
                                        -- queued | sandboxing | coding | linting | testing | opening_pr | complete | failed
  pr_url        TEXT,
  pr_number     INTEGER,
  branch_name   TEXT,
  agent_log     JSONB DEFAULT '[]',     -- array of { stage, message, timestamp }
  lint_result   JSONB,
  test_result   JSONB,
  retry_count   INTEGER DEFAULT 0,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Dashboard: list user's projects sorted by updated_at
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Report: get all runs for a project
CREATE INDEX idx_analysis_runs_project ON analysis_runs(project_id);

-- Report: get all findings for a run
CREATE INDEX idx_findings_run_id ON findings(run_id);

-- Report: filter findings by category (bug / security / production / prd_compliance tabs)
CREATE INDEX idx_findings_category ON findings(run_id, category);

-- Report: filter findings by severity (critical first ordering)
CREATE INDEX idx_findings_severity ON findings(run_id, severity);

-- Fix log: get fix job for a finding
CREATE INDEX idx_fix_jobs_finding ON fix_jobs(finding_id);

-- PRD compliance: get requirements for a project
CREATE INDEX idx_requirements_project ON requirements(project_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- users: each user sees only their own record
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_rls ON users
  FOR ALL USING (id = auth.uid());

-- projects: direct ownership
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_rls ON projects
  FOR ALL USING (user_id = auth.uid());

-- documents: through project ownership
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_rls ON documents
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- requirements: through project ownership
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY requirements_rls ON requirements
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- analysis_runs: through project ownership
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY analysis_runs_rls ON analysis_runs
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- findings: through analysis_run → project ownership
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_rls ON findings
  FOR ALL USING (
    run_id IN (
      SELECT id FROM analysis_runs
      WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    )
  );

-- fix_jobs: through finding → run → project ownership
ALTER TABLE fix_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY fix_jobs_rls ON fix_jobs
  FOR ALL USING (
    finding_id IN (
      SELECT id FROM findings WHERE run_id IN (
        SELECT id FROM analysis_runs WHERE project_id IN (
          SELECT id FROM projects WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════════════════

-- Create storage bucket for PRD uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('prd-uploads', 'prd-uploads', false);

-- Storage policy: users can only access their own uploads
CREATE POLICY "Users can upload PRDs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'prd-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read their own PRDs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'prd-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own PRDs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'prd-uploads' AND auth.uid() IS NOT NULL);
