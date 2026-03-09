# Inngest Functions

This directory contains all Inngest background functions for the DevSentinel platform.

## Functions

### `analysis.ts` - Analysis Pipeline

**Event:** `analysis/run`

**Purpose:** Orchestrates the 4-pass AI analysis pipeline for code intelligence.

**Steps:**
1. `fetch-repo-tree` - Fetches repository file tree and key files from GitHub
2. `parse-prd` - Parses PRD document and fetches requirements (if provided)
3. `pass1-understand` - Analyzes codebase structure using Gemini Flash
4. `finalize-pass1` - Updates progress (Passes 2-4 to be implemented)

**Configuration:**
- Retries: 2
- Resumable: Yes (each step is independently resumable)

**Event Data:**
```typescript
{
  project_id: string;
  run_id: string;
  document_id?: string;
}
```

**Pass 1 Output (Codebase Context):**
```typescript
{
  tech_stack: {
    framework: string;
    language: string;
    dependencies: string[];
  };
  api_routes: Array<{
    method: string;
    path: string;
    file: string;
    line: number;
  }>;
  frontend_pages: Array<{
    path: string;
    file: string;
  }>;
  auth_middleware: {
    file: string;
    protected_patterns: string[];
  } | null;
  database_models: Array<{
    name: string;
    file: string;
  }>;
  import_issues: Array<{
    file: string;
    broken_import: string;
  }>;
}
```

## Usage

### Triggering an Analysis

```typescript
import { inngest } from '@/inngest/client';

await inngest.send({
  name: 'analysis/run',
  data: {
    project_id: 'uuid',
    run_id: 'uuid',
    document_id: 'uuid', // optional
  },
});
```

### Monitoring Progress

The analysis function updates the `analysis_runs` table with:
- `status`: 'queued' | 'running' | 'complete' | 'failed'
- `current_stage`: Descriptive message of current step
- `current_progress`: 0-100 percentage
- `codebase_context`: JSON output from Pass 1

These fields are polled by the SSE endpoint at `/api/stream/:runId` for real-time UI updates.

## Error Handling

- Each step has automatic retry logic (2 retries)
- If a step fails, the function updates the analysis run status to 'failed'
- The project status is updated to 'error'
- Error messages are stored in `analysis_runs.error_message`

## Logging

All steps log to console with the format:
```
[run_id] Message
```

This helps with debugging and monitoring in production.

## Next Steps

The following passes will be implemented in subsequent tasks:
- **Pass 2**: Bug Detection + PRD Compliance (batched file analysis)
- **Pass 3**: Security Audit (parallel with Pass 4)
- **Pass 4**: Production Readiness Audit (parallel with Pass 3)
- **Finalize**: Compute health score and update project status
