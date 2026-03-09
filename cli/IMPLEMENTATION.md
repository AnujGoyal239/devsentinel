# DevSentinel CLI Implementation

This document describes the technical implementation of the DevSentinel CLI tool.

## Architecture

### Overview

The CLI is built as a standalone Node.js package that can be installed globally or locally. It provides three main commands for CI/CD integration:

1. **analyze** - Trigger analysis and return immediately
2. **wait** - Wait for analysis to complete
3. **check** - Trigger, wait, and fail if health score below threshold

### Technology Stack

- **TypeScript** - Type safety and better developer experience
- **Commander.js** - CLI argument parsing and command structure
- **Axios** - HTTP client for API requests
- **Chalk** - Colored terminal output
- **Ora** - Loading spinners and progress indicators

### Project Structure

```
cli/
├── src/
│   ├── __tests__/
│   │   └── api.test.ts          # Unit tests for API client
│   ├── commands/
│   │   ├── analyze.ts           # Analyze command implementation
│   │   ├── check.ts             # Check command implementation
│   │   └── wait.ts              # Wait command implementation
│   ├── api.ts                   # API client for DevSentinel
│   ├── index.ts                 # CLI entry point
│   └── types.ts                 # TypeScript type definitions
├── examples/
│   ├── github-actions.yml       # GitHub Actions example
│   ├── gitlab-ci.yml            # GitLab CI example
│   ├── Jenkinsfile              # Jenkins example
│   └── circleci-config.yml      # CircleCI example
├── dist/                        # Compiled JavaScript (generated)
├── package.json                 # Package configuration
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Test configuration
├── README.md                    # User documentation
├── USAGE.md                     # Detailed usage guide
└── IMPLEMENTATION.md            # This file

```

## Core Components

### 1. API Client (`src/api.ts`)

The `DevSentinelAPI` class handles all communication with the DevSentinel platform.

**Key Features:**
- Axios-based HTTP client with authentication
- Automatic error handling and user-friendly error messages
- SSE (Server-Sent Events) streaming for real-time progress
- Timeout support
- Verbose logging option

**Methods:**
- `triggerAnalysis(projectId)` - POST to `/api/projects/:id/analyse`
- `getAnalysisRun(runId)` - GET from `/api/analysis-runs/:id`
- `getProject(projectId)` - GET from `/api/projects/:id`
- `streamProgress(runId, callbacks)` - SSE stream from `/api/stream/:id`

**Error Handling:**
- 401: Authentication failed
- 404: Resource not found
- 429: Rate limit exceeded
- Network errors: Connection issues
- Generic errors: Fallback messages

### 2. Commands

#### Analyze Command (`src/commands/analyze.ts`)

Triggers analysis and returns immediately with the run ID.

**Flow:**
1. Create API client with config
2. Call `triggerAnalysis(projectId)`
3. Display run ID and status
4. Exit with code 0 (success) or 1 (error)

**Output:**
- Success: Run ID, project ID, status
- Error: Error message with details

#### Wait Command (`src/commands/wait.ts`)

Waits for an analysis run to complete using SSE streaming.

**Flow:**
1. Create API client with config
2. Start SSE stream with `streamProgress(runId)`
3. Update spinner with progress events
4. On complete: Display health score and exit
5. On error: Display error and exit

**Features:**
- Real-time progress updates
- Timeout support (optional)
- Verbose logging of progress messages
- Color-coded health score display

#### Check Command (`src/commands/check.ts`)

Combines analyze + wait + threshold checking for CI/CD.

**Flow:**
1. Trigger analysis
2. Wait for completion (with SSE streaming)
3. Compare health score to threshold
4. Exit with appropriate code:
   - 0: Success (score >= threshold)
   - 1: Error (analysis failed)
   - 2: Threshold not met (score < threshold)

**Features:**
- All features of analyze + wait
- Threshold validation (0-100)
- Clear success/failure messages
- Appropriate exit codes for CI/CD

### 3. CLI Entry Point (`src/index.ts`)

The main CLI application using Commander.js.

**Features:**
- Command registration and routing
- Global options (--api-key, --api-url, --verbose)
- Configuration management (env vars + flags)
- API key validation
- Help text and version info

**Configuration Priority:**
1. Command-line flags (highest priority)
2. Environment variables
3. Default values (lowest priority)

### 4. Type Definitions (`src/types.ts`)

TypeScript interfaces for type safety.

**Key Types:**
- `CLIConfig` - CLI configuration
- `AnalysisRunResponse` - API response for analysis runs
- `ProjectResponse` - API response for projects
- `ProgressEvent` - SSE progress event
- `ExitCode` - Exit code enum

## Exit Codes

The CLI uses specific exit codes to communicate results to CI/CD systems:

