# DevSentinel GitHub Action

Official GitHub Action for running DevSentinel code analysis in your CI/CD pipeline. Automatically analyze your code for bugs, security vulnerabilities, and production readiness issues on every push or pull request.

## Features

- 🚀 **Easy Integration** - Add code analysis to your workflow in minutes
- 🎯 **Quality Gates** - Fail builds when health score drops below threshold
- 📊 **Detailed Outputs** - Access health score, status, and run ID in subsequent steps
- ⚡ **Fast** - Leverages DevSentinel's cloud infrastructure for quick analysis
- 🔒 **Secure** - API keys stored as GitHub secrets, never exposed in logs

## Quick Start

### 1. Get Your API Key

1. Sign in to [DevSentinel Dashboard](https://devsentinel.com/dashboard)
2. Go to Settings → API Keys
3. Click "Create API Key"
4. Copy the key (starts with `ds_`)

### 2. Add Secrets to GitHub

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add two secrets:
   - `DEVSENTINEL_API_KEY` - Your API key from step 1
   - `DEVSENTINEL_PROJECT_ID` - Your project ID from the dashboard

### 3. Create Workflow File

Create `.github/workflows/devsentinel.yml`:

```yaml
name: DevSentinel Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run DevSentinel Analysis
        uses: devsentinel/github-action@v1
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 80
```

That's it! Your code will now be analyzed on every push and pull request.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | DevSentinel API key (starts with `ds_`) | ✅ Yes | - |
| `project-id` | DevSentinel project ID to analyze | ✅ Yes | - |
| `threshold` | Minimum health score (0-100). Build fails if below this value. | ❌ No | `80` |
| `timeout` | Maximum wait time in seconds for analysis to complete | ❌ No | `600` |
| `api-url` | DevSentinel API URL (for self-hosted instances) | ❌ No | `https://devsentinel.com` |

## Outputs

| Output | Description | Example |
|--------|-------------|---------|
| `health-score` | The health score from the analysis (0-100) | `87` |
| `status` | Analysis status | `complete` or `failed` |
| `run-id` | Analysis run ID for reference | `run_abc123xyz` |

### Using Outputs

Access outputs in subsequent steps:

```yaml
- name: Run DevSentinel Analysis
  id: devsentinel
  uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80

- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## DevSentinel Analysis Results\n\n` +
              `**Health Score:** ${{ steps.devsentinel.outputs.health-score }}/100\n` +
              `**Status:** ${{ steps.devsentinel.outputs.status }}\n` +
              `**Run ID:** ${{ steps.devsentinel.outputs.run-id }}`
      })
```

## Usage Examples

### Basic Usage

Analyze code with default threshold (80):

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
```

### Custom Threshold

Set a higher quality bar:

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 90
```

### Extended Timeout

For large codebases:

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
    timeout: 1200
```

### Run Only on Pull Requests

```yaml
name: DevSentinel PR Check

on:
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devsentinel/github-action@v1
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 85
```

### Run on Schedule

Analyze code daily:

```yaml
name: Daily Code Analysis

on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM UTC daily

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devsentinel/github-action@v1
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 75
```

### Multiple Projects

Analyze different projects in a monorepo:

```yaml
jobs:
  analyze-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devsentinel/github-action@v1
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.FRONTEND_PROJECT_ID }}
          threshold: 85

  analyze-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devsentinel/github-action@v1
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.BACKEND_PROJECT_ID }}
          threshold: 90
```

### Continue on Failure

Run analysis but don't fail the build:

```yaml
- uses: devsentinel/github-action@v1
  continue-on-error: true
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
```

### Conditional Execution

Only run on specific file changes:

```yaml
name: DevSentinel Analysis

on:
  push:
    paths:
      - 'src/**'
      - 'lib/**'
      - 'package.json'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devsentinel/github-action@v1
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
```

### Slack Notification

Send results to Slack:

```yaml
- name: Run DevSentinel Analysis
  id: devsentinel
  uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80

- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "DevSentinel Analysis Complete",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Health Score:* ${{ steps.devsentinel.outputs.health-score }}/100\n*Status:* ${{ steps.devsentinel.outputs.status }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Create GitHub Issue on Failure

Automatically create an issue when health score drops:

```yaml
- name: Run DevSentinel Analysis
  id: devsentinel
  uses: devsentinel/github-action@v1
  continue-on-error: true
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80

