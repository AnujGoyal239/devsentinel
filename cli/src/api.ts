import axios, { AxiosInstance, AxiosError } from 'axios';
import type { CLIConfig, AnalysisRunResponse, ProjectResponse } from './types.js';

/**
 * API Client for DevSentinel
 */
export class DevSentinelAPI {
  private client: AxiosInstance;
  private config: CLIConfig;

  constructor(config: CLIConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Trigger analysis for a project
   */
  async triggerAnalysis(projectId: string): Promise<AnalysisRunResponse> {
    try {
      const response = await this.client.post<AnalysisRunResponse>(
        `/api/projects/${projectId}/analyse`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to trigger analysis');
    }
  }

  /**
   * Get analysis run status
   */
  async getAnalysisRun(runId: string): Promise<AnalysisRunResponse> {
    try {
      const response = await this.client.get<AnalysisRunResponse>(
        `/api/analysis-runs/${runId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get analysis run');
    }
  }

  /**
   * Get project details
   */
  async getProject(projectId: string): Promise<ProjectResponse> {
    try {
      const response = await this.client.get<ProjectResponse>(
        `/api/projects/${projectId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get project');
    }
  }

  /**
   * Stream analysis progress using SSE
   */
  async streamProgress(
    runId: string,
    onProgress: (event: any) => void,
    onComplete: (event: any) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const url = `${this.config.apiUrl}/api/stream/${runId}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'text/event-stream',
        },
        responseType: 'stream',
        timeout: 0, // No timeout for SSE
      });

      const stream = response.data;

      stream.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.status === 'complete' || data.status === 'failed') {
                onComplete(data);
              } else {
                onProgress(data);
              }
            } catch (parseError) {
              // Ignore parse errors for malformed SSE data
              if (this.config.verbose) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      });

      stream.on('error', (error: Error) => {
        onError(error);
      });

      stream.on('end', () => {
        // Stream ended
      });
    } catch (error) {
      this.handleError(error, 'Failed to stream progress');
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown, message: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage = axiosError.response.data?.error || 
                           axiosError.response.data?.message || 
                           axiosError.message;
        
        if (status === 401) {
          throw new Error('Authentication failed. Please check your API key.');
        } else if (status === 404) {
          throw new Error('Resource not found. Please check the project ID or run ID.');
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`${message}: ${errorMessage}`);
        }
      } else if (axiosError.request) {
        throw new Error(`${message}: No response from server. Please check your network connection.`);
      } else {
        throw new Error(`${message}: ${axiosError.message}`);
      }
    }
    
    throw new Error(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