| Exit Code | Constant | Meaning |
|-----------|----------|---------|
| 0 | `ExitCode.SUCCESS` | Analysis completed, health score >= threshold |
| 1 | `ExitCode.ERROR` | Analysis failed, API error, or invalid config |
| 2 | `ExitCode.THRESHOLD_NOT_MET` | Analysis completed but health score < threshold |

**Why Exit Code 2?**

Exit code 2 allows CI/CD systems to distinguish between:
- Technical failures (exit 1) - retry might help
- Quality failures (exit 2) - code needs improvement

Example usage in CI/CD:
```bash
devsentinel check $PROJECT_ID --threshold 80
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "Code quality below threshold - creating issue..."
  # Create GitHub issue, send notification, etc.
fi
```

## Authentication

### API Key Format

API keys follow the format: `ds_<base64url-encoded-32-bytes>`

Example: `ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz`

### Configuration Methods

1. **Environment Variable (Recommended)**
   ```bash
   export DEVSENTINEL_API_KEY="ds_..."
   ```

2. **Command-line Flag**
   ```bash
   devsentinel analyze <project-id> --api-key "ds_..."
   ```

3. **.env File (Local Development)**
   ```bash
   echo "DEVSENTINEL_API_KEY=ds_..." > .env
   ```

### Validation

The CLI validates API keys before making requests:
- Must start with `ds_` prefix
- Must be non-empty
- Format validation (basic)

## Progress Streaming

### SSE (Server-Sent Events)

The CLI uses SSE for real-time progress updates during analysis.

**Why SSE?**
- Unidirectional (server → client) is sufficient
- Native HTTP (works everywhere)
- Auto-reconnect built in
- Simpler than WebSockets

**Event Format:**
```json
{
  "status": "running",
  "current_stage": "Bug detection",
  "current_progress": 60,
  "message": "Analyzing src/api/auth.ts (47/200 files)"
}
```

**Completion Event:**
```json
{
  "status": "complete",
  "health_score": 87,
  "current_progress": 100
}
```

**Error Event:**
```json
{
  "status": "failed",
  "error_message": "Analysis failed: timeout"
}
```

### Progress Display

The CLI uses Ora spinners to display progress:

```
⠋ Bug detection (60%)
```

Updates in real-time as events arrive from the SSE stream.

## Error Handling

### Error Types

1. **Authentication Errors (401)**
   - Message: "Authentication failed. Please check your API key."
   - Cause: Invalid or revoked API key
   - Solution: Verify API key in dashboard

2. **Not Found Errors (404)**
   - Message: "Resource not found. Please check the project ID or run ID."
   - Cause: Invalid project/run ID or no access
   - Solution: Verify ID is correct

3. **Rate Limit Errors (429)**
   - Message: "Rate limit exceeded. Please try again later."
   - Cause: Too many requests
   - Solution: Wait and retry, or stagger CI jobs

4. **Network Errors**
   - Message: "No response from server. Please check your network connection."
   - Cause: Network issues, firewall, proxy
   - Solution: Check connectivity, verify API URL

5. **Timeout Errors**
   - Message: "Analysis did not complete within X seconds"
   - Cause: Analysis taking too long
   - Solution: Increase timeout or check dashboard

### Error Display

Errors are displayed with:
- Red color (chalk.red)
- Clear error message
- Actionable suggestions
- Verbose details (if --verbose flag)

## Testing

### Unit Tests

Located in `src/__tests__/api.test.ts`

**Coverage:**
- API client initialization
- Successful API calls
- Error handling (401, 404, 429)
- Response parsing

**Test Framework:**
- Vitest (fast, modern test runner)
- Mocking with vi.mock()
- Axios mocking for HTTP requests

**Running Tests:**
```bash
npm test                    # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

### Integration Testing

Manual testing checklist:

1. **Authentication**
   - Valid API key
   - Invalid API key
   - Missing API key
   - Revoked API key

2. **Commands**
   - analyze: Success, error
   - wait: Success, timeout, error
   - check: Pass threshold, fail threshold, error

3. **Progress Streaming**
   - Real-time updates
   - Completion handling
   - Error handling

4. **Exit Codes**
   - 0: Success
   - 1: Error
   - 2: Threshold not met

## Building and Publishing

### Build Process

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` directory.

**Output:**
- `dist/index.js` - CLI entry point (with shebang)
- `dist/**/*.js` - Compiled modules
- `dist/**/*.d.ts` - Type definitions
- `dist/**/*.map` - Source maps

### Package Configuration

**package.json:**
```json
{
  "name": "@devsentinel/cli",
  "version": "1.0.0",
  "bin": {
    "devsentinel": "dist/index.js"
  },
  "type": "module",
  "main": "dist/index.js"
}
```

**Key Fields:**
- `bin`: Defines the CLI command
- `type: "module"`: Use ES modules
- `main`: Entry point for imports

### Publishing to npm

```bash
# Build
npm run build

# Test locally
npm link
devsentinel --version

# Publish
npm publish --access public
```

**Requirements:**
- npm account
- Organization: @devsentinel
- Public access

### Installation

