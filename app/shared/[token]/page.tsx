/**
 * Shared Report Page
 * 
 * Public read-only view of an analysis report via shareable link
 */

import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getShareableLink } from '@/lib/sharing/report-share';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthScoreRing } from '@/components/ui/health-score-ring';

interface SharedReportPageProps {
  params: {
    token: string;
  };
}

export default async function SharedReportPage({ params }: SharedReportPageProps) {
  const { token } = params;

  // Validate token and get share
  const share = await getShareableLink(token);

  if (!share) {
    notFound();
  }

  // Get analysis run
  const { data: run, error: runError } = await supabaseAdmin
    .from('analysis_runs')
    .select('*, projects(name, repo_owner, repo_name)')
    .eq('id', share.run_id)
    .single();

  if (runError || !run) {
    notFound();
  }

  // Get findings
  const { data: findings } = await supabaseAdmin
    .from('findings')
    .select('*')
    .eq('run_id', share.run_id)
    .order('severity', { ascending: true });

  const totalFindings = findings?.length || 0;
  const failedFindings = findings?.filter(f => f.status === 'fail').length || 0;

  // Group findings by category
  const findingsByCategory = {
    bug: findings?.filter(f => f.category === 'bug').length || 0,
    security: findings?.filter(f => f.category === 'security').length || 0,
    performance: findings?.filter(f => f.category === 'performance').length || 0,
    production: findings?.filter(f => f.category === 'production').length || 0,
    prd_compliance: findings?.filter(f => f.category === 'prd_compliance').length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {run.projects?.name || 'Analysis Report'}
              </h1>
              <p className="mt-2 text-gray-600">
                {run.projects?.repo_owner}/{run.projects?.repo_name}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Analyzed on {new Date(run.created_at).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              Read-Only Shared Report
            </Badge>
          </div>
        </div>

        {/* Health Score */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Health Score</h2>
              <p className="text-gray-600">
                {totalFindings} total findings • {failedFindings} failed
              </p>
            </div>
            <HealthScoreRing score={run.health_score || 0} size="lg" />
          </div>
        </Card>

        {/* Findings by Category */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Findings by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {findingsByCategory.bug}
              </div>
              <div className="text-sm text-gray-600">Bugs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {findingsByCategory.security}
              </div>
              <div className="text-sm text-gray-600">Security</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {findingsByCategory.performance}
              </div>
              <div className="text-sm text-gray-600">Performance</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {findingsByCategory.production}
              </div>
              <div className="text-sm text-gray-600">Production</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {findingsByCategory.prd_compliance}
              </div>
              <div className="text-sm text-gray-600">PRD Compliance</div>
            </div>
          </div>
        </Card>

        {/* Findings List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">All Findings</h2>
          {findings && findings.length > 0 ? (
            <div className="space-y-4">
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          finding.severity === 'critical' || finding.severity === 'high'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {finding.severity}
                      </Badge>
                      <Badge variant="outline">{finding.category}</Badge>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {finding.bug_type || 'Issue'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{finding.file_path}</p>
                  <p className="text-gray-700">{finding.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No findings in this report.</p>
          )}
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>This is a read-only shared report. Generated by DevSentinel.</p>
          <p className="mt-1">
            Link expires on {new Date(share.expires_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
