/**
 * FindingCard Component
 * 
 * Displays a single finding as an expandable card with:
 * - Collapsed: bug type, severity, file path, Auto-Fix button
 * - Expanded: line numbers, explanation, code snippet, diff view
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp, 
  FileCode, 
  Wrench, 
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { DiffViewer } from './DiffViewer';

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

interface FindingCardProps {
  finding: Finding;
  projectId: string;
}

export function FindingCard({ finding, projectId }: FindingCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isFixed, setIsFixed] = useState(finding.status === 'pass');

  const getSeverityIcon = () => {
    switch (finding.severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      case 'low':
        return <Info className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = () => {
    switch (finding.severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'info':
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = () => {
    switch (finding.category) {
      case 'bug':
        return 'bg-red-100 text-red-800';
      case 'security':
        return 'bg-purple-100 text-purple-800';
      case 'production':
        return 'bg-blue-100 text-blue-800';
      case 'prd_compliance':
        return 'bg-green-100 text-green-800';
    }
  };

  const getLanguageFromPath = (path: string | null): string => {
    if (!path) return 'typescript';
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'swift': 'swift',
      'kt': 'kotlin',
      'sql': 'sql',
      'sh': 'bash',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
    };
    return languageMap[ext || ''] || 'typescript';
  };

  const handleAutoFix = async () => {
    try {
      setIsFixing(true);
      const response = await fetch(`/api/findings/${finding.id}/fix`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger auto-fix');
      }

      const data = await response.json();
      
      // Extract fix_job_id from response
      const fixJobId = data.data.fix_job_id;
      
      // Redirect to fix progress page with fixJobId
      window.location.href = `/project/${projectId}/fix/${finding.id}?fixJobId=${fixJobId}`;
    } catch (error) {
      console.error('Error triggering auto-fix:', error);
      alert('Failed to trigger auto-fix. Please try again.');
    } finally {
      setIsFixing(false);
    }
  };

  const handleMarkAsFixed = async () => {
    try {
      const response = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'pass' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark as fixed');
      }

      setIsFixed(true);
    } catch (error) {
      console.error('Error marking as fixed:', error);
      alert('Failed to mark as fixed. Please try again.');
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`${isFixed ? 'opacity-60' : ''}`}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            role="button"
            aria-expanded={isOpen}
            aria-label={`${finding.bug_type || finding.category} finding in ${finding.file_path}. ${isOpen ? 'Collapse' : 'Expand'} details`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category Badge */}
                  <Badge className={getCategoryColor()}>
                    {finding.category.replace('_', ' ').toUpperCase()}
                  </Badge>

                  {/* Bug Type Badge */}
                  {finding.bug_type && (
                    <Badge variant="outline">
                      {finding.bug_type}
                    </Badge>
                  )}

                  {/* Severity Badge */}
                  <Badge 
                    variant="outline" 
                    className={`${getSeverityColor()} flex items-center gap-1`}
                  >
                    {getSeverityIcon()}
                    {finding.severity.toUpperCase()}
                  </Badge>

                  {/* Fixed Badge */}
                  {isFixed && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Fixed
                    </Badge>
                  )}
                </div>

                {/* File Path */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileCode className="h-4 w-4" aria-hidden="true" />
                  <span className="font-mono">{finding.file_path || 'Unknown file'}</span>
                  {finding.line_start && (
                    <span className="text-gray-400" aria-label={`Lines ${finding.line_start} to ${finding.line_end || finding.line_start}`}>
                      Lines {finding.line_start}
                      {finding.line_end && finding.line_end !== finding.line_start 
                        ? `-${finding.line_end}` 
                        : ''}
                    </span>
                  )}
                </div>

                {/* Explanation Preview */}
                {finding.explanation && !isOpen && (
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {finding.explanation}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Auto-Fix Button */}
                {!isFixed && finding.fix_suggested && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoFix();
                    }}
                    disabled={isFixing}
                    aria-label={`Auto-fix ${finding.bug_type || finding.category} issue in ${finding.file_path}`}
                  >
                    <Wrench className="h-4 w-4 mr-1" aria-hidden="true" />
                    {isFixing ? 'Starting...' : 'Auto-Fix'}
                  </Button>
                )}

                {/* Expand/Collapse Icon */}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Full Explanation */}
            {finding.explanation && (
              <div>
                <h4 className="font-semibold mb-2">Explanation</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {finding.explanation}
                </p>
              </div>
            )}

            {/* Code Snippet */}
            {finding.code_snippet && (
              <div>
                <h4 className="font-semibold mb-2">Code Snippet</h4>
                <div className="rounded-lg overflow-hidden border">
                  <SyntaxHighlighter
                    language={getLanguageFromPath(finding.file_path)}
                    style={vscDarkPlus}
                    showLineNumbers
                    startingLineNumber={finding.line_start || 1}
                    customStyle={{
                      margin: 0,
                      fontSize: '0.875rem',
                    }}
                  >
                    {finding.code_snippet}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* Diff View */}
            {finding.fix_original && finding.fix_suggested && (
              <div>
                <h4 className="font-semibold mb-2">Suggested Fix</h4>
                {finding.fix_explanation && (
                  <p className="text-sm text-gray-700 mb-3">
                    {finding.fix_explanation}
                  </p>
                )}
                <DiffViewer
                  oldCode={finding.fix_original}
                  newCode={finding.fix_suggested}
                  language={getLanguageFromPath(finding.file_path)}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              {!isFixed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAsFixed}
                  aria-label={`Mark ${finding.bug_type || finding.category} issue as fixed`}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden="true" />
                  Mark as Fixed
                </Button>
              )}
              {finding.fix_confidence && (
                <span className="text-sm text-gray-500 ml-auto" aria-label={`Fix confidence: ${Math.round(finding.fix_confidence * 100)} percent`}>
                  Fix confidence: {Math.round(finding.fix_confidence * 100)}%
                </span>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