After publishing:

```bash
# Global installation
npm install -g @devsentinel/cli

# Local installation
npm install --save-dev @devsentinel/cli
```

## CI/CD Integration

### GitHub Actions

**Key Features:**
- Secrets management
- PR comments on failure
- Branch filtering
- Parallel jobs

**Example:**
```yaml
- name: Run DevSentinel
  env:
    DEVSENTINEL_API_KEY: ${{ secrets.DEVSENTINEL_API_KEY }}
  run: |
    npm install -g @devsentinel/cli
    devsentinel check ${{ secrets.DEVSENTINEL_PROJECT_ID }} --threshold 80
```

### GitLab CI

**Key Features:**
- Masked variables
- Stage-based pipeline
- allow_failure option
- Branch rules

**Example:**
```yaml
devsentinel:
  stage: analyze
  image: node:18
  script:
    - npm install -g @devsentinel/cli
    - devsentinel check $DEVSENTINEL_PROJECT_ID --threshold 80
```

### Jenkins

**Key Features:**
- Credentials management
- Pipeline stages
- Email notifications
- Exit code handling

**Example:**
```groovy
stage('DevSentinel') {
  steps {
    sh 'npm install -g @devsentinel/cli'
    sh 'devsentinel check $DEVSENTINEL_PROJECT_ID --threshold 80'
  }
}
```

### CircleCI

**Key Features:**
- Contexts for secrets
- Reusable commands
- Workflows
- Docker images

**Example:**
```yaml
- run:
    name: Run Analysis
    command: |
      npm install -g @devsentinel/cli
      devsentinel check $DEVSENTINEL_PROJECT_ID --threshold 80
```

## Performance Considerations

### Startup Time

- CLI startup: ~100ms
- API request: ~200-500ms
- Total time to trigger: <1 second

### Analysis Duration

- Small projects (<100 files): 2-3 minutes
- Medium projects (100-500 files): 3-5 minutes
- Large projects (>500 files): 5-10 minutes

### Timeout Recommendations

- Default: No timeout (wait indefinitely)
- CI/CD: 600 seconds (10 minutes)
- Large projects: 1200 seconds (20 minutes)

### Network Usage

- Trigger analysis: ~1 KB
- SSE streaming: ~100 bytes/second
- Total for 5-minute analysis: ~30 KB

## Security Considerations

### API Key Storage

**Best Practices:**
- Never commit to version control
- Use CI/CD secrets management
- Rotate keys every 90 days
- Revoke unused keys

**Bad:**
```bash
# Hardcoded in script
devsentinel check proj123 --api-key "ds_abc123..."
```

**Good:**
```bash
# Environment variable
export DEVSENTINEL_API_KEY="ds_abc123..."
devsentinel check proj123
```

### HTTPS Only

All API requests use HTTPS:
- Default: `https://devsentinel.com`
- Custom: Must be HTTPS URL

### No Sensitive Data in Logs

The CLI never logs:
- Full API keys (only prefix shown)
- Authentication tokens
- Sensitive project data

## Future Enhancements

### Planned Features

1. **JSON Output Mode**
   ```bash
   devsentinel check <project-id> --threshold 80 --json
   ```
   For programmatic parsing in scripts.

2. **Webhook Support**
   ```bash
   devsentinel check <project-id> --webhook "https://..."
   ```
   Send results to webhook URL.

3. **Multiple Projects**
   ```bash
   devsentinel check-all --config projects.yml
   ```
   Analyze multiple projects in parallel.

4. **Report Generation**
   ```bash
   devsentinel report <run-id> --format pdf --output report.pdf
   ```
   Generate PDF reports from CLI.

5. **Interactive Mode**
   ```bash
   devsentinel interactive
   ```
   Interactive CLI for exploring results.

### Potential Improvements

- Caching of API responses
- Offline mode with cached data
- Plugin system for custom commands
- Configuration file support (.devsentinelrc)
- Shell completion (bash, zsh, fish)

## Troubleshooting

### Common Issues

1. **"Command not found: devsentinel"**
   - Solution: Run `npm install -g @devsentinel/cli`
   - Or use: `npx @devsentinel/cli`

2. **"Authentication failed"**
   - Solution: Check API key is correct
   - Verify key hasn't been revoked
   - Ensure environment variable is set

3. **"Module not found" errors**
   - Solution: Run `npm install` in cli directory
   - Rebuild: `npm run build`

4. **Tests failing**
   - Solution: Clear node_modules and reinstall
   - Check Node.js version (>=18.0.0)

### Debug Mode

Enable verbose output:
```bash
devsentinel check <project-id> --threshold 80 --verbose
```

Shows:
- API endpoints
- Request/response details
- Progress events
- Error stack traces

## Support

- **Documentation**: https://docs.devsentinel.com
- **GitHub Issues**: https://github.com/devsentinel/cli/issues
- **Email**: support@devsentinel.com

## License

MIT
