# Testing the DevSentinel GitHub Action

This guide explains how to test the GitHub Action before publishing to the marketplace.

## Local Testing

### Method 1: Test in the Same Repository

Create a test workflow in `.github/workflows/test-action.yml`:

```yaml
name: Test DevSentinel Action

on:
  push:
    branches: [main, develop]
  pull_request:
  workflow_dispatch:

jobs:
  test-action:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Test DevSentinel Action (Local)
        uses: ./github-action  # Path to action directory
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 70
```

### Method 2: Test from a Separate Repository

1. Push your action to a GitHub repository
2. Create a test repository
3. Reference the action by repository path:

```yaml
- uses: devsentinel/github-action@main
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
```

## Test Scenarios

### Scenario 1: Successful Analysis (Score Above Threshold)

**Expected**: Action succeeds, outputs health score, status is "complete"

```yaml
- name: Test Success Case
  id: success
  uses: ./github-action
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.HIGH_QUALITY_PROJECT_ID }}
    threshold: 70

- name: Verify Success
  run: |
    echo "Health Score: ${{ steps.success.outputs.health-score }}"
    echo "Status: ${{ steps.success.outputs.status }}"
    echo "Run ID: ${{ steps.success.outputs.run-id }}"
    
    # Verify outputs exist
    if [ -z "${{ steps.success.outputs.health-score }}" ]; then
      echo "ERROR: health-score output is empty"
      exit 1
    fi
    
    if [ "${{ steps.success.outputs.status }}" != "complete" ]; then
      echo "ERROR: Expected status 'complete', got '${{ steps.success.outputs.status }}'"
      exit 1
    fi
```

### Scenario 2: Analysis Below Threshold

**Expected**: Action fails with exit code 2, outputs health score

```yaml
- name: Test Threshold Failure
  id: threshold
  uses: ./github-action
  continue-on-error: true
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.LOW_QUALITY_PROJECT_ID }}
    threshold: 95

- name: Verify Threshold Failure
  run: |
    echo "Health Score: ${{ steps.threshold.outputs.health-score }}"
    
    # Verify the step failed
    if [ "${{ steps.threshold.outcome }}" != "failure" ]; then
      echo "ERROR: Expected step to fail"
      exit 1
    fi
    
    # Verify health score is below threshold
    if [ "${{ steps.threshold.outputs.health-score }}" -ge 95 ]; then
      echo "ERROR: Health score should be below 95"
      exit 1
    fi
```

### Scenario 3: Invalid API Key

**Expected**: Action fails with authentication error

```yaml
- name: Test Invalid API Key
  id: invalid-key
  uses: ./github-action
  continue-on-error: true
  with:
    api-key: 'ds_invalid_key_12345'
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80

- name: Verify Auth Failure
  run: |
    if [ "${{ steps.invalid-key.outcome }}" != "failure" ]; then
      echo "ERROR: Expected authentication failure"
      exit 1
    fi
```

### Scenario 4: Invalid Project ID

**Expected**: Action fails with resource not found error

```yaml
- name: Test Invalid Project ID
  id: invalid-project
  uses: ./github-action
  continue-on-error: true
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: 'invalid-project-id-12345'
    threshold: 80

- name: Verify Not Found Error
  run: |
    if [ "${{ steps.invalid-project.outcome }}" != "failure" ]; then
      echo "ERROR: Expected resource not found error"
      exit 1
    fi
```

### Scenario 5: Custom Timeout

**Expected**: Action respects timeout setting

```yaml
- name: Test Custom Timeout
  uses: ./github-action
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
    timeout: 300  # 5 minutes
```

### Scenario 6: Custom API URL

**Expected**: Action uses custom API URL

```yaml
- name: Test Custom API URL
  uses: ./github-action
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
    api-url: 'https://staging.devsentinel.com'
```

## Comprehensive Test Workflow

Create `.github/workflows/comprehensive-test.yml`:

