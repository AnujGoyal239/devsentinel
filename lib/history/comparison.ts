/**
 * Historical Analysis Comparison
 * 
 * Compares analysis runs over time to track:
 * - Health score trends
 * - New findings introduced
 * - Findings resolved
 * - Persistent findings
 * - Finding count changes by category
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';

export interface AnalysisRunSummary {
  id: string;
  created_at: string;
  health_score: number;
  total_findings: number;
  findings_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings_by_category: {
    bug: number;
    security: number;
    performance: number;
    production: number;
    prd_compliance: number;
  };
}

export interface FindingComparison {
  id: string;
  bug_type: string;
  severity: string;
  file_path: string;
  line_start: number;
  explanation: string;
  status: 'new' | 'resolved' | 'persistent';
}

export interface HistoricalComparison {
  current_run: AnalysisRunSummary;
  previous_run: AnalysisRunSummary | null;
  health_score_change: number;
  new_findings: FindingComparison[];
  resolved_findings: FindingComparison[];
  persistent_findings: FindingComparison[];
  findings_change_by_category: {
    bug: number;
    security: number;
    performance: number;
    production: number;
    prd_compliance: number;
  };
}

export interface HealthScoreTrend {
  run_id: string;
  created_at: string;
  health_score: number;
  total_findings: number;
}

/**
 * Get analysis run summary
 */
