/**
 * Groq Fix Agent
 * 
 * Implements the AI agent that autonomously writes code fixes using Groq's LLM.
 * The agent has access to 4 tools: read_file, write_file, run_bash, search_codebase.
 */

import Groq from 'groq-sdk';
import { E2BSandbox, readFile, writeFile, executeCommand } from '@/lib/e2b/client';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn('GROQ_API_KEY not set. Fix agent will fail.');
}

const groq = new Groq({ apiKey: GROQ_API_KEY || '' });

/**
 * Tool definitions for the agent
 */
interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

const TOOLS: Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the repository',
    parameters: {
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
    parameters: {
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
    parameters: {
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
    parameters: {
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
 * Build system prompt for the agent
 */
function buildSystemPrompt(finding: FindingContext, repoPath: string): string {
  const toolsDescription = TOOLS.map(tool => 
    `- ${tool.name}: ${tool.description}`
  ).join('\n');

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
${toolsDescription}

To use a tool, respond with JSON in this format:
{
  "tool": "tool_name",
  "parameters": { "param1": "value1" }
}

When you're done fixing the issue, respond with:
{
  "done": true,
  "summary": "Description of what you fixed"
}`;
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
    console.error(`[Groq Agent] Tool execution failed: ${toolName}`, error);
    return `Error: ${errorMessage}`;
  }
}

/**
 * Parse tool call from AI response
 */
function parseToolCall(response: string): { tool?: string; parameters?: any; done?: boolean; summary?: string } | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = response.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    // Try to find JSON object in the response
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Run Groq agent with tool loop
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
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }

  const systemPrompt = buildSystemPrompt(finding, repoPath);
  const agentLog: AgentLogEntry[] = [];
  let toolCallCount = 0;

  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: 'Please fix the issue described above. Start by reading the file to understand the context.',
    },
  ];

  try {
    // Tool execution loop
    while (toolCallCount < maxToolCalls) {
      console.log(`[Groq Agent] Iteration ${toolCallCount + 1}/${maxToolCalls}`);

      // Call Groq API
      const completion = await groq.chat.completions.create({
        messages: messages as any,
        model: 'llama-3.1-70b-versatile',
        temperature: 0.0,
        max_tokens: 4096,
      });

      const response = completion.choices[0]?.message?.content || '';
      console.log(`[Groq Agent] Response:`, response.substring(0, 200));

      // Parse tool call or completion
      const parsed = parseToolCall(response);

      if (parsed?.done) {
        // Agent is done
        console.log('[Groq Agent] Agent completed:', parsed.summary);
        return {
          success: true,
          message: parsed.summary || 'Fix completed successfully',
          tool_calls: toolCallCount,
          agent_log: agentLog,
        };
      }

      if (parsed?.tool) {
        // Execute tool
        toolCallCount++;

        if (toolCallCount > maxToolCalls) {
          console.warn('[Groq Agent] Maximum tool calls reached');
          return {
            success: false,
            message: `Maximum tool calls (${maxToolCalls}) reached`,
            tool_calls: toolCallCount,
            agent_log: agentLog,
          };
        }

        console.log(`[Groq Agent] Executing tool: ${parsed.tool}`, parsed.parameters);

        const output = await executeTool(
          parsed.tool,
          parsed.parameters || {},
          sandbox,
          repoPath
        );

        // Log tool call
        agentLog.push({
          tool_name: parsed.tool,
          input: parsed.parameters,
          output,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Groq Agent] Tool output (${output.length} chars):`, output.substring(0, 200));

        // Add assistant response and tool result to conversation
        messages.push({
          role: 'assistant',
          content: response,
        });

        messages.push({
          role: 'user',
          content: `Tool result:\n${output}\n\nContinue with the next step or mark as done if the fix is complete.`,
        });
      } else {
        // No valid tool call or done signal - agent might be confused
        console.warn('[Groq Agent] No valid tool call or done signal in response');
        
        // Try one more time with clarification
        messages.push({
          role: 'assistant',
          content: response,
        });

        messages.push({
          role: 'user',
          content: 'Please respond with a valid JSON tool call or mark as done. Use the format: {"tool": "tool_name", "parameters": {...}} or {"done": true, "summary": "..."}',
        });

        toolCallCount++;
      }
    }

    // Reached max iterations
    return {
      success: false,
      message: `Maximum tool calls (${maxToolCalls}) reached`,
      tool_calls: toolCallCount,
      agent_log: agentLog,
    };
  } catch (error) {
    console.error('[Groq Agent] Agent execution failed:', error);
    throw new Error(
      `Groq agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
