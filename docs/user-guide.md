# DevSentinel User Guide

## Getting Started

### 1. Sign Up

1. Visit https://devsentinel.com
2. Click "Sign in with GitHub"
3. Authorize DevSentinel to access your repositories (read-only initially)
4. You'll be redirected to your dashboard

### 2. Connect Your First Repository

1. Click "New Project" on your dashboard
2. Enter your GitHub repository URL (e.g., `https://github.com/username/repo`)
3. (Optional) Upload a PRD document (PDF, Markdown, or DOCX)
4. Click "Create Project"

### 3. Upload a PRD (Optional but Recommended)

**Why upload a PRD?**
- DevSentinel will check if your code matches your requirements
- Get PRD compliance findings
- Better context for bug detection

**Supported formats:**
- PDF (.pdf)
- Markdown (.md)
- Word Document (.docx)

**What happens:**
- DevSentinel extracts requirements using AI
- Requirements are linked to findings
- You can review extracted requirements before analysis

### 4. Run Your First Analysis

1. Go to your project page
2. Click "Run Analysis"
3. Watch real-time progress (4 passes):
   - **Pass 1**: Understanding your codebase
   - **Pass 2**: Detecting bugs and checking PRD compliance
   - **Pass 3**: Security audit
   - **Pass 4**: Production readiness check
4. Analysis typically takes 2-5 minutes for a 500-file repository

## Understanding Analysis Results

### Health Score

Your project gets a health score from 0-100:
- **Green (80-100)**: Excellent! Few issues found
- **Yellow (50-79)**: Good, but some improvements needed
- **Red (0-49)**: Needs attention, multiple issues found

**How it's calculated:**
- Critical issue: -20 points
- High severity: -10 points
- Medium severity: -5 points
- Low severity: -2 points
- Info: 0 points

### Finding Categories

**Bug**: Code issues that could cause failures
- Dead links
- Broken imports
- Missing error handling
- Wrong HTTP status codes

**Security**: Vulnerabilities that could be exploited
- SQL injection
- XSS vulnerabilities
- Hardcoded secrets
- Missing authentication

**Production**: Issues that affect production readiness
- Missing rate limiting
- No health check endpoint
- Missing caching strategy

**PRD Compliance**: Mismatches with your requirements
- Missing features
- Incorrect implementations
- Wrong API endpoints

### Finding Details

Each finding shows:
- **Severity**: Critical, High, Medium, Low, or Info
- **File & Line**: Exact location of the issue
- **Explanation**: What's wrong and why it matters
- **Code Snippet**: The problematic code
- **Suggested Fix**: How to fix it (with diff view)
- **Auto-Fix Button**: Let AI fix it automatically

## Using Auto-Fix

### When to Use Auto-Fix

✅ **Good for:**
- Simple bugs (broken imports, typos)
- Missing validation
- Security fixes
- Code style issues

⚠️ **Be careful with:**
- Complex business logic
- Database schema changes
- Authentication changes

### How Auto-Fix Works

1. Click "Auto-Fix" on any finding
2. DevSentinel will:
   - Create an isolated sandbox
   - Clone your repository
   - Use AI to write the fix
   - Run linter and tests
   - Create a Pull Request
3. Review the PR on GitHub
4. Merge if you're happy with the fix

**Note:** DevSentinel NEVER auto-merges. You always review first.

### Scope Escalation

First time using Auto-Fix:
- DevSentinel needs `repo:write` permission
- You'll be prompted to grant additional access
- This allows creating branches and PRs

## Reviewing and Merging PRs

### PR Structure

Each Auto-Fix PR includes:
- **Title**: Clear description of the fix
- **Body**: 
  - Original issue explanation
  - What was changed
  - How it was tested
- **Files Changed**: Diff view of all changes

### Review Checklist

- [ ] Does the fix address the issue?
- [ ] Are there any unintended changes?
- [ ] Do tests pass?
- [ ] Is the code style consistent?
- [ ] Are there security implications?

### Merging

1. Review the PR thoroughly
2. Run tests locally if needed
3. Click "Merge Pull Request" on GitHub
4. Delete the branch after merging

## Dashboard Features

### Project List

