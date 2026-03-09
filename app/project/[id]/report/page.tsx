/**
 * Report Page: /project/[id]/report
 * 
 * Displays analysis results with health score, findings by category,
 * and detailed finding cards with code snippets and diffs.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { HealthScoreRing } from '@/components/ui/health-score-ring';
import { LoadingSpinner, SkeletonCard } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { FindingCard } from '@/components/report/FindingCard';
import { exportReportToPDF } from '@/lib/report/pdf-export';

interface Finding {
  id: string;
  run_id: string;
  requirement_id: string | null;
  pass_number: number;
  category: 'bug' | 'security' | 'production' | 'prd_compliance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  bug_type: string | null;
  status: 'pass' | 'fail';
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

interface AnalysisRun {
  id: string;
  project_id: string;
  status: string;
  health_score: number | null;
  total_tests: number;
  passed: number;
  failed: number;
  created_at: string;
  completed_at: string | null;
}

interface Project {
  id: string;
  name: string;
  repo_url: string;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filteredFindings, setFilteredFindings] = useState<Finding[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [projectId]);

  useEffect(() => {
    filterFindings();
  }, [selectedCategory, findings]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch project details
      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (!projectRes.ok) {
        throw new Error('Failed to fetch project');
      }
      const projectData = await projectRes.json();
      setProject(projectData.data);

      // Fetch latest analysis run
      const runRes = await fetch(`/api/projects/${projectId}/analyse`);
      if (!runRes.ok) {
        throw new Error('Failed to fetch analysis run');
      }
      const runData = await runRes.json();
      
      // Get the most recent completed run
      const runs = Array.isArray(runData.data) ? runData.data : [runData.data];
      const completedRun = runs.find((r: AnalysisRun) => r.status === 'complete');
      
      if (!completedRun) {
        setError('No completed analysis found. Please run an analysis first.');
        setLoading(false);
        return;
      }
      
      setAnalysisRun(completedRun);

      // Fetch findings for this run
      const findingsRes = await fetch(
        `/api/projects/${projectId}/findings?runId=${completedRun.id}`
      );
      if (!findingsRes.ok) {
        throw new Error('Failed to fetch findings');
      }
      const findingsData = await findingsRes.json();
      setFindings(findingsData.data || []);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const filterFindings = () => {
    if (selectedCategory === 'all') {
      setFilteredFindings(findings);
    } else {
      setFilteredFindings(findings.filter(f => f.category === selectedCategory));
    }
  };

  const getCategoryCount = (category: string) => {
    if (category === 'all') return findings.length;
    return findings.filter(f => f.category === category).length;
  };

  const handleExportPDF = async () => {
    if (!project || !analysisRun) return;
    
    try {
      setExporting(true);
      await exportReportToPDF(project, analysisRun, findings);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <ErrorState
          message={error}
          onRetry={fetchReportData}
        />
        <div className="flex justify-center mt-4">
          <Button 
            onClick={() => router.push(`/project/${projectId}`)} 
            variant="outline"
          >
            Back to Project
          </Button>
        </div>
      </div>
    );
  }

  if (!analysisRun || !project) {
    return null;
  }

  const healthScore = analysisRun.health_score ?? 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{project.name}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Analysis Report</p>
        </div>
        <Button 
          onClick={handleExportPDF} 
          disabled={exporting}
          variant="outline"
          className="w-full sm:w-auto"
          aria-label="Export report as PDF"
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </header>

      {/* Health Score Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 w-full">
              <h2 className="text-lg font-semibold mb-4">Health Score</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="list" aria-label="Test results summary">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" role="listitem">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-2xl font-bold" aria-label={`${analysisRun.passed} tests passed`}>{analysisRun.passed}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" role="listitem">
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-2xl font-bold" aria-label={`${analysisRun.failed} tests failed`}>{analysisRun.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" role="listitem">
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-2xl font-bold" aria-label={`${analysisRun.total_tests} total tests`}>{analysisRun.total_tests}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Health Score Ring */}
            <div className="shrink-0" aria-label={`Overall health score: ${healthScore} out of 100`}>
              <HealthScoreRing score={healthScore} size="xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Findings Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
          <CardDescription>
            Issues discovered during analysis, organized by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5" role="tablist" aria-label="Finding categories">
              <TabsTrigger value="all" role="tab" aria-selected={selectedCategory === 'all'}>
                All ({getCategoryCount('all')})
              </TabsTrigger>
              <TabsTrigger value="bug" role="tab" aria-selected={selectedCategory === 'bug'}>
                Bug ({getCategoryCount('bug')})
              </TabsTrigger>
              <TabsTrigger value="security" role="tab" aria-selected={selectedCategory === 'security'}>
                Security ({getCategoryCount('security')})
              </TabsTrigger>
              <TabsTrigger value="production" role="tab" aria-selected={selectedCategory === 'production'}>
                Production ({getCategoryCount('production')})
              </TabsTrigger>
              <TabsTrigger value="prd_compliance" role="tab" aria-selected={selectedCategory === 'prd_compliance'}>
                PRD ({getCategoryCount('prd_compliance')})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-6 space-y-4" role="tabpanel">
              {filteredFindings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" role="status">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" aria-hidden="true" />
                  <p>No {selectedCategory === 'all' ? '' : selectedCategory} issues found!</p>
                </div>
              ) : (
                <div role="list" aria-label={`${selectedCategory} findings`}>
                  {filteredFindings.map((finding) => (
                    <div key={finding.id} role="listitem">
                      <FindingCard finding={finding} projectId={projectId} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

