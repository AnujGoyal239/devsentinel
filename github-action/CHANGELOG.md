# Changelog

All notable changes to the DevSentinel GitHub Action will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Nothing yet

### Changed
- Nothing yet

### Deprecated
- Nothing yet

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Nothing yet

## [1.0.0] - 2024-01-15

### Added
- Initial release of DevSentinel GitHub Action
- Support for triggering DevSentinel analysis from GitHub workflows
- Health score threshold validation with configurable minimum score
- Three outputs: `health-score`, `status`, and `run-id`
- Support for Linux runners (ubuntu-latest, ubuntu-22.04, ubuntu-20.04)
- Support for macOS runners (macos-latest, macos-13, macos-12)
- Configurable timeout for analysis completion
- Custom API URL support for self-hosted instances
- Comprehensive documentation with usage examples
- Example workflows for common use cases:
  - Basic integration
  - Advanced with PR comments and notifications
  - Scheduled daily analysis
  - Monorepo support
  - Conditional execution
- Publishing guide for GitHub Marketplace
- Testing guide with comprehensive test scenarios
- MIT License

### Technical Details
- Uses composite action approach for maximum compatibility
- Installs DevSentinel CLI via npm
- Leverages Node.js 18+ for modern JavaScript features
- Implements proper exit codes (0=success, 1=error, 2=threshold not met)
- Extracts outputs from CLI using grep and GitHub Actions output format
- Handles errors gracefully with clear error messages

### Documentation
- README.md with quick start guide and usage examples
- PUBLISHING.md with step-by-step marketplace publication guide
- TESTING.md with comprehensive testing scenarios
- CHANGELOG.md for tracking changes
- LICENSE file (MIT)
- Example workflows for various use cases

[Unreleased]: https://github.com/devsentinel/github-action/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/devsentinel/github-action/releases/tag/v1.0.0
