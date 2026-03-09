-- Create report_shares table for shareable report links
CREATE TABLE IF NOT EXISTS report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  access_count INTEGER DEFAULT 0,
  
  CONSTRAINT report_shares_run_id_fkey FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_report_shares_token ON report_shares(token);

-- Create index on run_id for listing shares
CREATE INDEX IF NOT EXISTS idx_report_shares_run_id ON report_shares(run_id);

-- Create index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_report_shares_expires_at ON report_shares(expires_at);

-- Enable Row Level Security
ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see shares for their own runs
CREATE POLICY report_shares_select_policy ON report_shares
  FOR SELECT
  USING (
    run_id IN (
      SELECT ar.id FROM analysis_runs ar
      JOIN projects p ON ar.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only create shares for their own runs
CREATE POLICY report_shares_insert_policy ON report_shares
  FOR INSERT
  WITH CHECK (
    run_id IN (
      SELECT ar.id FROM analysis_runs ar
      JOIN projects p ON ar.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only update shares for their own runs
CREATE POLICY report_shares_update_policy ON report_shares
  FOR UPDATE
  USING (
    run_id IN (
      SELECT ar.id FROM analysis_runs ar
      JOIN projects p ON ar.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only delete shares for their own runs
CREATE POLICY report_shares_delete_policy ON report_shares
  FOR DELETE
  USING (
    run_id IN (
      SELECT ar.id FROM analysis_runs ar
      JOIN projects p ON ar.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
