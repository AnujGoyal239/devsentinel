# GitHub Webhooks Setup Guide

This guide explains how to configure GitHub webhooks to automatically trigger DevSentinel analysis when code changes are pushed to your repository.

## Overview

DevSentinel supports automatic analysis triggers via GitHub webhooks for the following events:
- **Push events**: Triggered when commits are pushed to any branch
- **Pull request events**: Triggered when PRs are opened or updated
- **Release events**: Triggered when a new release is published

## Setup Instructions

### 1. Generate Webhook Secret

First, generate a secure random secret for webhook signature verification:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this secret - you'll need it for both GitHub and your DevSentinel configuration.

### 2. Configure DevSentinel

Add the webhook secret to your environment variables:

```env
GITHUB_WEBHOOK_SECRET=your_generated_secret_here
```

### 3. Configure GitHub Repository

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:

   **Payload URL**: `https://your-devsentinel-domain.com/api/webhooks/github`
   
   **Content type**: `application/json`
   
   **Secret**: Paste the secret you generated in step 1
   
   **Which events would you like to trigger this webhook?**
   - Select "Let me select individual events"
   - Check:
     - ✅ Pushes
     - ✅ Pull requests
     - ✅ Releases
   
   **Active**: ✅ Checked

4. Click **Add webhook**

### 4. Verify Setup

GitHub will send a `ping` event to verify the webhook is configured correctly. You should see:
- ✅ Green checkmark next to the webhook
- Recent delivery showing a successful `ping` event

You can also test by visiting the webhook URL directly:
```bash
curl https://your-devsentinel-domain.com/api/webhooks/github
```

Expected response:
```json
{
  "message": "GitHub webhook endpoint is active",
  "supported_events": ["push", "pull_request", "release"]
}
```

## How It Works

### Push Events
When you push commits to any branch:
1. GitHub sends a webhook with the latest commit SHA
2. DevSentinel verifies the signature
3. Finds the project associated with the repository
4. Creates a new analysis run with the commit SHA
5. Triggers the analysis pipeline

### Pull Request Events
When a PR is opened or updated:
1. GitHub sends a webhook with the PR head commit SHA
2. DevSentinel triggers analysis on the PR branch
3. Results can be reviewed before merging

### Release Events
When a release is published:
1. GitHub sends a webhook with the release commit
2. DevSentinel runs analysis on the release version
3. Ensures production code meets quality standards

## Security

### Signature Verification
Every webhook request is verified using HMAC-SHA256:
- GitHub signs the payload with your secret
- DevSentinel verifies the signature before processing
- Invalid signatures are rejected with 401 Unauthorized

### Failed Verification Logging
Failed verification attempts are logged for security monitoring:
- Timestamp of the attempt
- Event type
- Delivery ID
- Reason for failure

Check your logs regularly for suspicious activity.

## Troubleshooting

### Webhook Deliveries Failing

**Check the signature:**
- Ensure `GITHUB_WEBHOOK_SECRET` matches the secret in GitHub
- Verify there are no extra spaces or newlines in the secret

**Check the URL:**
- Ensure the webhook URL is publicly accessible
- Verify HTTPS is configured correctly
- Check firewall rules

**Check logs:**
```bash
# View webhook processing logs
grep "GitHub webhook" /var/log/devsentinel.log
```

### No Analysis Triggered

**Verify project exists:**
- Ensure a project is created in DevSentinel for this repository
- Check that `repo_owner` and `repo_name` match exactly

**Check event type:**
- Verify the event type is supported (push, pull_request, release)
- For pull requests, only `opened` and `synchronize` actions trigger analysis

**Check commit SHA:**
- Ensure the webhook payload includes a valid commit SHA
- For push events, this is the `after` field
- For PRs, this is `pull_request.head.sha`

### Webhook Deliveries Show Errors

**401 Unauthorized:**
- Signature verification failed
- Check that secrets match between GitHub and DevSentinel

**500 Internal Server Error:**
- Check DevSentinel application logs
- Verify database connectivity
- Ensure Inngest is configured correctly

## Best Practices

### 1. Use Branch Protection
Configure branch protection rules to require analysis before merging:
- Require status checks to pass
- Require review from code owners
- Prevent force pushes

### 2. Monitor Webhook Deliveries
Regularly check GitHub's webhook delivery history:
- Look for failed deliveries
- Review response times
- Check for unusual patterns

### 3. Rotate Secrets Periodically
Update your webhook secret every 90 days:
1. Generate a new secret
2. Update GitHub webhook configuration
3. Update `GITHUB_WEBHOOK_SECRET` in DevSentinel
4. Verify deliveries are successful

### 4. Rate Limiting
Be aware of analysis rate limits:
- Each webhook triggers a full analysis run
- Consider filtering events (e.g., only main branch pushes)
- Use branch filters in GitHub webhook configuration

## Advanced Configuration

### Filter by Branch
To only trigger analysis on specific branches, add a filter in your webhook configuration or modify the endpoint to check the branch name.

### Custom Event Handling
The webhook endpoint can be extended to handle additional GitHub events:
- `issues`
- `issue_comment`
- `deployment`
- `workflow_run`

See the source code at `app/api/webhooks/github/route.ts` for implementation details.

## API Reference

### Endpoint
```
POST /api/webhooks/github
```

### Headers
- `X-GitHub-Event`: Event type (push, pull_request, release)
- `X-Hub-Signature-256`: HMAC-SHA256 signature
- `X-GitHub-Delivery`: Unique delivery ID

### Response Codes
- `200 OK`: Webhook processed successfully
- `401 Unauthorized`: Invalid signature
- `500 Internal Server Error`: Processing error

### Example Payload (Push Event)
```json
{
  "ref": "refs/heads/main",
  "after": "abc123...",
  "repository": {
    "name": "my-repo",
    "owner": {
      "login": "my-org"
    }
  }
}
```

## Support

For issues or questions:
- Check application logs for detailed error messages
- Review GitHub webhook delivery history
- Contact DevSentinel support with delivery ID for investigation
