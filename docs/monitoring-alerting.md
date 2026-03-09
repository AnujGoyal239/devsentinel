# Monitoring and Alerting Configuration

## Overview

This document describes the monitoring and alerting setup for DevSentinel platform.

## Alert Channels

### Slack Integration
- **Channel**: #devsentinel-alerts
- **Webhook URL**: Configure in Sentry/Vercel settings
- **Alert Types**: Critical errors, job failures

### Email Alerts
- **Recipients**: ops@devsentinel.com, team@devsentinel.com
- **Alert Types**: Infrastructure issues, database alerts

### PagerDuty (Optional)
- **Service**: DevSentinel Production
- **Alert Types**: Site downtime, critical failures

## Sentry Error Rate Alerts

### Configuration

```javascript
// sentry.config.js
export const sentryConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Alert Rules
  alertRules: [
    {
      name: 'High Error Rate',
      condition: 'error_rate > 1%',
      timeWindow: '5 minutes',
      action: 'Send to Slack #devsentinel-alerts',
    },
    {
      name: 'Critical Error Spike',
      condition: 'error_count > 100 in 1 minute',
      action: 'Send to Slack + Email',
    },
  ],
};
```

### Alert Thresholds

- **Warning**: Error rate > 0.5% over 5 minutes
- **Critical**: Error rate > 1% over 5 minutes
- **Action**: Send to Slack #devsentinel-alerts

### Setup Steps

1. Go to Sentry Dashboard → Alerts
2. Create new alert rule:
   - Name: "High Error Rate"
   - Condition: "Error rate is above 1% in 5 minutes"
   - Action: "Send notification to Slack"
3. Configure Slack webhook
4. Test alert

## Vercel Function Error Rate Alerts

### Configuration

```javascript
// vercel.json
{
  "alerts": [
    {
      "name": "function-errors",
      "threshold": 5,
      "period": "5m",
      "action": "email",
      "emails": ["ops@devsentinel.com"]
    }
  ]
}
```

### Alert Thresholds

- **Warning**: Function error rate > 3% over 5 minutes
- **Critical**: Function error rate > 5% over 5 minutes
- **Action**: Send email to ops@devsentinel.com

### Setup Steps

1. Go to Vercel Dashboard → Settings → Alerts
2. Enable "Function Errors" alert
3. Set threshold: 5% error rate
4. Add email recipients
5. Test alert

## Supabase Database CPU Alerts

### Configuration

Via Supabase Dashboard:
- Navigate to Project → Settings → Database → Alerts
- Enable CPU usage alerts

### Alert Thresholds

- **Warning**: CPU usage > 70% for 5 minutes
- **Critical**: CPU usage > 80% for 5 minutes
- **Action**: Send email to ops@devsentinel.com

### Setup Steps

1. Go to Supabase Dashboard → Project Settings
2. Navigate to Database → Monitoring
3. Create alert rule:
   - Metric: CPU Usage
   - Threshold: 80%
   - Duration: 5 minutes
   - Action: Email notification
4. Add email recipients
5. Test alert

## Inngest Job Failure Rate Alerts

### Configuration

```typescript
// inngest/monitoring.ts
export const inngestAlerts = {
  jobFailureRate: {
    threshold: 10, // 10%
    timeWindow: '15 minutes',
    action: 'slack',
    channel: '#devsentinel-alerts',
  },
};
```

### Alert Thresholds

- **Warning**: Job failure rate > 5% over 15 minutes
- **Critical**: Job failure rate > 10% over 15 minutes
- **Action**: Send to Slack #devsentinel-alerts

### Setup Steps

1. Go to Inngest Dashboard → Monitoring
2. Create alert rule:
   - Name: "High Job Failure Rate"
   - Condition: "Failure rate > 10% in 15 minutes"
   - Action: "Webhook to Slack"
3. Configure Slack webhook
4. Test alert

## Uptime Monitoring

### Configuration

Use UptimeRobot or similar service:

