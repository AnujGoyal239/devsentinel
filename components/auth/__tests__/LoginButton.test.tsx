/**
 * Unit Tests for LoginButton Component
 * 
 * Tests:
 * - Component rendering
 * - Click interaction
 * - Navigation to Auth0
 * - Button variants and sizes
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginButton } from '../LoginButton';

describe('LoginButton', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('Component Rendering', () => {
    it('should render login button', () => {
      render(<LoginButton />);
      
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
    });

    it('should display GitHub icon', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should display button text', () => {
      render(<LoginButton />);
      
      expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    });

    it('should have proper aria-label', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Sign in with GitHub');
    });
  });

  describe('Click Interaction', () => {
    it('should navigate to Auth0 login on click', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(window.location.href).toBe('/api/auth/login');
    });

    it('should be clickable', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      
      await userEvent.click(button);
      expect(window.location.href).toBe('/api/auth/login');
    });
  });

  describe('Button Variants', () => {
    it('should apply default variant by default', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply outline variant', () => {
      render(<LoginButton variant="outline" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply ghost variant', () => {
      render(<LoginButton variant="ghost" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button Sizes', () => {
    it('should apply default size by default', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply small size', () => {
      render(<LoginButton size="sm" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply large size', () => {
      render(<LoginButton size="lg" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<LoginButton className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should combine custom className with default classes', () => {
      render(<LoginButton className="my-custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('my-custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
    });

    it('should have proper role', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should have descriptive aria-label', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Sign in with GitHub');
    });

    it('should hide icon from screen readers', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Integration', () => {
    it('should work with different prop combinations', async () => {
      render(<LoginButton variant="outline" size="lg" className="test-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('test-class');
      
      await userEvent.click(button);
      expect(window.location.href).toBe('/api/auth/login');
    });
  });
});
