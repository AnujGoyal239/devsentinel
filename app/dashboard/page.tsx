/**
 * Dashboard Page
 * 
 * Main dashboard showing project list
 */

import { getCurrentUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ProjectList } from '@/components/project/ProjectList';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage and monitor your code analysis projects",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and monitor your code analysis projects
          </p>
        </div>
        <Link href="/project/new">
          <Button className="w-full sm:w-auto" aria-label="Create new project">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Project
          </Button>
        </Link>
      </header>

      {/* Project List */}
      <ProjectList />
    </div>
  );
}
