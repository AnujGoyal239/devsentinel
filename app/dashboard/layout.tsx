/**
 * Dashboard Layout
 * 
 * Protected layout with navigation sidebar and user menu
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { UserMenu } from '@/components/auth/UserMenu';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Home, FolderGit2, Settings } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication check
  const user = await getCurrentUser();

  if (!user) {
    redirect('/api/auth/login?returnTo=/dashboard');
  }

  return (
    <div className="flex h-screen">
      {/* Skip Navigation Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>
      
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/10" role="navigation" aria-label="Main navigation">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-6">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-xl font-bold">DevSentinel</span>
            </Link>
            <ThemeToggle />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4" aria-label="Dashboard navigation">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Home className="h-5 w-5" aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/project/new"
              className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <FolderGit2 className="h-5 w-5" aria-hidden="true" />
              <span>New Project</span>
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </nav>

          {/* User Menu at Bottom */}
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email || 'GitHub User'}
                  </span>
                </div>
              </div>
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-y-auto" role="main">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
