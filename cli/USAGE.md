# DevSentinel CLI Usage Guide

Complete guide for using the DevSentinel CLI in various scenarios.

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [CI/CD Integration](#cicd-integration)
- [Exit Codes](#exit-codes)
- [Troubleshooting](#troubleshooting)

## Installation

### Global Installation (Recommended for CI/CD)

```bash
npm install -g @devsentinel/cli
```

### Local Installation

```bash
npm install --save-dev @devsentinel/cli
```

Then use via npx:

```bash
npx devsentinel analyze <project-id>
```

### From Source

```bash
git clone https://github.com/devsentinel/cli.git
cd cli
npm install
npm run build
npm link
```

## Authentication

### API Key Setup

1. **Get your API key** from the DevSentinel dashboard:
   - Go to https://devsentinel.com/dashboard/settings
   - Click "Create API Key"
   - Give it a descriptive name (e.g., "GitHub Actions", "Jenkins")
   - Copy the key (it starts with `ds_`)
   - **Important**: Store it securely - it's only shown once!

2. **Set the API key** using one of these methods:

   **Method 1: Environment Variable (Recommended)**
   ```bash
   export DEVSENTINEL_API_KEY="ds_your_api_key_here"
   ```

   **Method 2: Command-line Flag**
   ```bash
   devsentinel analyze <project-id> --api-key "ds_your_api_key_here"
   ```

   **Method 3: .env File (Local Development)**
   ```bash
   echo "DEVSENTINEL_API_KEY=ds_your_api_key_here" > .env
   ```

### API URL Configuration

By default, the CLI uses `https://devsentinel.com`. For self-hosted or staging environments:

```bash
export DEVSENTINEL_API_URL="https://staging.devsentinel.com"
```

Or use the flag:

```bash
devsentinel analyze <project-id> --api-url "https://staging.devsentinel.com"
```

## Basic Usage

### 1. Trigger Analysis

Start an analysis and get the run ID:

```bash
devsentinel analyze abc123-def456-ghi789
```

**Output:**
```
✓ Analysis triggered successfully

Analysis Details:
  Run ID: run_xyz789
  Project ID: abc123-def456-ghi789
  Status: queued

To wait for completion, run:
  devsentinel wait run_xyz789
```

### 2. Wait for Completion

Wait for an analysis to finish:

```bash
devsentinel wait run_xyz789
```

**Output:**
```
⠋ Understanding codebase (25%)
⠋ Bug detection (60%)
⠋ Security audit (80%)
✓ Analysis completed successfully

Results:
  Health Score: 87/100
  Status: Complete
```

### 3. Check with Threshold (CI/CD)

Trigger analysis and fail if health score is below threshold:

```bash
devsentinel check abc123-def456-ghi789 --threshold 80
```

**Success Output:**
```
✓ Analysis triggered
⠋ Understanding codebase (25%)
✓ Analysis completed

Results:
  Health Score: 87/100
  Threshold: 80

✓ Health score meets threshold (87 >= 80)
```

**Failure Output:**
```
✓ Analysis triggered
✓ Analysis completed

Results:
  Health Score: 65/100
  Threshold: 80

✗ Health score below threshold (65 < 80)

Build failed due to low code quality.
```

## Advanced Usage

### Verbose Output

Enable detailed logging:

```bash
devsentinel check <project-id> --threshold 80 --verbose
```

Shows:
- API requests and responses
- Detailed progress messages
- Timestamps
- Debug information

### Timeout Configuration

Set a maximum wait time (in seconds):

```bash
devsentinel wait <run-id> --timeout 600
```

If analysis doesn't complete within 600 seconds (10 minutes), the command exits with error code 1.

### JSON Output (Coming Soon)

For programmatic parsing:

```bash
devsentinel check <project-id> --threshold 80 --json
```

### Multiple Projects

Analyze multiple projects in sequence:

```bash
#!/bin/bash

PROJECTS=("proj1" "proj2" "proj3")
THRESHOLD=80

for PROJECT_ID in "${PROJECTS[@]}"; do
  echo "Analyzing $PROJECT_ID..."
  devsentinel check "$PROJECT_ID" --threshold $THRESHOLD
  
  if [ $? -ne 0 ]; then
    echo "Failed: $PROJECT_ID"
    exit 1
  fi
done

echo "All projects passed!"
```

### Parallel Analysis

Analyze multiple projects in parallel:

```bash
#!/bin/bash

PROJECTS=("proj1" "proj2" "proj3")

# Trigger all analyses
for PROJECT_ID in "${PROJECTS[@]}"; do
  devsentinel analyze "$PROJECT_ID" &
done

# Wait for all to complete
wait

echo "All analyses triggered"
```

## CI/CD Integration

### GitHub Actions

**Basic Setup:**

```yaml
- name: Run DevSentinel
  env:
    DEVSENTINEL_API_KEY: ${{ secrets.DEVSENTINEL_API_KEY }}
  run: |
    npm install -g @devsentinel/cli
    devsentinel check ${{ secrets.DEVSENTINEL_PROJECT_ID }} --threshold 80
```

**With PR Comments:**

```yaml
- name: Run DevSentinel
  id: devsentinel
  continue-on-error: true
  env:
    DEVSENTINEL_API_KEY: ${{ secrets.DEVSENTINEL_API_KEY }}
  run: |
    npm install -g @devsentinel/cli
    devsentinel check ${{ secrets.DEVSENTINEL_PROJECT_ID }} --threshold 80

- name: Comment on PR
  if: failure() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '❌ DevSentinel analysis failed. Please review code quality issues.'
      })
```

### GitLab CI

```yaml
devsentinel:
  stage: analyze
  image: node:18
  before_script:
    - npm install -g @devsentinel/cli
  script:
    - devsentinel check $DEVSENTINEL_PROJECT_ID --threshold 80 --timeout 600
  only:
    - main
    - merge_requests
```

### Jenkins

```groovy
stage('DevSentinel') {
  steps {
    sh 'npm install -g @devsentinel/cli'
    sh '''
      devsentinel check $DEVSENTINEL_PROJECT_ID \
        --threshold 80 \
        --timeout 600 \
        --verbose
    '''
  }
}
```

### CircleCI

```yaml
- run:
    name: Install CLI
    command: npm install -g @devsentinel/cli

- run:
    name: Run Analysis
    command: |
      devsentinel check $DEVSENTINEL_PROJECT_ID \
        --threshold 80 \
        --timeout 600
```

## Exit Codes

The CLI uses specific exit codes for different scenarios:

| Exit Code | Meaning | When It Happens |
|-----------|---------|-----------------|
| `0` | Success | Analysis completed, health score >= threshold |
| `1` | Error | API error, authentication failed, network issue, invalid config |
| `2` | Threshold Not Met | Analysis completed successfully but health score < threshold |

### Using Exit Codes in Scripts

```bash
#!/bin/bash

devsentinel check $PROJECT_ID --threshold 80

EXIT_CODE=$?

case $EXIT_CODE in
  0)
    echo "✓ Success: Code quality check passed"
    # Continue with deployment
    ;;
  1)
    echo "✗ Error: Analysis failed"
    # Send alert to team
    exit 1
    ;;
  2)
    echo "⚠ Warning: Health score below threshold"
    # Create GitHub issue
    # Send notification
    exit 1
    ;;
esac
```

### Conditional Failure

Allow analysis to fail without failing the build:

```bash
devsentinel check $PROJECT_ID --threshold 80 || echo "Analysis failed but continuing..."
```

Or in CI/CD:

```yaml
# GitHub Actions
- name: Run DevSentinel
  continue-on-error: true
  run: devsentinel check $PROJECT_ID --threshold 80

# GitLab CI
devsentinel:
  script:
    - devsentinel check $PROJECT_ID --threshold 80
  allow_failure: true
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Error:**
```
Error: Authentication failed. Please check your API key.
```

**Solutions:**
- Verify API key starts with `ds_`
- Check key hasn't been revoked in dashboard
- Ensure environment variable is set correctly
- Try creating a new API key

**Debug:**
```bash
echo $DEVSENTINEL_API_KEY  # Should show your key
devsentinel analyze <project-id> --verbose  # Shows auth details
```

#### 2. Resource Not Found

**Error:**
```
Error: Resource not found. Please check the project ID or run ID.
```

**Solutions:**
- Verify project ID is correct
- Check you have access to the project
- Ensure project exists in dashboard
- For `wait` command, verify run ID is valid

**Debug:**
```bash
# List your projects in the dashboard
# Copy the correct project ID
```

#### 3. Rate Limit Exceeded

**Error:**
```
Error: Rate limit exceeded. Please try again later.
```

**Solutions:**
- Wait 1-2 minutes before retrying
- Check if multiple CI jobs are running
- Stagger CI jobs if running many in parallel
- Contact support for higher limits

#### 4. Timeout

**Error:**
```
Error: Analysis did not complete within 600 seconds
```

**Solutions:**
- Increase timeout: `--timeout 1200`
- Check analysis status in dashboard
- Verify analysis isn't stuck
- Contact support if consistently timing out

#### 5. Network Issues

**Error:**
```
Error: No response from server. Please check your network connection.
```

**Solutions:**
- Check internet connectivity
- Verify API URL is correct
- Check firewall/proxy settings
- Try with `--verbose` for more details

### Debug Mode

Enable verbose output for troubleshooting:

```bash
devsentinel check <project-id> --threshold 80 --verbose
```

Shows:
- API endpoint being called
- Request headers (API key masked)
- Response status codes
- Detailed error messages
- Progress events

### Getting Help

If you're still having issues:

1. **Check the documentation**: https://docs.devsentinel.com
2. **View dashboard**: https://devsentinel.com/dashboard
3. **GitHub Issues**: https://github.com/devsentinel/cli/issues
4. **Email support**: support@devsentinel.com

Include in your support request:
- CLI version: `devsentinel --version`
- Command you ran (with sensitive data removed)
- Full error message
- Output with `--verbose` flag

## Best Practices

### 1. Store API Keys Securely

❌ **Don't:**
```bash
# Hardcoded in script
devsentinel check proj123 --api-key "ds_abc123..." --threshold 80
```

✅ **Do:**
```bash
# Use environment variable
export DEVSENTINEL_API_KEY="ds_abc123..."
devsentinel check proj123 --threshold 80
```

### 2. Set Appropriate Thresholds

- **Production branches (main)**: 80-90
- **Development branches**: 70-80
- **Feature branches**: 60-70 (or allow failure)

### 3. Use Timeouts

Always set a timeout in CI/CD to prevent hanging builds:

```bash
devsentinel check $PROJECT_ID --threshold 80 --timeout 600
```

### 4. Handle Exit Codes

Don't ignore exit codes - handle them appropriately:

```bash
if ! devsentinel check $PROJECT_ID --threshold 80; then
  echo "Analysis failed - check logs"
  exit 1
fi
```

### 5. Rotate API Keys

- Create new keys every 90 days
- Revoke old keys after rotation
- Use descriptive names for tracking

### 6. Monitor Usage

- Check `last_used_at` in dashboard
- Revoke unused keys
- Track which CI/CD jobs use which keys

## Examples

See the `examples/` directory for complete CI/CD configurations:

- `github-actions.yml` - GitHub Actions workflow
- `gitlab-ci.yml` - GitLab CI configuration
- `Jenkinsfile` - Jenkins pipeline
- `circleci-config.yml` - CircleCI configuration

## Support

- **Documentation**: https://docs.devsentinel.com
- **Dashboard**: https://devsentinel.com/dashboard
- **CLI Issues**: https://github.com/devsentinel/cli/issues
- **Email**: support@devsentinel.com
