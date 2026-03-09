-- ═══════════════════════════════════════════════════════════════════════════
-- API Keys Table Migration
-- Enables programmatic API access for CI/CD integration
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: api_keys
-- Stores hashed API keys for programmatic authentication
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                    -- Descriptive name (e.g., "GitHub Actions", "Jenkins")
  key_hash     TEXT NOT NULL UNIQUE,             -- bcrypt hash of the API key
  key_prefix   TEXT NOT NULL,                    -- First 8 chars for identification (e.g., "ds_abc12")
  last_used_at TIMESTAMPTZ,                      -- Track usage for audit
  created_at   TIMESTAMPTZ DEFAULT now(),
  revoked_at   TIMESTAMPTZ,                      -- NULL = active, non-NULL = revoked
  
  -- Ensure name is unique per user
  CONSTRAINT unique_user_key_name UNIQUE (user_id, name)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Fast lookup by key_hash for authentication
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

-- List user's API keys
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Track active keys
CREATE INDEX idx_api_keys_active ON api_keys(user_id, revoked_at) WHERE revoked_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- api_keys: users can only access their own API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_rls ON api_keys
  FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE api_keys IS 'API keys for programmatic authentication in CI/CD pipelines';
COMMENT ON COLUMN api_keys.key_hash IS 'bcrypt hash of the full API key (never store plaintext)';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of the key for display purposes (e.g., ds_abc12...)';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of last successful authentication with this key';
COMMENT ON COLUMN api_keys.revoked_at IS 'NULL = active key, non-NULL = revoked (soft delete)';
