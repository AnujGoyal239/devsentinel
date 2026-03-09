/**
 * Unit Tests for CommentSection Component
 * 
 * Tests:
 * - Component rendering
 * - Loading state
 * - Error state
 * - Comment list display
 * - Add comment interaction
 * - Delete comment interaction
 * - Character count validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentSection } from '../CommentSection';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.confirm
global.confirm = vi.fn();

describe('CommentSection', () => {
  const mockFindingId = 'finding-123';
  const mockComments = [
    {
      id: 'comment-1',
      comment_text: 'This is a test comment',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      users: {
        id: 'user-1',
        username: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    },
    {
      id: 'comment-2',
      comment_text: 'Another comment',
      created_at: '2024-01-15T11:00:00Z',
      updated_at: '2024-01-15T11:30:00Z',
      users: {
        id: 'user-2',
        username: 'anotheruser',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<CommentSection findingId={mockFindingId} />);
      
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should render comments after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockComments }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('Comments (2)')).toBeInTheDocument();
      });

      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      expect(screen.getByText('Another comment')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('anotheruser')).toBeInTheDocument();
    });

    it('should show empty state when no comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('Comments (0)')).toBeInTheDocument();
      });

      expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
    });

    it('should show edited indicator for edited comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockComments }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('(edited)')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('Comments (0)')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('Comments (0)')).toBeInTheDocument();
      });
    });
  });

  describe('Add Comment Interaction', () => {
    it('should allow user to type in textarea', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'New comment text');

      expect(textarea).toHaveValue('New comment text');
    });

    it('should show character count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('0/5000 characters')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'Test');

      expect(screen.getByText('4/5000 characters')).toBeInTheDocument();
    });

    it('should disable submit button when textarea is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /add comment/i });
        expect(button).toBeDisabled();
      });
    });

    it('should enable submit button when textarea has text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'New comment');

      const button = screen.getByRole('button', { name: /add comment/i });
      expect(button).not.toBeDisabled();
    });

    it('should submit comment successfully', async () => {
      const newComment = {
        id: 'comment-3',
        comment_text: 'New comment',
        created_at: '2024-01-15T12:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
        users: {
          id: 'user-1',
          username: 'testuser',
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: newComment }),
        });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'New comment');

      const button = screen.getByRole('button', { name: /add comment/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('New comment')).toBeInTheDocument();
      });

      expect(textarea).toHaveValue('');
    });

    it('should show error when comment submission fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: 'Failed to add comment' }),
        });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'New comment');

      const button = screen.getByRole('button', { name: /add comment/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to add comment');
      });
    });

    it('should disable form during submission', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        })
        .mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'New comment');

      const button = screen.getByRole('button', { name: /add comment/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveTextContent('Adding...');
        expect(textarea).toBeDisabled();
      });
    });
  });

  describe('Delete Comment Interaction', () => {
    it('should show delete button for each comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockComments }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText('Delete comment');
        expect(deleteButtons).toHaveLength(2);
      });
    });

    it('should show confirmation dialog when delete is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockComments }),
      });

      (global.confirm as any).mockReturnValue(false);

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText('Delete comment');
      await userEvent.click(deleteButtons[0]);

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this comment?');
    });

    it('should delete comment when confirmed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      (global.confirm as any).mockReturnValue(true);

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText('Delete comment');
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('This is a test comment')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Comments (1)')).toBeInTheDocument();
    });

    it('should not delete comment when cancelled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockComments }),
      });

      (global.confirm as any).mockReturnValue(false);

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText('Delete comment');
      await userEvent.click(deleteButtons[0]);

      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      expect(screen.getByText('Comments (2)')).toBeInTheDocument();
    });

    it('should show error when delete fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: 'Failed to delete' }),
        });

      (global.confirm as any).mockReturnValue(true);

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText('Delete comment');
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete');
      });
    });
  });

  describe('API Integration', () => {
    it('should call correct API endpoint for fetching comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/findings/${mockFindingId}/comments`);
      });
    });

    it('should call correct API endpoint for adding comment', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: {} }),
        });

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await userEvent.type(textarea, 'Test comment');

      const button = screen.getByRole('button', { name: /add comment/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/findings/${mockFindingId}/comments`,
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ comment_text: 'Test comment' }),
          })
        );
      });
    });

    it('should call correct API endpoint for deleting comment', async () => {
      const commentId = 'comment-1';
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockComments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      (global.confirm as any).mockReturnValue(true);

      render(<CommentSection findingId={mockFindingId} />);

      await waitFor(() => {
        expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText('Delete comment');
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/comments/${commentId}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });
});
