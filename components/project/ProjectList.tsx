'use client';

/**
 * Project List Component
 * 
 * Displays list of projects with status, health score, and last updated
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink } from 'lucide-react';
import { LoadingSpinner, SkeletonList } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { HealthScoreBadge } from '@/components/ui/health-score-ring';
import type { Project } from '@/lib/supabase/types';

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <SkeletonList count={3} />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={fetchProjects}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center" role="status">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            Get started by creating your first project. Connect a GitHub repository
            and run AI-powered code analysis.
          </p>
          <Link href="/project/new">
            <Button aria-label="Create your first project">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Create Project
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Projects">
      {projects.map((project) => (
        <div key={project.id} role="listitem">
          <ProjectCard project={project} />
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const statusColors: Record<Project['status'], string> = {
    idle: 'bg-gray-500',
    analysing: 'bg-blue-500',
    complete: 'bg-green-500',
    fixing: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <Link href={`/project/${project.id}`} aria-label={`View project ${project.name}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{project.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 truncate">
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{project.repo_owner}/{project.repo_name}</span>
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className={`${statusColors[project.status]} text-white shrink-0`}
              aria-label={`Project status: ${project.status}`}
            >
              {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {project.health_score !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Health Score</span>
                <HealthScoreBadge score={project.health_score} />
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Branch</span>
              <span className="font-mono text-xs truncate max-w-[150px]" aria-label={`Branch: ${project.branch}`}>{project.branch}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last updated</span>
              <time className="text-xs" dateTime={project.updated_at}>{formatDate(project.updated_at)}</time>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
