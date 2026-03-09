# Publishing DevSentinel GitHub Action to Marketplace

This guide explains how to publish the DevSentinel GitHub Action to the GitHub Marketplace.

## Prerequisites

1. **GitHub Organization**: You need a GitHub organization account (e.g., `devsentinel`)
2. **Repository Access**: Admin access to create repositories in the organization
3. **Action Files**: The action.yml and README.md files from this directory

## Step 1: Create the Repository

1. Go to https://github.com/organizations/devsentinel/repositories/new
2. Repository name: `github-action`
3. Description: "Official GitHub Action for DevSentinel code analysis"
4. Visibility: **Public** (required for Marketplace)
5. Initialize with: None (we'll push our files)
6. Click "Create repository"

## Step 2: Prepare the Repository

### Clone and Setup

```bash
# Clone the new repository
git clone https://github.com/devsentinel/github-action.git
cd github-action

# Copy action files
cp /path/to/devsentinel/github-action/action.yml .
cp /path/to/devsentinel/github-action/README.md .

# Create LICENSE file
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 DevSentinel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
EOF
```

### Repository Structure

Your repository should look like this:

```
github-action/
├── action.yml          # Action metadata (required)
├── README.md           # Documentation (required)
├── LICENSE             # MIT License (required)
└── .gitignore          # Git ignore file
```

## Step 3: Commit and Push

```bash
# Add all files
git add .

# Commit
git commit -m "Initial release of DevSentinel GitHub Action"

# Push to main branch
git push origin main
```

## Step 4: Create a Release

### Using GitHub Web Interface

1. Go to https://github.com/devsentinel/github-action/releases/new
2. Click "Choose a tag"
3. Type `v1.0.0` and click "Create new tag: v1.0.0 on publish"
4. Release title: `v1.0.0 - Initial Release`
5. Description:

```markdown
## 🎉 Initial Release

Official GitHub Action for DevSentinel code analysis.

### Features

- ✅ Easy integration with GitHub workflows
- ✅ Automatic health score validation
- ✅ Configurable quality thresholds
- ✅ Detailed outputs for downstream steps
- ✅ Support for Linux and macOS runners

### Usage

```yaml
- uses: devsentinel/github-action@v1
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
```

See the [README](https://github.com/devsentinel/github-action#readme) for full documentation.

### What's Changed

- Initial implementation of composite action
- CLI integration for analysis execution
- Comprehensive documentation and examples
```

6. **Important**: Check the box "Publish this Action to the GitHub Marketplace"
7. Select primary category: **Code Quality**
8. Select additional categories (optional):
   - **Continuous Integration**
   - **Testing**
9. Review the terms and check the box to agree
10. Click "Publish release"

### Using Git Command Line

```bash
# Create and push tag
git tag -a v1.0.0 -m "Release v1.0.0 - Initial Release"
git push origin v1.0.0

# Then create the release via GitHub web interface
```

## Step 5: Create Major Version Tag

Create a `v1` tag that points to the latest `v1.x.x` release. This allows users to use `@v1` and automatically get patch updates.

```bash
# Create v1 tag pointing to v1.0.0
git tag -fa v1 -m "Update v1 to v1.0.0"
git push origin v1 --force
```

**Important**: Update the `v1` tag whenever you release a new `v1.x.x` version:

```bash
# After releasing v1.1.0
git tag -fa v1 -m "Update v1 to v1.1.0"
git push origin v1 --force
```

## Step 6: Verify Publication

1. Go to https://github.com/marketplace
2. Search for "DevSentinel"
3. Your action should appear in the results
4. Click on it to view the marketplace page
5. Verify all information is correct

## Step 7: Update Documentation

Update the main DevSentinel documentation to reference the GitHub Action:

1. Add a section to the main README
2. Update the docs site with GitHub Actions integration guide
3. Add the action to the CI/CD integration examples

## Version Management

### Semantic Versioning

Follow semantic versioning (semver) for releases:

- **Major version** (v2.0.0): Breaking changes
- **Minor version** (v1.1.0): New features, backward compatible
- **Patch version** (v1.0.1): Bug fixes, backward compatible

### Version Tags

Maintain three types of tags:

1. **Specific version**: `v1.0.0`, `v1.1.0`, `v1.2.0`
2. **Major version**: `v1` (points to latest v1.x.x)
3. **Latest**: `latest` (optional, points to latest stable)

### Releasing Updates

#### Patch Release (v1.0.1)

```bash
# Make your changes
git add .
git commit -m "Fix: Description of bug fix"

# Create tag
git tag -a v1.0.1 -m "Release v1.0.1 - Bug fixes"
git push origin v1.0.1

# Update v1 tag
git tag -fa v1 -m "Update v1 to v1.0.1"
git push origin v1 --force

# Create GitHub release
# Go to https://github.com/devsentinel/github-action/releases/new
```

#### Minor Release (v1.1.0)

```bash
# Make your changes
git add .
git commit -m "Feature: Description of new feature"

# Create tag
git tag -a v1.1.0 -m "Release v1.1.0 - New features"
git push origin v1.1.0

# Update v1 tag
git tag -fa v1 -m "Update v1 to v1.1.0"
git push origin v1 --force

# Create GitHub release
```

#### Major Release (v2.0.0)

```bash
# Make your breaking changes
git add .
git commit -m "Breaking: Description of breaking changes"

# Create tag
git tag -a v2.0.0 -m "Release v2.0.0 - Breaking changes"
git push origin v2.0.0

# Create v2 tag
git tag -a v2 -m "Create v2 tag"
git push origin v2

# Create GitHub release with migration guide
```

## Best Practices

### 1. Testing Before Release

Always test the action in a real workflow before releasing:

```yaml
# .github/workflows/test-action.yml
name: Test Action

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./  # Test the local action
        with:
          api-key: ${{ secrets.TEST_API_KEY }}
          project-id: ${{ secrets.TEST_PROJECT_ID }}
          threshold: 70
```

### 2. Changelog

Maintain a CHANGELOG.md file:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-01-15

### Added
- Initial release
- Support for Linux and macOS runners
- Health score threshold validation
- Detailed outputs for downstream steps

## [Unreleased]

### Added
- Nothing yet
```

### 3. Security

- Never commit API keys or secrets
- Use GitHub's secret scanning
- Keep dependencies updated
- Monitor security advisories

### 4. Documentation

- Keep README.md up to date
- Add examples for common use cases
- Document all inputs and outputs
- Include troubleshooting section

### 5. Support

- Enable GitHub Discussions for questions
- Use GitHub Issues for bug reports
- Respond to issues promptly
- Maintain a support email

## Marketplace Optimization

### Action Metadata (action.yml)

Ensure your action.yml has:

- Clear, descriptive name
- Concise description (under 125 characters)
- Appropriate branding (icon and color)
- Well-documented inputs and outputs

### README

Your README should include:

- Clear description of what the action does
- Quick start guide
- Usage examples
- Input/output documentation
- Troubleshooting section
- Support information

### Branding

Choose appropriate branding in action.yml:

```yaml
branding:
  icon: 'shield'      # Represents security/protection
  color: 'blue'       # Professional, trustworthy
```

Available icons: https://feathericons.com/
Available colors: white, yellow, blue, green, orange, red, purple, gray-dark

## Monitoring

### GitHub Insights

Monitor your action's usage:

1. Go to https://github.com/devsentinel/github-action/insights
2. View traffic, clones, and referrers
3. Track stars and forks

### Marketplace Analytics

View marketplace-specific analytics:

1. Go to https://github.com/marketplace/actions/devsentinel-code-analysis
2. Click "Insights" (if available)
3. Monitor installations and usage

## Troubleshooting

### Action Not Appearing in Marketplace

- Ensure repository is public
- Verify action.yml is in repository root
- Check that you published a release
- Confirm you checked "Publish to Marketplace" during release

### Users Can't Find Action

- Verify the action name and description are clear
- Add relevant keywords to action.yml
- Ensure the action is in the correct category
- Share the marketplace link directly

### Action Failing for Users

- Check GitHub Actions status page
- Review recent issues
- Test the action in a clean repository
- Verify CLI package is published to npm

## Support Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community support
- **Email**: support@devsentinel.com
- **Documentation**: https://docs.devsentinel.com

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Publishing Actions to Marketplace](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)
- [Action Metadata Syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
- [Composite Actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)