```yaml
monitors:
  - name: DevSentinel Homepage
    url: https://devsentinel.com
    interval: 5 minutes
    alert_threshold: 1 minute downtime
    
  - name: DevSentinel API Health
    url: https://devsentinel.com/api/health
    interval: 1 minute
    alert_threshold: 1 minute downtime
    expected_status: 200
```

### Alert Thresholds

- **Critical**: Site down > 1 minute
- **Action**: Send to PagerDuty (if configured) or Email

### Setup Steps

1. Sign up for UptimeRobot (free tier)
2. Add monitors:
   - Homepage: https://devsentinel.com
   - Health endpoint: https://devsentinel.com/api/health
3. Set check interval: 5 minutes
4. Configure alert contacts
5. Test alerts

## Custom Metrics

### Application Metrics

```typescript
// lib/monitoring/metrics.ts
export const metrics = {
  // Analysis metrics
  analysisStarted: () => posthog.capture('analysis_started'),
  analysisCompleted: (duration: number) => 
    posthog.capture('analysis_completed', { duration }),
  
  // Fix metrics
  fixTriggered: () => posthog.capture('fix_triggered'),
  fixCompleted: (success: boolean) => 
    posthog.capture('fix_completed', { success }),
  
  // Performance metrics
  apiResponseTime: (endpoint: string, duration: number) =>
    posthog.capture('api_response_time', { endpoint, duration }),
};
```

### Dashboard Setup

1. PostHog Dashboard → Insights
2. Create dashboards for:
   - Analysis success rate
   - Fix success rate
   - API response times
   - User activity
3. Set up alerts for anomalies

## Alert Response Procedures

### High Error Rate (Sentry)

1. Check Sentry dashboard for error details
2. Identify affected endpoints/functions
3. Check recent deployments
4. Rollback if necessary
5. Fix and redeploy

### Function Errors (Vercel)

1. Check Vercel logs
2. Identify failing functions
3. Check environment variables
4. Verify external service availability
5. Fix and redeploy

### High CPU (Supabase)

1. Check active queries
2. Identify slow queries
3. Add indexes if needed
4. Optimize queries
5. Consider scaling database

### Job Failures (Inngest)

1. Check Inngest dashboard
2. Review failed job logs
3. Identify failure patterns
4. Fix underlying issues
5. Retry failed jobs if needed

### Site Downtime

1. Check Vercel status
2. Check Supabase status
3. Verify DNS configuration
4. Check SSL certificates
5. Contact support if needed

## Testing Alerts

### Test Sentry Alert

```typescript
// Trigger test error
throw new Error('Test alert - please ignore');
```

### Test Vercel Alert

```typescript
// Create failing function
export default function handler(req, res) {
  throw new Error('Test error');
}
```

### Test Database Alert

```sql
-- Run expensive query to spike CPU
SELECT * FROM large_table, large_table2;
```

### Test Uptime Alert

- Temporarily disable health endpoint
- Wait for alert
- Re-enable endpoint

## Monitoring Checklist

- [ ] Sentry error tracking configured
- [ ] Sentry alerts configured (>1% error rate → Slack)
- [ ] Vercel function alerts configured (>5% error rate → Email)
- [ ] Supabase CPU alerts configured (>80% → Email)
- [ ] Inngest job failure alerts configured (>10% → Slack)
- [ ] Uptime monitoring configured (>1 min downtime → PagerDuty/Email)
- [ ] PostHog dashboards created
- [ ] Alert channels tested
- [ ] Response procedures documented
- [ ] Team trained on alert response

## Maintenance

### Weekly

- Review error trends in Sentry
- Check database performance metrics
- Review job success rates
- Check uptime statistics

### Monthly

- Review and adjust alert thresholds
- Update alert contact information
- Test all alert channels
- Review response procedures

### Quarterly

- Audit monitoring coverage
- Update documentation
- Train new team members
- Review and optimize costs

## Resources

- Sentry Documentation: https://docs.sentry.io/
- Vercel Monitoring: https://vercel.com/docs/concepts/observability
- Supabase Monitoring: https://supabase.com/docs/guides/platform/metrics
- Inngest Monitoring: https://www.inngest.com/docs/monitoring
- PostHog: https://posthog.com/docs
