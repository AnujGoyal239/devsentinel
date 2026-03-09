# DevSentinel GitHub Action - Quick Reference

## Installation

Add to your workflow file (`.github/workflows/*.yml`):

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ Yes | - | DevSentinel API key (starts with `ds_`) |
| `project-id` | ✅ Yes | - | Project ID to analyze |
| `threshold` | ❌ No | `80` | Minimum health score (0-100) |
| `timeout` | ❌ No | `600` | Max wait time in seconds |
| `api-url` | ❌ No | `https://devsentinel.com` | API URL |

## Outputs

| Output | Description | Example |
|--------|-------------|---------|
| `health-score` | Health score (0-100) | `87` |
| `status` | Analysis status | `complete` |
| `run-id` | Analysis run ID | `run_abc123` |

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `0` | ✅ Success | Score meets threshold |
| `1` | ❌ Error | API error or failure |
| `2` | ⚠️ Below Threshold | Score < threshold |

## Common Patterns

### Basic Usage

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
```

### Custom Threshold

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 90
```

### Using Outputs

```yaml
- name: Analyze
  id: analyze
  uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}

- name: Use Output
  run: echo "Score: ${{ steps.analyze.outputs.health-score }}"
```

### Continue on Failure

```yaml
- uses: devsentinel/github-action@v1
  continue-on-error: true
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
```

## Triggers

### On Push

```yaml
on:
  push:
    branches: [main]
```

### On Pull Request

```yaml
on:
  pull_request:
    branches: [main]
```

### On Schedule

```yaml
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
```

### Manual Trigger

```yaml
on:
  workflow_dispatch:
```

## Secrets Setup

1. Go to repository → Settings → Secrets and variables → Actions
2. Add secrets:
   - `DEVSENTINEL_API_KEY` - Your API key from dashboard
   - `DEVSENTINEL_PROJECT_ID` - Your project ID

## Platform Support

- ✅ Linux (ubuntu-latest, ubuntu-22.04, ubuntu-20.04)
- ✅ macOS (macos-latest, macos-13, macos-12)
- ❌ Windows (not supported)

## Troubleshooting

### Authentication Failed
- Verify API key starts with `ds_`
- Check key hasn't been revoked
- Ensure secret is set correctly

### Resource Not Found
- Verify project ID is correct
- Ensure you have access to project

### Timeout
- Increase `timeout` value
- Check analysis status in dashboard

## Examples

See `examples/` directory for:
- `basic.yml` - Simple integration
- `advanced.yml` - PR comments + notifications
- `scheduled.yml` - Daily analysis
- `monorepo.yml` - Multiple projects
- `conditional.yml` - Run on file changes

## Links

- **Documentation**: https://docs.devsentinel.com
- **Dashboard**: https://devsentinel.com/dashboard
- **Support**: support@devsentinel.com
- **Issues**: https://github.com/devsentinel/github-action/issues

## Version

Current version: `v1.0.0`

Use `@v1` for automatic updates to latest v1.x.x:
```yaml
uses: devsentinel/github-action@v1
```

Or pin to specific version:
```yaml
uses: devsentinel/github-action@v1.0.0
```