- name: Create Issue on Low Score
  if: steps.devsentinel.outputs.health-score < 80
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: '⚠️ Code Health Score Below Threshold',
        body: `The DevSentinel health score has dropped to **${{ steps.devsentinel.outputs.health-score }}/100**.\n\n` +
              `This is below our threshold of 80.\n\n` +
              `**Run ID:** ${{ steps.devsentinel.outputs.run-id }}\n` +
              `**Commit:** ${context.sha}\n\n` +
              `Please review the [analysis results](https://devsentinel.com/project/${{ secrets.DEVSENTINEL_PROJECT_ID }}/report).`,
        labels: ['code-quality', 'automated']
      })
```

## Exit Codes

The action uses specific exit codes to indicate different outcomes:

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| `0` | ✅ Success | Analysis completed, health score meets threshold |
| `1` | ❌ Error | Analysis failed or API error occurred |
| `2` | ⚠️ Threshold Not Met | Analysis completed but health score below threshold |

## Troubleshooting

### Authentication Failed

**Error:** `Authentication failed. Please check your API key.`

**Solution:**
- Verify your API key is correct and starts with `ds_`
- Check the key hasn't been revoked in the dashboard
- Ensure the secret is named correctly in GitHub

### Resource Not Found

**Error:** `Resource not found. Please check the project ID.`

**Solution:**
- Verify the project ID is correct
- Ensure you have access to the project
- Check the project exists in your dashboard

### Rate Limit Exceeded

**Error:** `Rate limit exceeded. Please try again later.`

**Solution:**
- Wait a few minutes before retrying
- Check if multiple workflows are running simultaneously
- Contact support if rate limits are too restrictive

### Timeout

**Error:** `Analysis did not complete within 600 seconds`

**Solution:**
- Increase the `timeout` input value
- Check if the analysis is stuck (view in dashboard)
- Contact support if analysis consistently times out

### Action Not Found

**Error:** `Unable to resolve action devsentinel/github-action@v1`

**Solution:**
- Ensure you're using the correct action name
- Check if the action is published to GitHub Marketplace
- Try using the full repository path

## Platform Support

This action supports:

- ✅ **Linux runners** (ubuntu-latest, ubuntu-22.04, ubuntu-20.04)
- ✅ **macOS runners** (macos-latest, macos-13, macos-12)
- ❌ **Windows runners** (not currently supported)

## Security Best Practices

1. **Never commit API keys** - Always use GitHub secrets
2. **Rotate keys regularly** - Create new keys periodically
3. **Use minimal permissions** - API keys should only have analysis permissions
4. **Revoke unused keys** - Remove old keys from the dashboard
5. **Monitor usage** - Check API key usage in the dashboard

## Performance Tips

1. **Use caching** - Cache dependencies to speed up workflow
2. **Run conditionally** - Only analyze when code changes
3. **Adjust timeout** - Set appropriate timeout for your codebase size
4. **Parallel jobs** - Analyze multiple projects in parallel

## Support

- **Documentation**: https://docs.devsentinel.com
- **Dashboard**: https://devsentinel.com/dashboard
- **Issues**: https://github.com/devsentinel/github-action/issues
- **Email**: support@devsentinel.com

## Publishing to GitHub Marketplace

To publish this action to the GitHub Marketplace:

1. **Create a new repository** named `github-action` in the `devsentinel` organization
2. **Copy the action files** to the repository root
3. **Create a release** with a version tag (e.g., `v1.0.0`)
4. **Publish to Marketplace** by checking the box during release creation

### Repository Structure

```
github-action/
├── action.yml          # Action metadata
├── README.md           # This file
└── LICENSE             # MIT License
```

### Version Tags

Use semantic versioning with major version tags:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create major version tag for easy updates
git tag -fa v1 -m "Update v1 to v1.0.0"
git push origin v1 --force
```

Users can then reference the action as:
- `devsentinel/github-action@v1` (recommended - auto-updates to latest v1.x.x)
- `devsentinel/github-action@v1.0.0` (pinned to specific version)

## License

MIT

