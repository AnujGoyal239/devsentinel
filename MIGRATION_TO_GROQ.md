# Migration to Groq AI

## Overview

The DevSentinel platform has been migrated from using Gemini (Google) and Claude (Anthropic) to using Groq's LLM API exclusively. This simplifies the infrastructure and reduces the number of API keys required.

## Changes Made

### 1. New Groq Client (`lib/ai/groq-client.ts`)
- Created unified Groq client for all AI operations
- Supports requirement extraction from PRDs
- Supports general completion generation for analysis pipeline
- Uses `llama-3.1-70b-versatile` model
- Temperature set to 0.0 for deterministic output (Requirement 33.5)

### 2. New Groq Fix Agent (`lib/ai/groq-fix-agent.ts`)
- Replaces Claude Sonnet for auto-fix agent
- Implements tool-calling pattern with JSON responses
- Supports 4 tools: read_file, write_file, run_bash, search_codebase
- Maximum 15 tool calls per fix job
- Uses structured JSON format for tool invocations

### 3. Analysis Pipeline Updates (`inngest/functions/analysis.ts`)
- **Pass 1 (Codebase Understanding)**: Now uses Groq instead of Gemini
- **Pass 2 (Bug Detection)**: Now uses Groq instead of Gemini
- **Pass 3 (Security Audit)**: Now uses Groq instead of Gemini
- **Pass 4 (Production Readiness)**: Now uses Groq instead of Gemini
- All passes maintain temperature 0.0 for consistency

### 4. Fix Pipeline Updates (`inngest/functions/fix.ts`)
- Imports from `@/lib/ai/groq-fix-agent` instead of `@/lib/claude/client`
- Both initial fix attempt and retry use Groq agent

### 5. Document Upload Updates (`app/api/projects/[id]/documents/route.ts`)
- Imports from `@/lib/ai/groq-client` instead of `@/lib/ai/gemini`

### 6. Environment Variable Updates
- **Removed**: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- **Required**: `GROQ_API_KEY` (already present in .env)
- Updated `lib/config/env.ts` to only require GROQ_API_KEY
- Updated `.env.example` to reflect new requirements

### 7. Monitoring Updates
- Updated Sentry sanitization to remove old API keys
- Updated external API wrappers documentation

## Benefits

1. **Simplified Infrastructure**: Only one AI provider instead of three
2. **Reduced API Key Management**: Only GROQ_API_KEY required
3. **Cost Efficiency**: Groq offers competitive pricing
4. **Consistent Behavior**: Single model across all operations
5. **Faster Inference**: Groq is known for fast inference speeds

## Model Used

- **Model**: `llama-3.1-70b-versatile`
- **Provider**: Groq
- **Temperature**: 0.0 (deterministic output for consistency)
- **Use Cases**: 
  - Requirement extraction from PRDs
  - Codebase understanding (Pass 1)
  - Bug detection (Pass 2)
  - Security audit (Pass 3)
  - Production readiness audit (Pass 4)
  - Auto-fix agent (code generation and fixes)

## Testing Recommendations

1. Test requirement extraction with sample PRD documents
2. Test analysis pipeline with a sample repository
3. Test auto-fix agent with a known bug
4. Verify all 4 analysis passes complete successfully
5. Check that findings are generated correctly
6. Verify PR creation works with the new agent

## Rollback Plan

If issues arise with Groq:
1. The old Gemini and Claude clients are still in the codebase
2. Revert changes to `inngest/functions/analysis.ts`
3. Revert changes to `inngest/functions/fix.ts`
4. Revert changes to `lib/config/env.ts`
5. Add back GEMINI_API_KEY and ANTHROPIC_API_KEY to .env

## Performance Considerations

- Groq is optimized for fast inference
- May need to adjust rate limiting if hitting Groq's limits
- Monitor token usage and costs
- Consider implementing retry logic for rate limit errors

## Next Steps

1. Test the platform end-to-end with Groq
2. Monitor error rates and performance
3. Adjust prompts if needed for better results
4. Consider fine-tuning if specific use cases require it
