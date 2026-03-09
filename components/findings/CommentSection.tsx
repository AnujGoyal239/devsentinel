/**
 * Comment Section Component
 * 
 * Displays comments on a finding and allows adding new comments
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface CommentSectionProps {
  findingId: string;
}

export function CommentSection({ findingId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch comments
  useEffect(() => {
    async function fetchComments() {
      try {
        const response = await fetch(`/api/findings/${findingId}/comments`);
        const data = await response.json();

        if (data.success) {
          setComments(data.data);
        } else {
          setError('Failed to load comments');
        }
      } catch (err) {
        setError('Error loading comments');
      } finally {
        setLoading(false);
      }
    }

    fetchComments();
  }, [findingId]);

  // Add comment
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();

    if (!newComment.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/findings/${findingId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_text: newComment,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setComments([...comments, data.data]);
        setNewComment('');
      } else {
        setError(data.error || 'Failed to add comment');
      }
    } catch (err) {
      setError('Error adding comment');
    } finally {
      setSubmitting(false);
    }
  }

  // Delete comment
  async function handleDeleteComment(commentId: string) {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setComments(comments.filter(c => c.id !== commentId));
      } else {
        setError(data.error || 'Failed to delete comment');
      }
    } catch (err) {
      setError('Error deleting comment');
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">
        Comments ({comments.length})
      </h3>

      {/* Comments list */}
      <div className="space-y-4 mb-4">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">
                    {comment.users.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString()} at{' '}
                    {new Date(comment.created_at).toLocaleTimeString()}
                  </span>
                  {comment.updated_at !== comment.created_at && (
                    <span className="text-xs text-gray-400">(edited)</span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                  aria-label="Delete comment"
                >
                  Delete
                </button>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {comment.comment_text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleAddComment} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          maxLength={5000}
          disabled={submitting}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {newComment.length}/5000 characters
          </span>
          <Button
            type="submit"
            disabled={submitting || !newComment.trim()}
            size="sm"
          >
            {submitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </form>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
