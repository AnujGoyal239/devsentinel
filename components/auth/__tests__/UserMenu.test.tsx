/**
 * Unit Tests for UserMenu Component
 * 
 * Tests:
 * - Component rendering
 * - User avatar display
 * - Dropdown menu interaction
 * - Logout functionality
 * - User information display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from '../UserMenu';

describe('UserMenu', () => {
  const originalLocation = window.location;
  
  const mockUser = {
    username: 'testuser',
    avatar_url: 'https://example.com/avatar.jpg',
    email: 'test@example.com',
  };

  const mockUserWithoutAvatar = {
    username: 'John Doe',
    avatar_url: null,
    email: 'john@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('Component Rendering', () => {
    it('should render user menu button', () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu for testuser/i });
      expect(button).toBeInTheDocument();
    });

    it('should display user avatar', () => {
      render(<UserMenu user={mockUser} />);
      
      const avatar = screen.getByAltText("testuser's avatar");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockUser.avatar_url);
    });

    it('should display initials when no avatar', () => {
      render(<UserMenu user={mockUserWithoutAvatar} />);
      
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should calculate initials correctly', () => {
      const user = { username: 'Alice Bob Charlie', avatar_url: null };
      render(<UserMenu user={user} />);
      
      expect(screen.getByText('AB')).toBeInTheDocument();
    });

    it('should handle single name for initials', () => {
      const user = { username: 'Alice', avatar_url: null };
      render(<UserMenu user={user} />);
      
      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });

  describe('Dropdown Menu Interaction', () => {
    it('should open dropdown menu on click', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(mockUser.username)).toBeInTheDocument();
      });
    });

    it('should display user information in dropdown', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(mockUser.username)).toBeInTheDocument();
        expect(screen.getByText(mockUser.email!)).toBeInTheDocument();
      });
    });

    it('should not display email if not provided', async () => {
      const userWithoutEmail = { ...mockUser, email: undefined };
      render(<UserMenu user={userWithoutEmail} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(mockUser.username)).toBeInTheDocument();
      });
      
      expect(screen.queryByText(mockUser.email!)).not.toBeInTheDocument();
    });

    it('should display Profile menu item', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });
    });

    it('should display Log out menu item', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument();
      });
    });

    it('should have Profile menu item disabled', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        const profileItem = screen.getByText('Profile').closest('[role="menuitem"]');
        expect(profileItem).toHaveAttribute('data-disabled', 'true');
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should navigate to logout endpoint on logout click', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument();
      });
      
      const logoutButton = screen.getByText('Log out');
      await userEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(window.location.href).toBe('/api/auth/logout');
      });
    });

    it('should show logging out state', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument();
      });
      
      const logoutButton = screen.getByText('Log out');
      await userEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(screen.getByText('Logging out...')).toBeInTheDocument();
      });
    });

    it('should disable logout button while logging out', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument();
      });
      
      const logoutButton = screen.getByText('Log out').closest('[role="menuitem"]');
      await userEvent.click(logoutButton!);
      
      await waitFor(() => {
        expect(logoutButton).toHaveAttribute('data-disabled', 'true');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on menu button', () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu for testuser/i });
      expect(button).toHaveAttribute('aria-label', 'User menu for testuser');
    });

    it('should hide icons from screen readers', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        const icons = screen.getAllByRole('img', { hidden: true });
        icons.forEach(icon => {
          expect(icon).toHaveAttribute('aria-hidden', 'true');
        });
      });
    });

    it('should be keyboard accessible', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      button.focus();
      
      expect(button).toHaveFocus();
    });
  });

  describe('Avatar Display', () => {
    it('should show avatar image when URL is provided', () => {
      render(<UserMenu user={mockUser} />);
      
      const avatar = screen.getByAltText("testuser's avatar");
      expect(avatar).toHaveAttribute('src', mockUser.avatar_url);
    });

    it('should show fallback initials when avatar URL is null', () => {
      render(<UserMenu user={mockUserWithoutAvatar} />);
      
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should uppercase initials', () => {
      const user = { username: 'alice bob', avatar_url: null };
      render(<UserMenu user={user} />);
      
      expect(screen.getByText('AB')).toBeInTheDocument();
    });

    it('should limit initials to 2 characters', () => {
      const user = { username: 'Alice Bob Charlie David', avatar_url: null };
      render(<UserMenu user={user} />);
      
      const initials = screen.getByText(/^[A-Z]{1,2}$/);
      expect(initials.textContent?.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Menu Styling', () => {
    it('should apply red color to logout button', async () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(button);
      
      await waitFor(() => {
        const logoutItem = screen.getByText('Log out').closest('[role="menuitem"]');
        expect(logoutItem).toHaveClass('text-red-600');
      });
    });

    it('should have rounded avatar button', () => {
      render(<UserMenu user={mockUser} />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toHaveClass('rounded-full');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long usernames', () => {
      const user = {
        username: 'VeryLongUsernameWithManyCharacters',
        avatar_url: null,
      };
      render(<UserMenu user={user} />);
      
      expect(screen.getByText('VE')).toBeInTheDocument();
    });

    it('should handle usernames with special characters', () => {
      const user = {
        username: 'user@123',
        avatar_url: null,
      };
      render(<UserMenu user={user} />);
      
      expect(screen.getByText('U')).toBeInTheDocument();
    });

    it('should handle empty username gracefully', () => {
      const user = {
        username: '',
        avatar_url: null,
      };
      render(<UserMenu user={user} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });
});
