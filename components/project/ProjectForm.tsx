'use client';

/**
 * Project Form Component
 * 
 * Form for creating a new project with GitHub repository URL
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

export function ProjectForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    repo_url: '',
    branch: 'main',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Redirect to project detail page
      router.push(`/project/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Create new project">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="My Awesome Project"
          value={formData.name}
          onChange={handleChange}
          required
          disabled={isLoading}
          aria-describedby="name-description"
        />
        <p id="name-description" className="text-sm text-muted-foreground">
          A friendly name to identify your project
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repo_url">GitHub Repository URL</Label>
        <Input
          id="repo_url"
          name="repo_url"
          type="url"
          placeholder="https://github.com/owner/repo"
          value={formData.repo_url}
          onChange={handleChange}
          required
          disabled={isLoading}
          aria-describedby="repo-url-description"
        />
        <p id="repo-url-description" className="text-sm text-muted-foreground">
          The full URL of your GitHub repository
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch">Branch</Label>
        <Input
          id="branch"
          name="branch"
          type="text"
          placeholder="main"
          value={formData.branch}
          onChange={handleChange}
          disabled={isLoading}
          aria-describedby="branch-description"
        />
        <p id="branch-description" className="text-sm text-muted-foreground">
          The branch to analyze (default: main)
        </p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading} aria-label={isLoading ? 'Creating project...' : 'Create project'}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Create Project
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={isLoading}
          aria-label="Cancel and return to dashboard"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
