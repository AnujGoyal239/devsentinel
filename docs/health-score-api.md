# Health Score API Documentation

## Overview

The health score system provides a quantitative measure of code quality based on detected findings. This document describes the health score calculation, color coding utilities, and the API for real-time updates.

## Health Score Calculation

The health score is calculated using a penalty-based system:

- **Critical severity**: -20 points
- **High severity**: -10 points
- **Medium severity**: -5 points
- **Low severity**: -2 points
- **Info severity**: 0 points

**Formula**: `Health Score = 100 - (sum of penalties)`

The score is capped between 0 and 100.

### Example

If a project has:
- 1 critical finding (20 points)
- 2 high findings (20 points)
- 3 medium findings (15 points)

Total penalty: 55 points
Health Score: 100 - 55 = **45**

## Color Coding

Health scores are color-coded for quick visual assessment:

- **Green** (≥ 80): Good code quality
- **Yellow** (50-79): Moderate issues
- **Red** (< 50): Significant issues

### Utility Functions

```typescript
import { getHealthScoreColor, getHealthScoreColorClass } from '@/lib/utils';

// Get color string
const color = getHealthScoreColor(75); // Returns 'yellow'

// Get Tailwind CSS classes
const classes = getHealthScoreColorClass(75);
// Returns 'text-yellow-600 bg-yellow-50 border-yellow-200'
```

## API Endpoint

### Update Finding Status

**Endpoint**: `PATCH /api/findings/:id`

**Description**: Updates a finding's status and automatically recalculates the health score for the associated analysis run and project.

**Authentication**: Required (JWT token)

**Request Body**:
```json
{
  "status": "pass" | "fail"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "finding_id": "uuid",
  "status": "pass",
  "health_score": 85
}
```

**Error Responses**:

- **401 Unauthorized**: User not authenticated
  ```json
  {
    "error": "Unauthorized",
    "code": "UNAUTHORIZED"
  }
  ```

- **400 Bad Request**: Invalid status value
  ```json
  {
    "error": "Invalid status. Must be \"pass\" or \"fail\"",
    "code": "INVALID_STATUS"
  }
  ```

- **404 Not Found**: Finding does not exist
  ```json
  {
    "error": "Finding not found",
    "code": "NOT_FOUND"
  }
  ```

- **403 Forbidden**: Finding does not belong to user's project
  ```json
  {
    "error": "Forbidden - Finding does not belong to your project",
    "code": "FORBIDDEN"
  }
  ```

### Example Usage

```typescript
// Mark a finding as fixed
const response = await fetch(`/api/findings/${findingId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ status: 'pass' }),
});

const data = await response.json();

if (response.ok) {
  console.log(`Health score updated to: ${data.health_score}`);
  // Update UI with new health score
}
```

## Real-Time Updates

When a finding status is updated:

1. The finding record is updated in the database
2. The health score is recalculated based on all findings in the analysis run
3. The `analysis_runs.health_score` is updated
4. The `projects.health_score` is updated
5. The new health score is returned in the API response

This ensures that the health score is always up-to-date and reflects the current state of the codebase.

## Frontend Integration

### Display Health Score with Color

```tsx
import { getHealthScoreColor, getHealthScoreColorClass } from '@/lib/utils';

function HealthScoreBadge({ score }: { score: number }) {
  const colorClass = getHealthScoreColorClass(score);
  
  return (
    <div className={`px-4 py-2 rounded-lg border ${colorClass}`}>
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-sm ml-2">Health Score</span>
    </div>
  );
}
```

### Update Finding Status

```tsx
async function handleMarkAsFixed(findingId: string) {
  try {
    const response = await fetch(`/api/findings/${findingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pass' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const data = await response.json();
    
    // Update UI with new health score
    setHealthScore(data.health_score);
    
    // Show success message
    toast.success(`Finding marked as fixed. New health score: ${data.health_score}`);
  } catch (error) {
    toast.error(`Failed to update finding: ${error.message}`);
  }
}
```

## Testing

The health score system includes comprehensive tests:

- **Unit tests** for color coding utilities (`lib/__tests__/utils.test.ts`)
- **Integration tests** for the API endpoint (`app/api/findings/__tests__/route.test.ts`)

Run tests with:
```bash
npm test
```
