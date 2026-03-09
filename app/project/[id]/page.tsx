/**
 * Project Detail Page
 * 
 * Displays project information, status, health score, and action buttons
 */

import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ProjectDetail } from '@/components/project/ProjectDetail';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Project Details",
  description: "View project information, analysis status, and health score",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/api/auth/login?returnTo=/project/' + params.id);
  }

  return (
    <div className="container mx-auto py-8">
      <ProjectDetail projectId={params.id} />
    </div>
  );
}
