# Task 16: Auto-Fix Agent - Claude Tool Execution ✅

## Overview

Implemented the Claude Sonnet AI agent with a complete tool execution loop for autonomous code fixing. The agent can read files, write fixes, execute commands, and search the codebase within an isolated E2B sandbox.

## Implementation Summary

### 1. Claude Client (`lib/claude/client.ts`)

**Core Features:**
- Claude Sonnet 3.5 integration with Anthropic SDK
- Tool execution loop with max 15 tool calls
- System prompt generation with finding context
- Agent log tracking for all tool calls
- Temperature 0.0 for deterministic output
- 4096 max tokens for responses

**Tool Definitions:**

1. **read_file**
   - Reads file contents from sandbox
   - Input: `file_path` (string)
   - Returns: File content

2. **write_file**
   - Writes content to files in sandbox
   - Input: `file_path` (string), `content` (string)
   - Creates parent directories if needed
   - Returns: Success confirmation

3. **run_bash**
   - Executes bash commands in sandbox
   - Input: `command` (string)
   - 30-second timeout per command
   - Returns: stdout, stderr, exit code

4. **search_codebase**
   - Searches for patterns using grep
   - Input: `pattern` (string), `file_pattern` (optional string)
   - Returns: Matching file paths and line numbers

**System Prompt Template:**
- Finding details (file, lines, severity, category)
- Issue explanation
- Current code snippet
- Suggested fix with original/fixed code
- Fix explanation
- Task instructions and rules
- Repository path context

**Agent Loop:**
1. Initialize conversation with system prompt
2. Call Claude API with tools
3. Execute tool calls in E2B sandbox
4. Return results to Claude
5. Continue until Claude finishes or max 15 tool calls reached
6. Log each tool call with timestamp

### 2. Fix Pipeline Integration (`inngest/functions/fix.ts`)

**Step 4 - Run Fix Agent:**
- Import Claude agent dynamically
- Build finding context from database
- Execute agent with tool loop
- Log each tool call to `fix_jobs.agent_log`
- Update status to "coding"
- Handle agent failures gracefully
- Mark job as complete after success

**Agent Log Format:**
```typescript
{
  tool_name: string;
  input: any;
  output: string;
  timestamp: string;
}
```

**Status Flow:**
- `queued` → `sandboxing` → `coding` → `complete`/`failed`

### 3. Environment Configuration

**Added to `.env.example`:**
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Already present in the file - no changes needed.

### 4. Testing (`lib/claude/__tests__/client.test.ts`)

**Test Coverage:**
- Tool definition validation (4 tools)
- Finding context acceptance
- API key validation
- Maximum tool call limit enforcement
- System prompt content verification
- Agent execution flow

**All 8 tests passing ✅**

## Key Design Decisions

### 1. Tool Execution in Sandbox
All tool calls execute within the E2B sandbox for security:
- No network access after git clone
- No access to host filesystem
- Isolated from production systems

### 2. Maximum Tool Call Limit
Hard limit of 15 tool calls prevents infinite loops:
- Agent stops after 15 calls
- Returns failure status with message
- Logs all attempted tool calls

### 3. Deterministic Output
Temperature 0.0 ensures consistent fixes:
- Same issue → same fix approach
- Reduces randomness in code changes
- More predictable behavior

### 4. Comprehensive Logging
Every tool call logged to database:
- Tool name and input parameters
- Output (truncated to 200 chars in log entry)
- Timestamp for debugging
- Full output stored in agent_log JSONB

### 5. Error Handling
Graceful failure handling:
- Tool execution errors returned to Claude
- Agent can retry or adjust approach
- Pipeline marks job as failed on agent error
- Sandbox cleanup always happens

## Integration Points

### Database Schema
Uses existing `fix_jobs` table:
- `status`: Updated to "coding" during agent execution
- `agent_log`: JSONB array of tool call entries
- `error_message`: Populated on agent failure
- `completed_at`: Set after success/failure

### E2B Sandbox
Leverages existing sandbox utilities:
- `readFile()`: Read file contents
- `writeFile()`: Write file contents
- `executeCommand()`: Run bash commands
- Repository already cloned and dependencies installed

### Finding Context
Pulls from `findings` table:
- `file_path`: Target file for fix
- `line_start`, `line_end`: Issue location
- `severity`, `category`, `bug_type`: Issue classification
- `explanation`: What's wrong
- `code_snippet`: Current broken code
- `fix_original`, `fix_suggested`, `fix_explanation`: Suggested fix

## Example Agent Flow

```
1. Agent receives finding: "SQL injection in src/api/auth.ts"
2. Tool call: read_file("src/api/auth.ts")
   → Returns full file content
3. Tool call: search_codebase("SELECT.*WHERE")
   → Finds all SQL queries in codebase
4. Tool call: write_file("src/api/auth.ts", fixed_content)
   → Writes parameterized query
5. Tool call: run_bash("npm run lint src/api/auth.ts")
   → Verifies syntax is correct
6. Agent completes: "Fixed SQL injection by using parameterized queries"
```

## Requirements Validated

✅ **Requirement 15.1**: Claude Sonnet invoked with finding context  
✅ **Requirement 15.2**: Four tools provided (read_file, write_file, run_bash, search_codebase)  
✅ **Requirement 15.3**: read_file returns file content from sandbox  
✅ **Requirement 15.4**: write_file writes content to sandbox  
✅ **Requirement 15.5**: run_bash executes commands and returns stdout/stderr/exit code  
✅ **Requirement 15.6**: search_codebase executes grep and returns matches  
✅ **Requirement 15.7**: Maximum 15 tool calls enforced  
✅ **Requirement 15.8**: Agent loop terminates at tool limit  
✅ **Requirement 15.9**: Status updated to "coding"  
✅ **Requirement 15.10**: Each tool call logged with stage, message, timestamp  

## Files Created/Modified

### Created:
- `devsentinel/lib/claude/client.ts` - Claude agent implementation
- `devsentinel/lib/claude/__tests__/client.test.ts` - Agent tests

### Modified:
- `devsentinel/inngest/functions/fix.ts` - Integrated agent into fix pipeline
- `devsentinel/package.json` - Added @anthropic-ai/sdk dependency

### Configuration:
- `.env.example` - Already had ANTHROPIC_API_KEY

## Next Steps

Task 16 is complete. The next tasks in the fix pipeline are:

- **Task 17.1-17.3**: Linter integration and test runner
- **Task 17.5-17.7**: GitHub PR creation and sandbox cleanup
- **Task 18**: Fix progress streaming and UI

The agent is now ready to autonomously fix code issues. When a user clicks "Auto-Fix" on a finding, the system will:
1. Create E2B sandbox
2. Clone repository
3. Run Claude agent with tools
4. Apply fixes to code
5. (Next: lint, test, create PR)

## Testing

Run tests:
```bash
npm test -- lib/claude/__tests__/client.test.ts --run
```

All 8 tests passing ✅

## Notes

- Agent uses Claude Sonnet 3.5 (claude-3-5-sonnet-20241022)
- Tool execution happens in isolated E2B sandbox
- Maximum 15 tool calls prevents infinite loops
- All tool calls logged to database for debugging
- Temperature 0.0 for deterministic fixes
- 4096 max tokens for responses
- System prompt includes full finding context
- Agent can read, write, execute, and search
- Graceful error handling throughout
