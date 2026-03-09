'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface AnalysisRunningPageProps {
  params: {
    id: string;
  };
}

/**
 * Analysis Running Page
 * Displays real-time progress updates during analysis execution
 * 
 * Features:
 * - Stage-by-stage progress bar (0-100%)
 * - Current stage label and message
 * - File count and progress percentage
 * - Animated loading indicators
 * - Auto-navigation to report page on completion
 * - Error handling with user-friendly messages
 */
export default function AnalysisRunningPage({ params }: AnalysisRunningPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');
  const projectId = params.id;

  const { status, stage, progress, health_score, isComplete, error } = useAnalysisProgress(
    runId || ''
  );

  // Navigate to report page when analysis completes
  useEffect(() => {
    if (isComplete && status === 'complete' && !error) {
      // Small delay to show completion state before navigation
      const timer = setTimeout(() => {
        router.push(`/project/${projectId}/report?runId=${runId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, status, error, router, projectId, runId]);

  // Handle missing runId
  if (!runId) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" aria-hidden="true" />
              Invalid Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No analysis run ID provided. Please start a new analysis from the project page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine progress bar color based on progress
  const getProgressColor = () => {
    if (error || status === 'failed') return 'bg-destructive';
    if (isComplete && status === 'complete') return 'bg-green-500';
    return 'bg-primary';
  };

  // Get stage icon
  const getStageIcon = () => {
    if (error || status === 'failed') {
      return <XCircle className="h-8 w-8 text-destructive animate-pulse" />;
    }
    if (isComplete && status === 'complete') {
      return <CheckCircle2 className="h-8 w-8 text-green-500" />;
    }
    return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            {getStageIcon()}
            <div>
              <CardTitle>
                {error || status === 'failed'
                  ? 'Analysis Failed'
                  : isComplete && status === 'complete'
                  ? 'Analysis Complete'
                  : 'Analysis Running'}
              </CardTitle>
              <CardDescription>
                {error || status === 'failed'
                  ? 'An error occurred during analysis'
                  : isComplete && status === 'complete'
                  ? 'Redirecting to report...'
                  : 'Please wait while we analyze your codebase'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2" role="status" aria-live="polite" aria-atomic="true">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{stage}</span>
              <span className="text-muted-foreground" aria-label={`${progress} percent complete`}>{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" aria-label="Analysis progress" />
          </div>

          {/* Stage Breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Analysis Stages</h3>
            <div className="grid gap-2" role="list" aria-label="Analysis stages">
              <StageItem
                label="Fetching repository"
                range="0-5%"
                isActive={progress >= 0 && progress < 10}
                isComplete={progress >= 10}
              />
              <StageItem
                label="Parsing PRD document"
                range="5-10%"
                isActive={progress >= 5 && progress < 15}
                isComplete={progress >= 15}
              />
              <StageItem
                label="Pass 1: Understanding codebase"
                range="10-25%"
                isActive={progress >= 10 && progress < 30}
                isComplete={progress >= 30}
              />
              <StageItem
                label="Pass 2: Bug detection & PRD compliance"
                range="25-60%"
                isActive={progress >= 25 && progress < 65}
                isComplete={progress >= 65}
              />
              <StageItem
                label="Pass 3: Security audit"
                range="60-80%"
                isActive={progress >= 60 && progress < 80}
                isComplete={progress >= 80}
              />
              <StageItem
                label="Pass 4: Production readiness"
                range="80-100%"
                isActive={progress >= 80 && progress < 100}
                isComplete={progress >= 100}
              />
            </div>
          </div>

          {/* Health Score (shown when complete) */}
          {isComplete && status === 'complete' && health_score !== undefined && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Health Score</span>
                <span
                  className={`text-2xl font-bold ${
                    health_score >= 80
                      ? 'text-green-500'
                      : health_score >= 50
                      ? 'text-yellow-500'
                      : 'text-red-500'
                  }`}
                  aria-label={`Health score: ${health_score} out of 100`}
                >
                  {health_score}/100
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="pt-4 border-t" role="alert">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">Error Details:</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StageItemProps {
  label: string;
  range: string;
  isActive: boolean;
  isComplete: boolean;
}

function StageItem({ label, range, isActive, isComplete }: StageItemProps) {
  const status = isComplete ? 'complete' : isActive ? 'in progress' : 'pending';
  
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        isActive
          ? 'bg-primary/10 border-primary'
          : isComplete
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-muted/50 border-border'
      }`}
      role="listitem"
      aria-label={`${label}: ${status}`}
    >
      <div className="flex items-center gap-3">
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" aria-hidden="true" />
        )}
        <span
          className={`text-sm ${
            isActive ? 'font-medium' : isComplete ? 'text-muted-foreground' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
      </div>
      <span className="text-xs text-muted-foreground" aria-label={`Progress range: ${range}`}>{range}</span>
    </div>
  );
}
