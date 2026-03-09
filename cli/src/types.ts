/**
 * CLI Configuration
 */
export interface CLIConfig {
  apiKey: string;
  apiUrl: string;
  verbose: boolean;
}

/**
 * Analysis Run Response
 */
export interface AnalysisRunResponse {
  data: {
    id: string;
    project_id: string;
    status: 'queued' | 'running' | 'complete' | 'failed';
    health_score: number | null;
    current_stage: string | null;
    current_progress: number;
    error_message: string | null;
    created_at: string;
  };
}

/**
 * Project Response
 */
export interface ProjectResponse {
  data: {
    id: string;
    name: string;
    repo_url: string;
    status: string;
    health_score: number | null;
  };
}

/**
 * SSE Progress Event
 */
export interface ProgressEvent {
  status: 'queued' | 'running' | 'complete' | 'failed';
  current_stage?: string;
  current_progress?: number;
  health_score?: number;
  error_message?: string;
}

/**
 * CLI Exit Codes
 */
export enum ExitCode {
  SUCCESS = 0,
  ERROR = 1,
  THRESHOLD_NOT_MET = 2,
}
