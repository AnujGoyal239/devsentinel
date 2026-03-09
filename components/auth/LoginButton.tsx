/**
 * Login Button Component
 * 
 * Redirects to Auth0 GitHub OAuth flow
 */

'use client';

import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

interface LoginButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function LoginButton({ 
  className, 
  variant = 'default',
  size = 'default' 
}: LoginButtonProps) {
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <Button
      onClick={handleLogin}
      variant={variant}
      size={size}
      className={className}
      aria-label="Sign in with GitHub"
    >
      <Github className="mr-2 h-4 w-4" aria-hidden="true" />
      Sign in with GitHub
    </Button>
  );
}