- View all your projects
- See health scores at a glance
- Check last analysis time
- Quick access to reports

### Analysis History

- View past analysis runs
- Compare health scores over time
- Track improvements
- See trend charts

### Filters

- Filter findings by severity
- Filter by category
- Search by file name
- Show only unfixed issues

## Advanced Features

### Custom Analysis Rules

Create your own rules in YAML:

```yaml
name: No console.log in production
pattern: console\.log
severity: medium
message: Remove console.log statements before production
```

### API Key Authentication

For CI/CD integration:
1. Go to Settings → API Keys
2. Click "Generate New Key"
3. Copy the key (shown once!)
4. Use in your CI/CD pipeline

### GitHub Webhooks

Auto-trigger analysis on push:
1. Go to Project Settings
2. Copy webhook URL
3. Add to GitHub repository webhooks
4. Analysis runs automatically on every push

### CLI Tool

Install the CLI for CI/CD:

```bash
npm install -g @devsentinel/cli

# Run analysis
devsentinel analyze --project-id=<id> --api-key=<key>

# Wait for completion
devsentinel wait --run-id=<run-id>

# Check health score
devsentinel check --run-id=<run-id> --threshold=80
```

## FAQ

### How much does it cost?

DevSentinel uses free-tier services. You only pay for:
- Groq API usage (very affordable)
- E2B sandboxes for Auto-Fix (pay-as-you-go)

### Is my code secure?

Yes:
- Code is analyzed in isolated environments
- No code is stored permanently
- Sandboxes have no internet access
- All data encrypted in transit and at rest

### How accurate is the analysis?

- AI-powered analysis is very accurate
- Some false positives may occur
- You can mark findings as "Won't Fix"
- Custom rules help reduce noise

### Can I use it for private repositories?

Yes! DevSentinel works with both public and private repositories.

### What languages are supported?

All major languages:
- JavaScript/TypeScript
- Python
- Go
- Ruby
- Java
- PHP
- And more!

### How long does analysis take?

- Small repos (<100 files): 1-2 minutes
- Medium repos (100-500 files): 2-5 minutes
- Large repos (500+ files): 5-10 minutes

### Can I cancel an analysis?

Not currently, but you can close the page and check back later.

### What if Auto-Fix breaks something?

- All changes are in a PR, not merged automatically
- You can close the PR without merging
- Tests run before PR creation
- You always have final control

### How do I delete my account?

1. Go to Settings → Account
2. Click "Delete Account"
3. Confirm deletion
4. All data deleted within 30 days

## Getting Help

### Documentation

- User Guide: https://docs.devsentinel.com/user-guide
- API Documentation: https://docs.devsentinel.com/api
- Developer Docs: https://docs.devsentinel.com/developers

### Support

- Email: support@devsentinel.com
- GitHub Issues: https://github.com/devsentinel/devsentinel/issues
- Discord: https://discord.gg/devsentinel

### Status Page

Check service status: https://status.devsentinel.com

## Tips and Best Practices

### For Best Results

1. **Upload a PRD**: Better context = better analysis
2. **Run regularly**: Catch issues early
3. **Fix high-severity first**: Prioritize critical and high issues
4. **Review Auto-Fix PRs**: Don't blindly merge
5. **Use custom rules**: Tailor analysis to your needs

### Performance Tips

1. **Use .gitignore**: Exclude unnecessary files
2. **Batch fixes**: Fix multiple issues in one PR
3. **Set up webhooks**: Auto-analyze on push
4. **Use CLI in CI/CD**: Fail builds on low health scores

### Security Tips

1. **Review security findings immediately**
2. **Never commit secrets**: Use environment variables
3. **Keep dependencies updated**
4. **Enable 2FA on GitHub**
5. **Rotate API keys regularly**

## Keyboard Shortcuts

- `N`: New project
- `R`: Run analysis
- `F`: Filter findings
- `?`: Show help
- `Esc`: Close modals

## Changelog

Stay updated: https://devsentinel.com/changelog

## Feedback

We'd love to hear from you!
- Feature requests: feedback@devsentinel.com
- Bug reports: bugs@devsentinel.com
- General feedback: hello@devsentinel.com
