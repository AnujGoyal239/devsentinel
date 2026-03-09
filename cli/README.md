# DevSentinel CLI

Command-line interface for integrating DevSentinel code analysis into CI/CD pipelines.

## Installation

### From npm (when published)

```bash
npm install -g @devsentinel/cli
```

### From source

```bash
cd cli
npm install
npm run build
npm link
```

## Quick Start

1. **Get your API key** from the DevSentinel dashboard at https://devsentinel.com/dashboard/settings

2. **Set your API key** as an environment variable:

```bash
export DEVSENTINEL_API_KEY="ds_your_api_key_here"
```

3. **Run analysis**:

```bash
# Trigger analysis
devsentinel analyze <project-id>

# Wait for analysis to complete
devsentinel wait <run-id>

# Trigger and wait, fail if health score < 80
devsentinel check <project-id> --threshold 80
```

## Commands

### `analyze <project-id>`

Trigger analysis for a project and return immediately with the run ID.

**Options:**
- `--api-key <key>` - API key (or set `DEVSENTINEL_API_KEY` env var)
- `--api-url <url>` - API URL (default: https://devsentinel.com)
- `--verbose` - Enable verbose output

**Example:**

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

**Exit Codes:**
- `0` - Success
- `1` - Error

---

### `wait <run-id>`

Wait for an analysis run to complete and display the results.

**Options:**
- `--timeout <seconds>` - Maximum wait time (default: no timeout)
- `--api-key <key>` - API key (or set `DEVSENTINEL_API_KEY` env var)
- `--api-url <url>` - API URL (default: https://devsentinel.com)
- `--verbose` - Enable verbose output

**Example:**

```bash
devsentinel wait run_xyz789 --timeout 600
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

**Exit Codes:**
- `0` - Analysis completed successfully
- `1` - Analysis failed or error occurred

---

### `check <project-id> --threshold <score>`

Trigger analysis, wait for completion, and fail if health score is below the threshold. This is the primary command for CI/CD integration.

**Options:**
- `--threshold <score>` - Minimum health score (0-100) **[REQUIRED]**
- `--timeout <seconds>` - Maximum wait time (default: no timeout)
- `--api-key <key>` - API key (or set `DEVSENTINEL_API_KEY` env var)
- `--api-url <url>` - API URL (default: https://devsentinel.com)
- `--verbose` - Enable verbose output

**Example:**

```bash
devsentinel check abc123-def456-ghi789 --threshold 80 --timeout 600
```

**Output (Success):**

```
✓ Analysis triggered
⠋ Understanding codebase (25%)
⠋ Bug detection (60%)
✓ Analysis completed

Results:
  Health Score: 87/100
  Threshold: 80

✓ Health score meets threshold (87 >= 80)
```

**Output (Failure):**

```
✓ Analysis triggered
⠋ Understanding codebase (25%)
✓ Analysis completed

Results:
  Health Score: 65/100
  Threshold: 80

✗ Health score below threshold (65 < 80)

Build failed due to low code quality.
```

**Exit Codes:**
- `0` - Analysis completed and health score >= threshold
- `1` - Analysis failed or error occurred
- `2` - Health score below threshold

---

## Configuration

### Environment Variables

- `DEVSENTINEL_API_KEY` - Your DevSentinel API key (required)
- `DEVSENTINEL_API_URL` - API URL (optional, default: https://devsentinel.com)

### API Key

Get your API key from the DevSentinel dashboard:

1. Go to https://devsentinel.com/dashboard/settings
2. Click "Create API Key"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the key (starts with `ds_`)
5. Store it securely in your CI/CD secrets

**Security Best Practices:**
- Never commit API keys to version control
- Use your CI/CD platform's secret management
- Rotate keys regularly
- Revoke unused keys

---

## CI/CD Integration Examples

### GitHub Actions

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
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install DevSentinel CLI
        run: npm install -g @devsentinel/cli
      
      - name: Run DevSentinel Analysis
        env:
          DEVSENTINEL_API_KEY: ${{ secrets.DEVSENTINEL_API_KEY }}
        run: |
          devsentinel check ${{ secrets.DEVSENTINEL_PROJECT_ID }} \
            --threshold 80 \
            --timeout 600 \
            --verbose
```

**Required Secrets:**
- `DEVSENTINEL_API_KEY` - Your API key
- `DEVSENTINEL_PROJECT_ID` - Your project ID

---

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - analyze

devsentinel:
  stage: analyze
  image: node:18
  before_script:
    - npm install -g @devsentinel/cli
  script:
    - |
      devsentinel check $DEVSENTINEL_PROJECT_ID \
        --threshold 80 \
        --timeout 600 \
        --verbose
  only:
    - main
    - develop
  variables:
    DEVSENTINEL_API_KEY: $DEVSENTINEL_API_KEY
```

**Required Variables:**
- `DEVSENTINEL_API_KEY` - Your API key (masked)
- `DEVSENTINEL_PROJECT_ID` - Your project ID

---

### Jenkins

Create a `Jenkinsfile`:

```groovy
pipeline {
  agent any
  
  environment {
    DEVSENTINEL_API_KEY = credentials('devsentinel-api-key')
    DEVSENTINEL_PROJECT_ID = 'your-project-id'
  }
  
  stages {
    stage('Install CLI') {
      steps {
        sh 'npm install -g @devsentinel/cli'
      }
    }
    
    stage('DevSentinel Analysis') {
      steps {
        sh '''
          devsentinel check $DEVSENTINEL_PROJECT_ID \
            --threshold 80 \
            --timeout 600 \
            --verbose
        '''
      }
    }
  }
  
  post {
    failure {
      echo 'DevSentinel analysis failed or health score below threshold'
    }
  }
}
```

**Required Credentials:**
- `devsentinel-api-key` - Your API key (secret text)

---

### CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1

jobs:
  analyze:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run:
          name: Install DevSentinel CLI
          command: npm install -g @devsentinel/cli
      - run:
          name: Run Analysis
          command: |
            devsentinel check $DEVSENTINEL_PROJECT_ID \
              --threshold 80 \
              --timeout 600 \
              --verbose

workflows:
  version: 2
  build-and-analyze:
    jobs:
      - analyze:
          context: devsentinel
```

**Required Environment Variables (in context):**
- `DEVSENTINEL_API_KEY`
- `DEVSENTINEL_PROJECT_ID`

---

### Travis CI

Create `.travis.yml`:

```yaml
language: node_js
node_js:
  - '18'

before_install:
  - npm install -g @devsentinel/cli

script:
  - |
    devsentinel check $DEVSENTINEL_PROJECT_ID \
      --threshold 80 \
      --timeout 600 \
      --verbose

env:
  global:
    - secure: "encrypted-api-key"
```

---

## Exit Codes

The CLI uses specific exit codes to indicate different outcomes:

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | Analysis completed successfully, health score meets threshold |
| `1` | Error | Analysis failed, API error, or invalid configuration |
| `2` | Threshold Not Met | Analysis completed but health score below threshold |

Use these exit codes in your CI/CD scripts:

```bash
#!/bin/bash

devsentinel check $PROJECT_ID --threshold 80

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✓ Code quality check passed"
elif [ $EXIT_CODE -eq 2 ]; then
  echo "✗ Code quality below threshold"
  # Send notification, create issue, etc.
else
  echo "✗ Analysis failed"
fi

exit $EXIT_CODE
```

---

## Troubleshooting

### Authentication Failed

```
Error: Authentication failed. Please check your API key.
```

**Solution:**
- Verify your API key starts with `ds_`
- Check the key hasn't been revoked
- Ensure the key is set correctly in environment variables

### Resource Not Found

```
Error: Resource not found. Please check the project ID or run ID.
```

**Solution:**
- Verify the project ID is correct
- Ensure you have access to the project
- Check the run ID if using `wait` command

### Rate Limit Exceeded

```
Error: Rate limit exceeded. Please try again later.
```

**Solution:**
- Wait a few minutes before retrying
- Check if multiple CI jobs are running simultaneously
- Contact support if rate limits are too restrictive

### Timeout

```
Error: Analysis did not complete within 600 seconds
```

**Solution:**
- Increase the `--timeout` value
- Check if the analysis is stuck (view in dashboard)
- Contact support if analysis consistently times out

---

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Local Testing

```bash
# Build and link
npm run build
npm link

# Test commands
devsentinel analyze test-project-id
devsentinel wait test-run-id
devsentinel check test-project-id --threshold 80
```

---

## Support

- **Documentation**: https://docs.devsentinel.com
- **Dashboard**: https://devsentinel.com/dashboard
- **Issues**: https://github.com/devsentinel/cli/issues
- **Email**: support@devsentinel.com

---

## License

MIT
