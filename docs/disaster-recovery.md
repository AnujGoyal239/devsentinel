# Disaster Recovery Procedures

## Overview

This document outlines backup strategies and disaster recovery procedures for the DevSentinel platform.

## Backup Strategy

### Supabase Database Backups

**Automated Backups:**
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 7 days (free tier) / 30 days (paid tier)
- **Type**: Full database backup
- **Location**: Supabase managed storage

**Manual Backup:**
```bash
# Create manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql

# Upload to secure storage
aws s3 cp backup_*.sql.gz s3://devsentinel-backups/
```

### Environment Variables Backup

```bash
# Export all environment variables
vercel env pull .env.production

# Store securely (encrypted)
gpg --encrypt .env.production

# Upload to secure location
aws s3 cp .env.production.gpg s3://devsentinel-secrets/
```

### Code Repository Backup

- **Primary**: GitHub repository
- **Mirror**: GitLab (optional)
- **Frequency**: Real-time (git push)
- **Retention**: Indefinite

### Qdrant Vector Database Backup

```bash
# Create snapshot
curl -X POST 'https://your-qdrant-url/collections/{collection_name}/snapshots'

# Download snapshot
curl 'https://your-qdrant-url/collections/{collection_name}/snapshots/{snapshot_name}' \
  --output snapshot.tar

# Upload to storage
aws s3 cp snapshot.tar s3://devsentinel-backups/qdrant/
```

## Recovery Procedures

### Database Corruption Recovery

**Symptoms:**
- Query errors
- Data inconsistencies
- Connection failures

**Recovery Steps:**

1. **Stop All Write Operations**
   ```bash
   # Disable API endpoints temporarily
   vercel env add MAINTENANCE_MODE true
   ```

2. **Create Immediate Backup**
   ```bash
   pg_dump $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Assess Damage**
   ```sql
   -- Check table integrity
   SELECT * FROM pg_stat_database;
   
   -- Check for corrupted indexes
   REINDEX DATABASE devsentinel;
   ```

4. **Restore from Backup**
   ```bash
   # Download latest backup from Supabase
   # Or use automated backup
   
   # Restore database
   psql $DATABASE_URL < backup_latest.sql
   ```

5. **Verify Data Integrity**
   ```sql
   -- Check row counts
   SELECT 'users' as table_name, COUNT(*) FROM users
   UNION ALL
   SELECT 'projects', COUNT(*) FROM projects
   UNION ALL
   SELECT 'findings', COUNT(*) FROM findings;
   
   -- Verify recent data
   SELECT * FROM analysis_runs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

6. **Re-enable Services**
   ```bash
   vercel env rm MAINTENANCE_MODE
   ```

**Estimated Recovery Time**: 30-60 minutes

### Vercel Outage Recovery

**Symptoms:**
- Site unreachable
- 502/503 errors
- Deployment failures

**Recovery Steps:**

1. **Check Vercel Status**
   - Visit: https://www.vercel-status.com/
   - Check for ongoing incidents

2. **Verify Deployment**
   ```bash
   # Check deployment status
   vercel ls
   
   # Check logs
   vercel logs
   ```

3. **Rollback if Needed**
   ```bash
   # Rollback to previous deployment
   vercel rollback
   ```

4. **Alternative: Deploy to Backup Platform**
   ```bash
   # Deploy to Netlify/Railway as backup
   netlify deploy --prod
   ```

5. **Update DNS if Necessary**
   - Point DNS to backup platform
   - Update CNAME records

**Estimated Recovery Time**: 15-30 minutes

### Supabase Outage Recovery

**Symptoms:**
- Database connection errors
- Authentication failures
- API timeouts

**Recovery Steps:**

1. **Check Supabase Status**
   - Visit: https://status.supabase.com/
   - Check for ongoing incidents

2. **Enable Read-Only Mode**
   ```typescript
   // Serve cached data only
   const FALLBACK_MODE = true;
   ```

3. **If Extended Outage, Migrate to Backup Database**
   ```bash
   # Provision new Supabase project
   supabase projects create devsentinel-backup
   
   # Restore from backup
   psql $NEW_DATABASE_URL < backup_latest.sql
   
   # Update environment variables
   vercel env add DATABASE_URL $NEW_DATABASE_URL
   ```

4. **Verify Services**
   ```bash
   # Test database connection
   curl https://devsentinel.com/api/health
   ```

**Estimated Recovery Time**: 1-2 hours

### Complete System Failure Recovery

**Scenario**: All services down simultaneously

**Recovery Steps:**

1. **Assess Situation**
   - Check all service status pages
   - Identify root cause
   - Estimate recovery time

