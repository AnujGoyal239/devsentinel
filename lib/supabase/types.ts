/**
 * Database Type Definitions
 * 
 * TypeScript types for all Supabase database tables.
 * These types match the schema defined in database/schema.md
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>;
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, 'id' | 'created_at'>;
        Update: Partial<Omit<Document, 'id' | 'created_at'>>;
      };
      requirements: {
        Row: Requirement;
        Insert: Omit<Requirement, 'id' | 'created_at'>;
        Update: Partial<Omit<Requirement, 'id' | 'created_at'>>;
      };
      analysis_runs: {
        Row: AnalysisRun;
        Insert: Omit<AnalysisRun, 'id' | 'created_at'>;
        Update: Partial<Omit<AnalysisRun, 'id' | 'created_at'>>;
      };
      findings: {
        Row: Finding;
        Insert: Omit<Finding, 'id' | 'created_at'>;
        Update: Partial<Omit<Finding, 'id' | 'created_at'>>;
      };
      fix_jobs: {
        Row: FixJob;
        Insert: Omit<FixJob, 'id' | 'created_at'>;
        Update: Partial<Omit<FixJob, 'id' | 'created_at'>>;
      };
    };
  };
}

// ─────────────────────────────────────────
// Table Types
// ─────────────────────────────────────────

export interface User {
  id: string;
  github_id: string;
  username: string;
  avatar_url: string | null;
  email: string | null;
  github_token: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  tech_stack: TechStack | null;
  status: ProjectStatus;
  health_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  file_type: DocumentFileType;
  storage_path: string;
  parsed_content: string | null;
  created_at: string;
}

export interface Requirement {
  id: string;
  document_id: string | null;
  project_id: string;
  category: RequirementCategory | null;
  feature_name: string;
  description: string | null;
  endpoint: string | null;
  expected_behavior: string | null;
  priority: RequirementPriority;
  created_at: string;
}

export interface AnalysisRun {
  id: string;
  project_id: string;
  status: AnalysisRunStatus;
  health_score: number | null;
  total_tests: number;
  passed: number;
  failed: number;
  codebase_context: CodebaseContext | null;
  current_stage: string | null;
  current_progress: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Finding {
  id: string;
  run_id: string;
  requirement_id: string | null;
  pass_number: 1 | 2 | 3 | 4;
  category: FindingCategory;
  severity: FindingSeverity;
  bug_type: string | null;
  status: FindingStatus;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  explanation: string | null;
  fix_confidence: number | null;
  fix_original: string | null;
  fix_suggested: string | null;
  fix_explanation: string | null;
  created_at: string;
}

export interface FixJob {
  id: string;
  finding_id: string;
  status: FixJobStatus;
  sandbox_id: string | null;
  pr_url: string | null;
  pr_number: number | null;
  branch_name: string | null;
  agent_log: AgentLogEntry[];
  lint_result: LintResult | null;
  test_result: TestResult | null;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ─────────────────────────────────────────
// Enum Types
// ─────────────────────────────────────────

export type ProjectStatus = 'idle' | 'analysing' | 'complete' | 'fixing' | 'error';

export type DocumentFileType = 'pdf' | 'docx' | 'md';

export type RequirementCategory = 'feature' | 'endpoint' | 'acceptance_criteria' | 'edge_case';

export type RequirementPriority = 'high' | 'medium' | 'low';

export type AnalysisRunStatus = 'queued' | 'running' | 'complete' | 'failed';

export type FindingCategory = 'bug' | 'security' | 'production' | 'prd_compliance';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingStatus = 'pass' | 'fail';

export type FixJobStatus =
  | 'queued'
  | 'sandboxing'
  | 'coding'
  | 'linting'
  | 'testing'
  | 'opening_pr'
  | 'complete'
  | 'failed';

// ─────────────────────────────────────────
// Complex Types
// ─────────────────────────────────────────

export interface TechStack {
  framework: string;
  language: string;
  dependencies: string[];
}

export interface CodebaseContext {
  tech_stack: TechStack;
  api_routes: APIRoute[];
  frontend_pages: FrontendPage[];
  auth_middleware: AuthMiddleware | null;
  database_models: DatabaseModel[];
  import_issues: ImportIssue[];
}

export interface APIRoute {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface FrontendPage {
  path: string;
  file: string;
}

export interface AuthMiddleware {
  file: string;
  protected_patterns: string[];
}

export interface DatabaseModel {
  name: string;
  file: string;
}

export interface ImportIssue {
  file: string;
  broken_import: string;
}

export interface AgentLogEntry {
  stage: string;
  message: string;
  timestamp: string;
}

export interface LintResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  fixed_automatically: string[];
}

export interface TestResult {
  passed: boolean;
  output: string;
  failed_tests: string[];
}
