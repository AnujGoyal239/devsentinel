'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFixProgress } from '@/hooks/useFixProgress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, Code2, TestTube, GitPullRequest, Box } from 'lucide-react';

interface FixRunningPageProps {
  params: {
    id: string;
    findingId: string;
  };
}

/**
 * Fix Running Page
 * Displays real-time progress updates during fix execution
 * 
 * Features:
 * - Real-time agent log stream
 * - Current stage indicators (sandboxing, coding, linting, testing, opening_pr)
 * - Animated loading indicators
 * - Auto-navigation to fix complete page on success
 * - Error handling with user-friendly messages
 */
export default function FixRunningPage({ params }: FixRunningPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fixJobId = searchParams.get('fixJobId');
  const projectId = params.id;
  const findingId = params.findingId;

  const { status, logs, pr_url, isComplete, error } = useFixProgress(fixJobId || '');

  // Navigate to fix complete page when fix completes successfully
  useEffect(() => {
    if (isComplete && status === 'complete' && !error) {
      // Small delay to show completion state before navigation
      const timer = setTimeout(() => {
        router.push(`/project/${projectId}/fix/${findingId}/done?fixJobId=${fixJobId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, status, error, router, projectId, findingId, fixJobId]);

  // Handle missing fixJobId
  if (!fixJobId) {
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
              No fix job ID provided. Please start a new fix from the findings page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get stage icon and label
  const getStageInfo = () => {
    if (error || status === 'failed') {
      return {
        icon: <XCircle className="h-8 w-8 text-destructive animate-pulse" />,
        label: 'Fix Failed',
        description: 'An error occurred during the fix process',
      };
    }
    if (isComplete && status === 'complete') {
      return {
        icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
        label: 'Fix Complete',
        description: 'Redirecting to results...',
      };
    }

    switch (status) {
      case 'sandboxing':
        return {
          icon: <Box className="h-8 w-8 text-primary animate-pulse" />,
          label: 'Setting Up Sandbox',
          description: 'Creating isolated environment and cloning repository',
        };
      case 'coding':
        return {
          icon: <Code2 className="h-8 w-8 text-primary animate-pulse" />,
          label: 'Writing Fix',
          description: 'AI agent is analyzing and fixing the issue',
        };
      case 'linting':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          label: 'Running Linter',
          description: 'Checking code quality and style',
        };
      case 'testing':
        return {
          icon: <TestTube className="h-8 w-8 text-primary animate-pulse" />,
          label: 'Running Tests',
          description: 'Validating the fix with test suite',
        };
      case 'opening_pr':
        return {
          icon: <GitPullRequest className="h-8 w-8 text-primary animate-pulse" />,
          label: 'Creating Pull Request',
          description: 'Opening PR on GitHub',
        };
      default:
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          label: 'Initializing',
          description: 'Starting fix pipeline',
        };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            {stageInfo.icon}
            <div>
              <CardTitle>{stageInfo.label}</CardTitle>
              <CardDescription>{stageInfo.description}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Stage Progress Indicators */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Fix Pipeline Stages</h3>
            <div className="grid gap-2" role="list" aria-label="Fix pipeline stages">
              <StageIndicator
                label="Sandboxing"
                isActive={status === 'sandboxing'}
                isComplete={
                  status === 'coding' ||
                  status === 'linting' ||
                  status === 'testing' ||
                  status === 'opening_pr' ||
                  status === 'complete'
                }
              />
              <StageIndicator
                label="Coding"
                isActive={status === 'coding'}
                isComplete={
                  status === 'linting' ||
                  status === 'testing' ||
                  status === 'opening_pr' ||
                  status === 'complete'
                }
              />
              <StageIndicator
                label="Linting"
                isActive={status === 'linting'}
                isComplete={status === 'testing' || status === 'opening_pr' || status === 'complete'}
              />
              <StageIndicator
                label="Testing"
                isActive={status === 'testing'}
                isComplete={status === 'opening_pr' || status === 'complete'}
              />
              <StageIndicator
                label="Opening PR"
                isActive={status === 'opening_pr'}
                isComplete={status === 'complete'}
              />
            </div>
          </div>

          {/* Agent Log Stream */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Agent Log</h3>
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/50 p-4" role="log" aria-live="polite" aria-atomic="false">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Waiting for agent logs...</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div key={index} className="text-sm font-mono">
                      <span className="text-muted-foreground">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{' '}
                      <span className="font-semibold text-primary">[{log.stage}]</span>{' '}
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

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

interface StageIndicatorProps {
  label: string;
  isActive: boolean;
  isComplete: boolean;
}

function StageIndicator({ label, isActive, isComplete }: StageIndicatorProps) {
  const status = isComplete ? 'complete' : isActive ? 'in progress' : 'pending';
  
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isActive
          ? 'bg-primary/10 border-primary'
          : isComplete
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-muted/50 border-border'
      }`}
      role="listitem"
      aria-label={`${label}: ${status}`}
    >
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
  );
}
