/**
 * Login Page
 * 
 * Simple login page that redirects to Auth0
 */

import { LoginButton } from '@/components/auth/LoginButton';
import { Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to DevSentinel with your GitHub account to start analyzing your code",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="w-full max-w-md space-y-8 px-4" role="main">
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            Welcome to DevSentinel
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your GitHub account to get started
          </p>
        </header>

        <div className="mt-8">
          <LoginButton className="w-full" size="lg" />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </main>
    </div>
  );
}
