/**
 * New Project Page
 * 
 * Form for creating a new project with GitHub repository URL
 */

import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ProjectForm } from '@/components/project/ProjectForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Create New Project",
  description: "Connect a GitHub repository to start analyzing your code with AI",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewProjectPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/api/auth/login?returnTo=/project/new');
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
        <p className="text-muted-foreground">
          Connect a GitHub repository to start analyzing your code
        </p>
      </header>

      <ProjectForm />
    </div>
  );
}
