# Database Migrations

## Overview

This directory contains all database migration scripts for the DevSentinel platform. Migrations are applied in numerical order.

## Migration Files

1. `001_create_users_table.sql` - Users table with GitHub OAuth data
2. `002_create_projects_table.sql` - Projects table
3. `003_create_documents_table.sql` - PRD documents table
4. `004_create_requirements_table.sql` - Extracted requirements table
5. `005_create_analysis_runs_table.sql` - Analysis runs table
6. `006_create_findings_table.sql` - Findings table
7. `007_create_fix_jobs_table.sql` - Fix jobs table
8. `008_create_custom_rules_table.sql` - Custom analysis rules table
9. `009_create_api_keys_table.sql` - API keys table
10. `010_create_indexes.sql` - Performance indexes
11. `011_create_rls_policies.sql` - Row-Level Security policies

## Running Migrations Locally

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Check migration status
supabase migration list
```

## Running Migrations in Production

```bash
# Set environment variables
export SUPABASE_ACCESS_TOKEN=your-access-token
export SUPABASE_PROJECT_REF=your-project-ref

# Apply migrations
supabase db push --linked
```

## Rollback Procedures

### Rollback Single Migration

```sql
-- Manually revert changes from the migration file
-- Example: Drop table created in migration
DROP TABLE IF EXISTS table_name CASCADE;
```

### Rollback to Specific Migration

```bash
# Reset to specific migration
supabase db reset --version 005
```

### Full Database Reset (Development Only)

```bash
# WARNING: This will delete all data
supabase db reset
```

## Testing Migrations

### Test Locally

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Verify tables
supabase db diff

# Stop local instance
supabase stop
```

### Test on Staging

```bash
# Link to staging project
supabase link --project-ref staging-project-ref

# Apply migrations
supabase db push

# Verify
psql $DATABASE_URL -c "\dt"
```

## Migration Best Practices

1. **Always test locally first**
2. **Create backup before production migration**
3. **Use transactions for atomic changes**
4. **Include rollback instructions in comments**
5. **Version control all migration files**
6. **Never modify existing migrations** - create new ones instead

## Backup Strategy

### Automated Backups

Supabase provides:
- Daily automated backups
- 7-day retention on free tier
- Point-in-time recovery on paid tiers

### Manual Backup

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20240101.sql
```

## Troubleshooting

### Migration Failed

1. Check error message in Supabase dashboard
2. Verify SQL syntax
3. Check for conflicting constraints
4. Ensure proper permissions

### RLS Policies Not Working

1. Verify policies are enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Check policy conditions
3. Test with different user contexts

### Performance Issues

1. Check if indexes are created
2. Analyze query plans: `EXPLAIN ANALYZE SELECT ...`
3. Add missing indexes
4. Consider partitioning for large tables

## Emergency Procedures

### Database Corruption

1. Stop all write operations
2. Create immediate backup
3. Contact Supabase support
4. Restore from last known good backup

### Data Loss

1. Check Supabase backups
2. Restore from automated backup
3. Apply migrations since backup
4. Verify data integrity

### Complete System Failure

1. Provision new Supabase project
2. Apply all migrations from scratch
3. Restore data from backup
4. Update connection strings
5. Verify all services

## Monitoring

### Check Migration Status

```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

### Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Active Connections

```sql
SELECT count(*) FROM pg_stat_activity;
```

## Contact

For migration issues, contact:
- Supabase Support: https://supabase.com/support
- DevSentinel Team: support@devsentinel.com
