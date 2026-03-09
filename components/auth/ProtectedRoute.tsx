/**
 * Protected Route Wrapper Component
 * 
 * Wraps pages that require authentication
 * Redirects to login if user is not authenticated
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // Not authenticated, redirect to login
          const currentPath = window.location.pathname;
          router.push(`/api/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/api/auth/login');
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, [router]);

  if (isChecking) {
    return (
      fallback || (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
