/**
 * Claude Sonnet Client for Auto-Fix Agent
 * 
 * Implements the AI agent that autonomously writes code fixes using Claude Sonnet.
 * The agent has access to 4 tools: read_file, write_file, run_bash, search_codebase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { E2BSandbox, readFile, writeFile, executeCommand } from '@/lib/e2b/client';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY not set. Claude agent will fail.');
}

/**
 * Claude tool definitions
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the repository',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path from repository root (e.g., "src/api/auth.ts")',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the repository (creates or overwrites)',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path from repository root',
        },
        content: {
          type: 'string',
          description: 'Complete file content to write',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'run_bash',
    description: 'Execute a bash command in the repository sandbox (no internet access)',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute (e.g., "npm test", "ls -la")',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_codebase',
    description: 'Search for a pattern in the codebase using grep',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern to search for (supports regex)',
        },
        file_pattern: {
          type: 'string',
          description: 'Optional file pattern to limit search (e.g., "*.ts", "src/**/*.js")',
        },
      },
      required: ['pattern'],
    },
  },
];

/**
 * Finding context for the agent
 */
export interface FindingContext {
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  severity: string;
  category: string;
  bug_type: string | null;
  explanation: string;
  code_snippet: string | null;
  fix_original: string | null;
  fix_suggested: string | null;
  fix_explanation: string | null;
}

/**
 * Agent log entry
 */
export interface AgentLogEntry {
  tool_name: string;
  input: any;
  output: string;
  timestamp: string;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  success: boolean;
  message: string;
  tool_calls: number;
  agent_log: AgentLogEntry[];
}

/**
 * Build system prompt for Claude agent
 */
function buildSystemPrompt(finding: FindingContext, repoPath: string): string {
  return `You are an expert software engineer tasked with fixing a code issue.

FINDING DETAILS:
File: ${finding.file_path}
Lines: ${finding.line_start}-${finding.line_end}
Severity: ${finding.severity}
Category: ${finding.category}
${finding.bug_type ? `Bug Type: ${finding.bug_type}` : ''}

ISSUE EXPLANATION:
${finding.explanation}

${finding.code_snippet ? `CURRENT CODE:\n${finding.code_snippet}\n` : ''}

SUGGESTED FIX:
${finding.fix_explanation || 'No specific fix suggestion provided.'}

${finding.fix_original && finding.fix_suggested ? `
Original Code:
${finding.fix_original}

Fixed Code:
${finding.fix_suggested}
` : ''}

YOUR TASK:
1. Read the file to understand the context
2. Implement the suggested fix or a better solution
3. Ensure the fix doesn't break existing functionality
4. Write the corrected code to the file
5. Run any necessary commands to verify the fix

IMPORTANT RULES:
- All file paths are relative to: ${repoPath}
- Make minimal changes - only fix the specific issue
- Do not refactor unrelated code
- Test your changes if possible
- Work step-by-step and explain your reasoning

You have access to these tools:
- read_file: Read file contents
- write_file: Write to files
- run_bash: Execute bash commands (no internet access)
- search_codebase: Search for patterns using grep

When you're done, simply stop calling tools and provide a summary of what you fixed.`;
}

/**
 * Execute a tool call in the E2B sandbox
 */
async function executeTool(
  toolName: string,
  toolInput: any,
  sandbox: E2BSandbox,
  repoPath: string
): Promise<string> {
  try {
    switch (toolName) {
      case 'read_file': {
        const filePath = `${repoPath}/${toolInput.file_path}`;
        const content = await readFile(sandbox, filePath);
        return content;
      }

      case 'write_file': {
        const filePath = `${repoPath}/${toolInput.file_path}`;
        await writeFile(sandbox, filePath, toolInput.content);
        return `Successfully wrote ${toolInput.content.length} characters to ${toolInput.file_path}`;
      }

      case 'run_bash': {
        const result = await executeCommand(sandbox, `cd ${repoPath} && ${toolInput.command}`);
        return `Exit code: ${result.exitCode}\n\nStdout:\n${result.stdout}\n\nStderr:\n${result.stderr}`;
      }

      case 'search_codebase': {
        const grepCommand = toolInput.file_pattern
          ? `cd ${repoPath} && grep -rn "${toolInput.pattern}" --include="${toolInput.file_pattern}"`
          : `cd ${repoPath} && grep -rn "${toolInput.pattern}"`;
        
        const result = await executeCommand(sandbox, grepCommand);
        
        if (result.exitCode === 0) {
          return result.stdout || 'No matches found';
        } else if (result.exitCode === 1) {
          return 'No matches found';
        } else {
          return `Search failed: ${result.stderr}`;
        }
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Claude] Tool execution failed: ${toolName}`, error);
    return `Error: ${errorMessage}`;
  }
}

/**
 * Run Claude agent with tool loop
 * 
 * @param finding - Finding context with issue details
 * @param sandbox - E2B sandbox instance
 * @param repoPath - Repository path in sandbox
 * @param maxToolCalls - Maximum number of tool calls (default: 15)
 * @returns Agent execution result
 */
export async function runFixAgent(
  finding: FindingContext,
  sandbox: E2BSandbox,
  repoPath: string,
  maxToolCalls: number = 15
): Promise<AgentResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildSystemPrompt(finding, repoPath);
  const agentLog: AgentLogEntry[] = [];
  let toolCallCount = 0;

  // Initialize conversation with system prompt
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: 'Please fix the issue described above.',
    },
  ];

  try {
    // Tool execution loop
    while (toolCallCount < maxToolCalls) {
      console.log(`[Claude] Tool call ${toolCallCount + 1}/${maxToolCalls}`);

      // Call Claude API
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.0,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      // Check if Claude wants to use tools
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No more tool calls - agent is done
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        const finalMessage = textBlocks.map((block) => block.text).join('\n');

        console.log('[Claude] Agent completed:', finalMessage);

        return {
          success: true,
          message: finalMessage || 'Fix completed successfully',
          tool_calls: toolCallCount,
          agent_log: agentLog,
        };
      }

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCallCount++;

        if (toolCallCount > maxToolCalls) {
          console.warn('[Claude] Maximum tool calls reached');
          return {
            success: false,
            message: `Maximum tool calls (${maxToolCalls}) reached`,
            tool_calls: toolCallCount,
            agent_log: agentLog,
          };
        }

        console.log(`[Claude] Executing tool: ${toolUse.name}`, toolUse.input);

        // Execute tool in sandbox
        const output = await executeTool(
          toolUse.name,
          toolUse.input,
          sandbox,
          repoPath
        );

        // Log tool call
        agentLog.push({
          tool_name: toolUse.name,
          input: toolUse.input,
          output,
          timestamp: new Date().toISOString(),
        });

        // Add tool result for next Claude call
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: output,
        });

        console.log(`[Claude] Tool output (${output.length} chars):`, output.substring(0, 200));
      }

      // Add assistant message and tool results to conversation
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // Reached max tool calls
    return {
      success: false,
      message: `Maximum tool calls (${maxToolCalls}) reached`,
      tool_calls: toolCallCount,
      agent_log: agentLog,
    };
  } catch (error) {
    console.error('[Claude] Agent execution failed:', error);
    throw new Error(
      `Claude agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
