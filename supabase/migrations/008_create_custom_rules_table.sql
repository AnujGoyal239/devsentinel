-- Create custom_rules table
CREATE TABLE custom_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  file_pattern TEXT NOT NULL, -- Regex pattern for file paths
  content_pattern TEXT, -- Regex pattern for file content (optional)
  message TEXT NOT NULL, -- Message to display when rule matches
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_custom_rules_project_id ON custom_rules(project_id);
CREATE INDEX idx_custom_rules_enabled ON custom_rules(project_id, enabled);

-- Enable Row-Level Security
ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access custom rules for their own projects
CREATE POLICY custom_rules_rls ON custom_rules
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE custom_rules IS 'Custom analysis rules defined by users for project-specific requirements';