```yaml
name: Comprehensive Action Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  test-success:
    name: Test Success Case
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Action
        id: action
        uses: ./github-action
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 70
      
      - name: Verify Outputs
        run: |
          echo "✓ Health Score: ${{ steps.action.outputs.health-score }}"
          echo "✓ Status: ${{ steps.action.outputs.status }}"
          echo "✓ Run ID: ${{ steps.action.outputs.run-id }}"
          
          # Validate outputs
          [ -n "${{ steps.action.outputs.health-score }}" ] || exit 1
          [ "${{ steps.action.outputs.status }}" = "complete" ] || exit 1
          [ -n "${{ steps.action.outputs.run-id }}" ] || exit 1

  test-threshold:
    name: Test Threshold Enforcement
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Action with High Threshold
        id: action
        uses: ./github-action
        continue-on-error: true
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 100
      
      - name: Verify Failure
        run: |
          if [ "${{ steps.action.outcome }}" = "success" ]; then
            echo "ERROR: Action should have failed with threshold 100"
            exit 1
          fi
          echo "✓ Action correctly failed for threshold 100"

  test-outputs:
    name: Test Output Usage
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Action
        id: action
        uses: ./github-action
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 70
      
      - name: Use Outputs in Subsequent Steps
        run: |
          SCORE=${{ steps.action.outputs.health-score }}
          STATUS=${{ steps.action.outputs.status }}
          RUN_ID=${{ steps.action.outputs.run-id }}
          
          echo "Processing results..."
          echo "Score: $SCORE"
          echo "Status: $STATUS"
          echo "Run ID: $RUN_ID"
          
          # Example: Send to external service
          # curl -X POST https://example.com/webhook \
          #   -d "score=$SCORE&status=$STATUS&run_id=$RUN_ID"

  test-macos:
    name: Test on macOS
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Action on macOS
        uses: ./github-action
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 70

  test-multiple-node-versions:
    name: Test Node.js Compatibility
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 21]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Run Action
        uses: ./github-action
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 70
```

## Manual Testing Checklist

Before publishing, manually verify:

- [ ] Action installs CLI successfully
- [ ] Action runs analysis and waits for completion
- [ ] Action outputs health-score correctly
- [ ] Action outputs status correctly
- [ ] Action outputs run-id correctly
- [ ] Action succeeds when score >= threshold
- [ ] Action fails (exit 2) when score < threshold
- [ ] Action fails (exit 1) on API errors
- [ ] Action respects custom timeout
- [ ] Action respects custom API URL
- [ ] Action works on ubuntu-latest
- [ ] Action works on macos-latest
- [ ] Action handles authentication errors gracefully
- [ ] Action handles network errors gracefully
- [ ] Action displays progress during analysis
- [ ] Action output is readable and well-formatted

## Testing with Different Thresholds

Test various threshold values:

```yaml
strategy:
  matrix:
    threshold: [50, 70, 80, 90, 95]

steps:
  - uses: actions/checkout@v4
  
  - name: Test Threshold ${{ matrix.threshold }}
    uses: ./github-action
    continue-on-error: true
    with:
      api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
      project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
      threshold: ${{ matrix.threshold }}
```

## Performance Testing

Test with different timeout values:

```yaml
- name: Test Short Timeout
  uses: ./github-action
  continue-on-error: true
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.LARGE_PROJECT_ID }}
    threshold: 80
    timeout: 60  # Should timeout for large projects

- name: Test Long Timeout
  uses: ./github-action
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.LARGE_PROJECT_ID }}
    threshold: 80
    timeout: 1800  # 30 minutes
```

## Integration Testing

Test integration with other actions:

```yaml
- name: Checkout
  uses: actions/checkout@v4

- name: Run Tests
  run: npm test

- name: Run DevSentinel
  uses: ./github-action
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80

- name: Deploy (only if analysis passes)
  run: npm run deploy
```

## Debugging

Enable verbose output for debugging:

```yaml
- name: Run Action with Verbose Output
  uses: ./github-action
  with:
    api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
    project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
    threshold: 80
  env:
    ACTIONS_STEP_DEBUG: true
```

## Common Issues

### CLI Installation Fails

**Symptom**: `npm install -g @devsentinel/cli` fails

**Solution**:
- Verify the CLI package is published to npm
- Check npm registry status
- Test CLI installation manually

### Action Times Out

**Symptom**: Action exceeds timeout

**Solution**:
- Increase timeout value
- Check if analysis is stuck
- Verify API is responding

### Outputs Not Available

**Symptom**: Outputs are empty in subsequent steps

**Solution**:
- Verify output names match exactly
- Check if action completed successfully
- Review action logs for errors

## Pre-Release Checklist

Before creating a release:

- [ ] All test scenarios pass
- [ ] Action works on Linux and macOS
- [ ] Documentation is complete and accurate
- [ ] Examples are tested and working
- [ ] CLI package is published to npm
- [ ] API endpoints are stable
- [ ] Error messages are clear and helpful
- [ ] Outputs are documented and tested
- [ ] Security best practices are followed
- [ ] Performance is acceptable

## Post-Release Testing

After publishing to marketplace:

1. Install action in a test repository
2. Run through all test scenarios
3. Verify marketplace listing is correct
4. Test with different runner types
5. Monitor for user-reported issues

## Continuous Testing

Set up automated testing:

```yaml
name: Daily Action Test

on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM UTC daily
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./github-action
        with:
          api-key: ${{ secrets.DEVSENTINEL_API_KEY }}
          project-id: ${{ secrets.DEVSENTINEL_PROJECT_ID }}
          threshold: 80
```

This ensures the action continues to work as dependencies and infrastructure change.

