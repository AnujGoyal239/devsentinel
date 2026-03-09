'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, ExternalLink, Download, ArrowLeft, GitPullRequest } from 'lucide-react';
import { supabaseClient } from '@/lib/supabase/client';

interface FixCompletePageProps {
  params: {
    id: string;
    findingId: string;
  };
}

interface FixJobData {
  id: string;
  status: string;
  pr_url: string | null;
  pr_number: number | null;
  branch_name: string | null;
  agent_log: any[];
  finding: {
    file_path: string;
    bug_type: string;
    explanation: string;
    fix_original: string;
    fix_suggested: string;
  };
}

/**
 * Fix Complete Page
 * Displays results after successful fix completion
 * 
 * Features:
 * - Link to opened GitHub PR
 * - Side-by-side diff preview
 * - "Mark Resolved" button
 * - "Download Patch File" button
 * - Back to report navigation
 */
export default function FixCompletePage({ params }: FixCompletePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fixJobId = searchParams.get('fixJobId');
  const projectId = params.id;
  const findingId = params.findingId;

  const [fixJob, setFixJob] = useState<FixJobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingResolved, setMarkingResolved] = useState(false);

  // Fetch fix job data
  useEffect(() => {
    if (!fixJobId) {
      setError('No fix job ID provided');
      setLoading(false);
      return;
    }

    const fetchFixJob = async () => {
      try {
        const { data, error: fetchError } = await supabaseClient
          .from('fix_jobs')
          .select(`
            id,
            status,
            pr_url,
            pr_number,
            branch_name,
            agent_log,
            findings!inner(
              file_path,
              bug_type,
              explanation,
              fix_original,
              fix_suggested
            )
          `)
          .eq('id', fixJobId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        // Extract finding from nested structure
        const finding = (data as any).findings;
        setFixJob({
          ...data,
          finding,
        });
      } catch (err) {
        console.error('Error fetching fix job:', err);
        setError('Failed to load fix job details');
      } finally {
        setLoading(false);
      }
    };

    fetchFixJob();
  }, [fixJobId]);

  // Handle mark as resolved
  const handleMarkResolved = async () => {
    if (!findingId) return;

    setMarkingResolved(true);
    try {
      // Update finding status to "pass" (resolved)
      const { error: updateError } = await supabaseClient
        .from('findings')
        .update({ status: 'pass' })
        .eq('id', findingId);

      if (updateError) {
        throw updateError;
      }

      // Navigate back to report
      router.push(`/project/${projectId}/report`);
    } catch (err) {
      console.error('Error marking as resolved:', err);
      alert('Failed to mark as resolved. Please try again.');
    } finally {
      setMarkingResolved(false);
    }
  };

  // Handle download patch file
  const handleDownloadPatch = () => {
    if (!fixJob?.finding) return;

    // Create unified diff format
    const patchContent = `diff --git a/${fixJob.finding.file_path} b/${fixJob.finding.file_path}
--- a/${fixJob.finding.file_path}
+++ b/${fixJob.finding.file_path}
@@ -1,${fixJob.finding.fix_original?.split('\n').length || 0} +1,${fixJob.finding.fix_suggested?.split('\n').length || 0} @@
${fixJob.finding.fix_original?.split('\n').map(line => `-${line}`).join('\n') || ''}
${fixJob.finding.fix_suggested?.split('\n').map(line => `+${line}`).join('\n') || ''}
`;

    // Create blob and download
    const blob = new Blob([patchContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fix-${findingId}.patch`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-8">
            <div className="text-center" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">Loading fix details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !fixJob) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground" role="alert">{error || 'Fix job not found'}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/project/${projectId}/report`)}
              aria-label="Return to report"
            >
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Back to Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" aria-hidden="true" />
            <div>
              <CardTitle>Fix Complete</CardTitle>
              <CardDescription>
                Successfully created pull request for {fixJob.finding.bug_type} in{' '}
                {fixJob.finding.file_path}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pull Request Link */}
          {fixJob.pr_url && (
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <GitPullRequest className="h-5 w-5 text-green-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Pull Request Created</p>
                  <p className="text-xs text-muted-foreground">
                    PR #{fixJob.pr_number} • Branch: {fixJob.branch_name}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a 
                  href={fixJob.pr_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label={`View pull request ${fixJob.pr_number} on GitHub in new tab`}
                >
                  View on GitHub
                  <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
                </a>
              </Button>
            </div>
          )}

          {/* Diff Preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Code Changes</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Original Code */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Original Code</p>
                <ScrollArea className="h-[300px] rounded-lg border bg-red-500/5">
                  <pre className="p-4 text-xs font-mono">
                    <code className="text-red-600 dark:text-red-400">
                      {fixJob.finding.fix_original || 'No original code available'}
                    </code>
                  </pre>
                </ScrollArea>
              </div>

              {/* Fixed Code */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Fixed Code</p>
                <ScrollArea className="h-[300px] rounded-lg border bg-green-500/5">
                  <pre className="p-4 text-xs font-mono">
                    <code className="text-green-600 dark:text-green-400">
                      {fixJob.finding.fix_suggested || 'No fixed code available'}
                    </code>
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Issue Explanation</h3>
            <p className="text-sm text-muted-foreground">{fixJob.finding.explanation}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button onClick={handleMarkResolved} disabled={markingResolved} aria-label={markingResolved ? 'Marking finding as resolved...' : 'Mark finding as resolved'}>
              <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
              {markingResolved ? 'Marking Resolved...' : 'Mark Resolved'}
            </Button>
            <Button variant="outline" onClick={handleDownloadPatch} aria-label="Download patch file">
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Download Patch File
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push(`/project/${projectId}/report`)}
              className="ml-auto"
              aria-label="Return to report"
            >
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Back to Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