async function getAnalysisRunSummary(runId: string): Promise<AnalysisRunSummary | null> {
  try {
    // Get run details
    const { data: run, error: runError } = await supabaseAdmin
      .from('analysis_runs')
      .select('id, created_at, health_score')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      logger.error('Failed to fetch analysis run', { runId, error: runError?.message });
      return null;
    }

    // Get findings for this run
    const { data: findings, error: findingsError } = await supabaseAdmin
      .from('findings')
      .select('severity, category')
      .eq('run_id', runId);

    if (findingsError) {
      logger.error('Failed to fetch findings', { runId, error: findingsError.message });
      return null;
    }

    // Calculate statistics
    const findingsBySeverity = {
      critical: findings?.filter(f => f.severity === 'critical').length || 0,
      high: findings?.filter(f => f.severity === 'high').length || 0,
      medium: findings?.filter(f => f.severity === 'medium').length || 0,
      low: findings?.filter(f => f.severity === 'low').length || 0,
      info: findings?.filter(f => f.severity === 'info').length || 0,
    };

    const findingsByCategory = {
      bug: findings?.filter(f => f.category === 'bug').length || 0,
      security: findings?.filter(f => f.category === 'security').length || 0,
      performance: findings?.filter(f => f.category === 'performance').length || 0,
      production: findings?.filter(f => f.category === 'production').length || 0,
      prd_compliance: findings?.filter(f => f.category === 'prd_compliance').length || 0,
    };

    return {
      id: run.id,
      created_at: run.created_at,
      health_score: run.health_score || 0,
      total_findings: findings?.length || 0,
      findings_by_severity: findingsBySeverity,
      findings_by_category: findingsByCategory,
    };
  } catch (error) {
    logger.error('Error getting analysis run summary', {
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Compare two analysis runs
 */
export async function compareAnalysisRuns(
  currentRunId: string,
  previousRunId?: string
): Promise<HistoricalComparison | null> {
  try {
    // Get current run summary
    const currentRun = await getAnalysisRunSummary(currentRunId);
    if (!currentRun) {
      return null;
    }

    // Get previous run (either specified or most recent before current)
    let previousRun: AnalysisRunSummary | null = null;
    
    if (previousRunId) {
      previousRun = await getAnalysisRunSummary(previousRunId);
    } else {
      // Find most recent run before current
      const { data: runs } = await supabaseAdmin
        .from('analysis_runs')
        .select('id')
        .eq('project_id', (await supabaseAdmin
          .from('analysis_runs')
          .select('project_id')
          .eq('id', currentRunId)
          .single()).data?.project_id || '')
        .lt('created_at', currentRun.created_at)
        .order('created_at', { ascending: false })
        .limit(1);

      if (runs && runs.length > 0) {
        previousRun = await getAnalysisRunSummary(runs[0].id);
      }
    }

    // Calculate health score change
    const healthScoreChange = previousRun
      ? currentRun.health_score - previousRun.health_score
      : 0;

    // Get findings for comparison
    const { data: currentFindings } = await supabaseAdmin
      .from('findings')
      .select('id, bug_type, severity, file_path, line_start, explanation')
      .eq('run_id', currentRunId);

    const { data: previousFindings } = previousRun
      ? await supabaseAdmin
          .from('findings')
          .select('id, bug_type, severity, file_path, line_start, explanation')
          .eq('run_id', previousRun.id)
      : { data: [] };

    // Compare findings
    const newFindings: FindingComparison[] = [];
    const resolvedFindings: FindingComparison[] = [];
    const persistentFindings: FindingComparison[] = [];

    // Create fingerprints for findings (file + line + bug_type)
    const createFingerprint = (f: any) =>
      `${f.file_path}:${f.line_start}:${f.bug_type}`;

    const previousFingerprintMap = new Map(
      (previousFindings || []).map(f => [createFingerprint(f), f])
    );

    const currentFingerprintMap = new Map(
      (currentFindings || []).map(f => [createFingerprint(f), f])
    );

    // Find new and persistent findings
    for (const finding of currentFindings || []) {
      const fingerprint = createFingerprint(finding);
      
      if (previousFingerprintMap.has(fingerprint)) {
        persistentFindings.push({
          ...finding,
          status: 'persistent',
        });
      } else {
        newFindings.push({
          ...finding,
          status: 'new',
        });
      }
    }

    // Find resolved findings
    for (const finding of previousFindings || []) {
      const fingerprint = createFingerprint(finding);
      
      if (!currentFingerprintMap.has(fingerprint)) {
        resolvedFindings.push({
          ...finding,
          status: 'resolved',
        });
      }
    }

    // Calculate category changes
    const findingsChangeByCategory = {
      bug: currentRun.findings_by_category.bug - (previousRun?.findings_by_category.bug || 0),
      security: currentRun.findings_by_category.security - (previousRun?.findings_by_category.security || 0),
      performance: currentRun.findings_by_category.performance - (previousRun?.findings_by_category.performance || 0),
      production: currentRun.findings_by_category.production - (previousRun?.findings_by_category.production || 0),
      prd_compliance: currentRun.findings_by_category.prd_compliance - (previousRun?.findings_by_category.prd_compliance || 0),
    };

    logger.info('Analysis comparison complete', {
      currentRunId,
      previousRunId: previousRun?.id,
      healthScoreChange,
      newFindingsCount: newFindings.length,
      resolvedFindingsCount: resolvedFindings.length,
      persistentFindingsCount: persistentFindings.length,
    });

    return {
      current_run: currentRun,
      previous_run: previousRun,
      health_score_change: healthScoreChange,
      new_findings: newFindings,
      resolved_findings: resolvedFindings,
      persistent_findings: persistentFindings,
      findings_change_by_category: findingsChangeByCategory,
    };
  } catch (error) {
    logger.error('Error comparing analysis runs', {
      currentRunId,
      previousRunId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get health score trend over time
 */
export async function getHealthScoreTrend(
  projectId: string,
  limit: number = 10
): Promise<HealthScoreTrend[]> {
  try {
    const { data: runs, error } = await supabaseAdmin
      .from('analysis_runs')
      .select('id, created_at, health_score')
      .eq('project_id', projectId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch health score trend', {
        projectId,
        error: error.message,
      });
      return [];
    }

    // Get finding counts for each run
    const trend: HealthScoreTrend[] = [];
    
    for (const run of runs || []) {
      const { data: findings } = await supabaseAdmin
        .from('findings')
        .select('id')
        .eq('run_id', run.id);

      trend.push({
        run_id: run.id,
        created_at: run.created_at,
        health_score: run.health_score || 0,
        total_findings: findings?.length || 0,
      });
    }

    // Reverse to get chronological order
    return trend.reverse();
  } catch (error) {
    logger.error('Error getting health score trend', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Get all historical runs for a project
 */
export async function getProjectHistory(projectId: string): Promise<AnalysisRunSummary[]> {
  try {
    const { data: runs, error } = await supabaseAdmin
      .from('analysis_runs')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch project history', {
        projectId,
        error: error.message,
      });
      return [];
    }

    const summaries: AnalysisRunSummary[] = [];
    
    for (const run of runs || []) {
      const summary = await getAnalysisRunSummary(run.id);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  } catch (error) {
    logger.error('Error getting project history', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}
