/**
 * E2B Sandbox Client
 * 
 * Provides isolated cloud sandboxes for the Auto-Fix agent.
 * Each fix job creates a fresh sandbox, runs the fix, and destroys it immediately.
 */

import { Sandbox } from '@e2b/code-interpreter';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
  console.warn('[E2B] E2B_API_KEY not set. Sandbox creation will fail.');
}

/**
 * E2B Sandbox Error Types
 */
export class E2BSandboxError extends Error {
  constructor(
    message: string,
    public operation: 'create' | 'destroy' | 'execute' | 'read' | 'write' | 'clone'
  ) {
    super(message);
    this.name = 'E2BSandboxError';
  }
}

/**
 * E2B Sandbox configuration
 */
export interface SandboxConfig {
  /**
   * Maximum sandbox lifetime in milliseconds (default: 30 minutes)
   */
  timeout?: number;
  
  /**
   * Metadata for tracking
   */
  metadata?: Record<string, string>;
}

/**
 * E2B Sandbox instance with connection details
 */
export interface E2BSandbox {
  /**
   * Unique sandbox ID
   */
  id: string;
  
  /**
   * Sandbox instance
   */
  sandbox: Sandbox;
  
  /**
   * Creation timestamp
   */
  createdAt: Date;
}

/**
 * Create a new E2B sandbox
 * 
 * @param config - Sandbox configuration
 * @returns Sandbox instance with ID and connection details
 * @throws E2BSandboxError if sandbox creation fails
 */
export async function createSandbox(config: SandboxConfig = {}): Promise<E2BSandbox> {
  if (!E2B_API_KEY) {
    throw new E2BSandboxError(
      'E2B_API_KEY environment variable is not set',
      'create'
    );
  }

  try {
    // Create sandbox with API key
    const sandbox = await Sandbox.create({
      apiKey: E2B_API_KEY,
      timeoutMs: config.timeout || 30 * 60 * 1000, // 30 minutes default
      metadata: config.metadata,
    });

    console.log(`[E2B] Created sandbox: ${sandbox.sandboxId}`);

    return {
      id: sandbox.sandboxId,
      sandbox,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('[E2B] Failed to create sandbox:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new E2BSandboxError(
      `Failed to create E2B sandbox: ${message}. This may be due to API quota limits or service unavailability.`,
      'create'
    );
  }
}

/**
 * Destroy an E2B sandbox
 * 
 * @param sandboxId - Sandbox ID or E2BSandbox instance
 * @returns True if cleanup was successful
 */
export async function destroySandbox(
  sandboxId: string | E2BSandbox
): Promise<boolean> {
  try {
    const id = typeof sandboxId === 'string' ? sandboxId : sandboxId.id;
    const sandbox = typeof sandboxId === 'string' ? null : sandboxId.sandbox;

    if (sandbox) {
      await sandbox.kill();
    }

    console.log(`[E2B] Destroyed sandbox: ${id}`);
    return true;
  } catch (error) {
    console.error('[E2B] Failed to destroy sandbox:', error);
    // Don't throw - cleanup failures should be logged but not block execution
    return false;
  }
}

/**
 * Execute a command in the sandbox
 * 
 * @param sandbox - E2B sandbox instance
 * @param command - Shell command to execute
 * @returns Command output (stdout, stderr, exit code)
 * @throws E2BSandboxError if command execution fails
 */
export async function executeCommand(
  sandbox: E2BSandbox,
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await sandbox.sandbox.process.start({
      cmd: command,
    });
    
    // Wait for process to complete
    await result.wait();
    
    return {
      stdout: result.output.stdout,
      stderr: result.output.stderr,
      exitCode: result.output.exitCode,
    };
  } catch (error) {
    console.error('[E2B] Command execution failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new E2BSandboxError(
      `Failed to execute command in sandbox: ${message}`,
      'execute'
    );
  }
}

/**
 * Write a file to the sandbox
 * 
 * @param sandbox - E2B sandbox instance
 * @param path - File path (relative to sandbox root)
 * @param content - File content
 * @throws E2BSandboxError if file write fails
 */
export async function writeFile(
  sandbox: E2BSandbox,
  path: string,
  content: string
): Promise<void> {
  try {
    await sandbox.sandbox.files.write(path, content);
    console.log(`[E2B] Wrote file: ${path}`);
  } catch (error) {
    console.error('[E2B] File write failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new E2BSandboxError(
      `Failed to write file ${path}: ${message}`,
      'write'
    );
  }
}

/**
 * Read a file from the sandbox
 * 
 * @param sandbox - E2B sandbox instance
 * @param path - File path (relative to sandbox root)
 * @returns File content
 * @throws E2BSandboxError if file read fails
 */
export async function readFile(
  sandbox: E2BSandbox,
  path: string
): Promise<string> {
  try {
    const content = await sandbox.sandbox.files.read(path);
    return content.toString();
  } catch (error) {
    console.error('[E2B] File read failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new E2BSandboxError(
      `Failed to read file ${path}: ${message}`,
      'read'
    );
  }
}

/**
 * Clone a GitHub repository into the sandbox
 * 
 * @param sandbox - E2B sandbox instance
 * @param repoUrl - GitHub repository URL
 * @param branch - Branch to clone (default: 'main')
 * @param token - GitHub access token (optional, for private repos)
 * @returns Clone directory path
 * @throws E2BSandboxError if clone fails
 */
export async function cloneRepository(
  sandbox: E2BSandbox,
  repoUrl: string,
  branch: string = 'main',
  token?: string
): Promise<string> {
  try {
    // Extract repo name from URL
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
    
    // Build git clone command with token if provided
    let cloneUrl = repoUrl;
    if (token && repoUrl.startsWith('https://github.com/')) {
      // Inject token into URL: https://TOKEN@github.com/owner/repo.git
      cloneUrl = repoUrl.replace('https://github.com/', `https://${token}@github.com/`);
    }

    // Clone repository
    const cloneCommand = `git clone --depth 1 --branch ${branch} ${cloneUrl} /home/user/${repoName}`;
    const result = await executeCommand(sandbox, cloneCommand);

    if (result.exitCode !== 0) {
      throw new Error(`Git clone failed: ${result.stderr}`);
    }

    console.log(`[E2B] Cloned repository: ${repoUrl} (branch: ${branch})`);
    return `/home/user/${repoName}`;
  } catch (error) {
    console.error('[E2B] Repository clone failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new E2BSandboxError(
      `Failed to clone repository ${repoUrl}: ${message}`,
      'clone'
    );
  }
}

/**
 * Install dependencies in the sandbox
 * 
 * @param sandbox - E2B sandbox instance
 * @param repoPath - Repository path in sandbox
 * @param packageManager - Package manager to use (npm, yarn, pnpm)
 * @throws E2BSandboxError if installation fails critically
 */
export async function installDependencies(
  sandbox: E2BSandbox,
  repoPath: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): Promise<void> {
  try {
    const installCommand = `cd ${repoPath} && ${packageManager} install`;
    const result = await executeCommand(sandbox, installCommand);

    if (result.exitCode !== 0) {
      console.warn(`[E2B] Dependency installation had warnings: ${result.stderr}`);
      // Don't throw - some warnings are acceptable
    }

    console.log(`[E2B] Installed dependencies using ${packageManager}`);
  } catch (error) {
    console.error('[E2B] Dependency installation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new E2BSandboxError(
      `Failed to install dependencies: ${message}`,
      'execute'
    );
  }
}
