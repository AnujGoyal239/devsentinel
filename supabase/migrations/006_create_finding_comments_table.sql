-- Create finding_comments table for collaborative discussions
CREATE TABLE IF NOT EXISTS finding_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT finding_comments_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
  CONSTRAINT finding_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on finding_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_finding_comments_finding_id ON finding_comments(finding_id);

-- Create index on user_id for user activity tracking
CREATE INDEX IF NOT EXISTS idx_finding_comments_user_id ON finding_comments(user_id);

-- Create index on created_at for chronological ordering
CREATE INDEX IF NOT EXISTS idx_finding_comments_created_at ON finding_comments(created_at);

-- Enable Row Level Security
ALTER TABLE finding_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see comments on findings from their own projects
CREATE POLICY finding_comments_select_policy ON finding_comments
  FOR SELECT
  USING (
    finding_id IN (
      SELECT f.id FROM findings f
      JOIN analysis_runs ar ON f.run_id = ar.id
      JOIN projects p ON ar.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can create comments on findings from their own projects
CREATE POLICY finding_comments_insert_policy ON finding_comments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    finding_id IN (
      SELECT f.id FROM findings f
      JOIN analysis_runs ar ON f.run_id = ar.id
      JOIN projects p ON ar.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only update their own comments
CREATE POLICY finding_comments_update_policy ON finding_comments
  FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policy: Users can only delete their own comments
CREATE POLICY finding_comments_delete_policy ON finding_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_finding_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER finding_comments_updated_at_trigger
  BEFORE UPDATE ON finding_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_finding_comments_updated_at();