2. **Communicate with Users**
   ```markdown
   # Status Page Update
   We're experiencing technical difficulties. 
   Our team is working on recovery.
   ETA: [time]
   ```

3. **Provision New Infrastructure**
   ```bash
   # New Vercel project
   vercel --prod
   
   # New Supabase project
   supabase projects create devsentinel-recovery
   
   # New Qdrant instance
   # Provision via Qdrant Cloud dashboard
   ```

4. **Restore Data**
   ```bash
   # Restore database
   psql $NEW_DATABASE_URL < backup_latest.sql
   
   # Restore vector database
   # Upload snapshots to new Qdrant instance
   
   # Restore environment variables
   vercel env add --env-file .env.production
   ```

5. **Apply Migrations**
   ```bash
   supabase db push
   ```

6. **Verify All Services**
   ```bash
   # Run health checks
   curl https://devsentinel.com/api/health
   
   # Test critical flows
   # - Authentication
   # - Project creation
   # - Analysis trigger
   ```

7. **Update DNS**
   ```bash
   # Point to new infrastructure
   # Update A/CNAME records
   ```

8. **Monitor Closely**
   - Watch error rates
   - Check performance metrics
   - Verify data integrity

**Estimated Recovery Time**: 2-4 hours

## Data Loss Scenarios

### Recent Data Loss (< 24 hours)

**Recovery:**
1. Restore from automated daily backup
2. Replay transactions from logs (if available)
3. Request users to re-run recent analyses

**Data Loss**: Up to 24 hours

### Extended Data Loss (> 24 hours)

**Recovery:**
1. Restore from oldest available backup
2. Contact Supabase support for point-in-time recovery
3. Manually reconstruct critical data from logs

**Data Loss**: Depends on backup retention

### Complete Data Loss

**Recovery:**
1. Start fresh with new database
2. Users must re-create projects
3. Re-run all analyses

**Prevention**: Multiple backup locations, longer retention

## Testing Recovery Procedures

### Quarterly Disaster Recovery Drill

**Schedule**: First Monday of each quarter

**Procedure:**
1. Create test environment
2. Simulate failure scenario
3. Execute recovery procedures
4. Document time taken
5. Identify improvements
6. Update procedures

**Test Scenarios:**
- Database corruption
- Vercel outage
- Supabase outage
- Complete system failure

### Backup Verification

**Monthly:**
```bash
# Test database backup restore
pg_restore --dbname=test_db backup_latest.sql

# Verify data integrity
psql test_db -c "SELECT COUNT(*) FROM users;"

# Clean up
dropdb test_db
```

## Contact Information

### Emergency Contacts

**Supabase Support:**
- Email: support@supabase.io
- Dashboard: https://app.supabase.com/support

**Vercel Support:**
- Email: support@vercel.com
- Dashboard: https://vercel.com/support

**Qdrant Support:**
- Email: support@qdrant.tech
- Docs: https://qdrant.tech/documentation/

### Internal Team

**On-Call Engineer:**
- Primary: [Name] - [Phone]
- Secondary: [Name] - [Phone]

**DevOps Lead:**
- [Name] - [Email] - [Phone]

**CTO:**
- [Name] - [Email] - [Phone]

## Maintenance Windows

**Scheduled Maintenance:**
- **When**: First Sunday of each month, 2:00 AM - 4:00 AM UTC
- **Duration**: Up to 2 hours
- **Activities**: 
  - Database maintenance
  - Backup verification
  - Security updates
  - Performance optimization

**Notification:**
- Email users 7 days in advance
- Status page update
- In-app notification

## Post-Incident Review

**After Each Incident:**

1. **Document Incident**
   - What happened
   - When it happened
   - How long it lasted
   - Impact on users

2. **Root Cause Analysis**
   - Identify root cause
   - Contributing factors
   - Why detection was delayed

3. **Action Items**
   - Prevent recurrence
   - Improve detection
   - Faster recovery

4. **Update Procedures**
   - Document lessons learned
   - Update runbooks
   - Train team

## Compliance and Audit

**Backup Audit Trail:**
- Log all backup operations
- Track restore operations
- Monitor backup success rates
- Alert on backup failures

**Retention Policy:**
- Database backups: 7-30 days
- Application logs: 90 days
- Audit logs: 1 year
- Financial data: 7 years

## Resources

- Supabase Backup Guide: https://supabase.com/docs/guides/platform/backups
- Vercel Deployment: https://vercel.com/docs/concepts/deployments
- Disaster Recovery Best Practices: https://aws.amazon.com/disaster-recovery/
