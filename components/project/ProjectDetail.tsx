'use client';

/**
 * Project Detail Component
 * 
 * Displays full project information with action buttons
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  Play,
  Upload,
  ArrowLeft,
  GitBranch,
  Calendar,
  FileText,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { Project, AnalysisRun } from '@/lib/supabase/types';
import { DocumentUpload } from './DocumentUpload';

interface ProjectWithRun extends Project {
  latest_run: AnalysisRun | null;
  documents?: Array<{
    id: string;
    filename: string;
    file_type: string;
    created_at: string;
  }>;
  requirements?: Array<{
    id: string;
    category: string;
    feature_name: string;
    description: string | null;
    endpoint: string | null;
    expected_behavior: string | null;
    priority: string;
  }>;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        throw new Error('Failed to fetch project');
      }
      const data = await response.json();
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchProject(); // Refresh project data
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'feature':
        return 'bg-blue-500';
      case 'endpoint':
        return 'bg-green-500';
      case 'acceptance_criteria':
        return 'bg-purple-500';
      case 'edge_case':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading project details...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard')} aria-label="Return to dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Button>
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error || 'Project not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusColors: Record<Project['status'], string> = {
    idle: 'bg-gray-500',
    analysing: 'bg-blue-500',
    complete: 'bg-green-500',
    fixing: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const healthScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="mb-2"
            aria-label="Return to dashboard"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              aria-label={`Open ${project.repo_owner}/${project.repo_name} on GitHub in new tab`}
            >
              {project.repo_owner}/{project.repo_name}
            </a>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={`${statusColors[project.status]} text-white text-lg px-4 py-2`}
          aria-label={`Project status: ${project.status}`}
        >
          {project.status}
        </Badge>
      </header>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Repository details and current status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Repository</p>
              <p className="font-mono text-sm">
                {project.repo_owner}/{project.repo_name}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Branch</p>
              <div className="flex items-center gap-1">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                <p className="font-mono text-sm">{project.branch}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created</p>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <time className="text-sm" dateTime={project.created_at}>{formatDate(project.created_at)}</time>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <time className="text-sm" dateTime={project.updated_at}>{formatDate(project.updated_at)}</time>
              </div>
            </div>
          </div>

          {project.health_score !== null && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Health Score</p>
                  <p className="text-sm">Overall code quality metric</p>
                </div>
                <div className={`text-5xl font-bold ${healthScoreColor(project.health_score)}`} aria-label={`Health score: ${project.health_score} out of 100`}>
                  {project.health_score}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage your project analysis and documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowUpload(!showUpload)}
            aria-expanded={showUpload}
            aria-controls="document-upload-section"
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {showUpload ? 'Hide Upload' : 'Upload PRD Document'}
          </Button>
          <Button className="w-full" size="lg" disabled aria-label="Run analysis (coming in task 4)">
            <Play className="mr-2 h-4 w-4" aria-hidden="true" />
            Run Analysis
            <Badge variant="secondary" className="ml-2">
              Task 4
            </Badge>
          </Button>
        </CardContent>
      </Card>

      {/* Document Upload */}
      {showUpload && (
        <div id="document-upload-section">
          <DocumentUpload
            projectId={projectId}
            onUploadComplete={handleUploadComplete}
            onClose={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Latest Analysis Run */}
      {project.latest_run && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Analysis Run</CardTitle>
            <CardDescription>Most recent analysis results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge>{project.latest_run.status}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-sm">{project.latest_run.current_progress}%</p>
              </div>
              {project.latest_run.total_tests > 0 && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Tests</p>
                    <p className="text-sm font-semibold">{project.latest_run.total_tests}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Passed / Failed</p>
                    <p className="text-sm">
                      <span className="text-green-600 font-semibold">
                        {project.latest_run.passed}
                      </span>
                      {' / '}
                      <span className="text-red-600 font-semibold">
                        {project.latest_run.failed}
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>
            {project.latest_run.status === 'complete' && (
              <Button className="w-full" variant="outline" disabled>
                View Full Report
                <Badge variant="secondary" className="ml-2">
                  Task 4
                </Badge>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {project.documents && project.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Uploaded PRD documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" role="list" aria-label="Uploaded documents">
              {project.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  role="listitem"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{doc.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {doc.file_type.toUpperCase()} • <time dateTime={doc.created_at}>{formatDate(doc.created_at)}</time>
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-600" aria-label="Document uploaded successfully" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements */}
      {project.requirements && project.requirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Requirements</CardTitle>
            <CardDescription>
              AI-extracted requirements from PRD documents ({project.requirements.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.requirements.map((req) => (
                <div
                  key={req.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="secondary"
                          className={`${getCategoryBadgeColor(req.category)} text-white`}
                        >
                          {req.category.replace('_', ' ')}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${getPriorityBadgeColor(req.priority)} text-white border-0`}
                        >
                          {req.priority}
                        </Badge>
                      </div>
                      <h4 className="font-semibold">{req.feature_name}</h4>
                      {req.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {req.description}
                        </p>
                      )}
                      {req.endpoint && (
                        <p className="text-sm font-mono mt-1 text-blue-600">
                          {req.endpoint}
                        </p>
                      )}
                      {req.expected_behavior && (
                        <p className="text-sm mt-1">
                          <span className="font-medium">Expected: </span>
                          {req.expected_behavior}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder for Findings */}
      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
          <CardDescription>Analysis results will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Run an analysis to see findings</p>
            <Badge variant="secondary" className="mt-2">
              Task 4
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
