/**
 * Unit Tests for HealthScoreTrendChart Component
 * 
 * Tests:
 * - Component rendering
 * - Loading state
 * - Error state
 * - Empty state (no historical data)
 * - Chart rendering with data
 * - Color coding based on health score
 * - API integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HealthScoreTrendChart } from '../HealthScoreTrendChart';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HealthScoreTrendChart', () => {
  const mockProjectId = 'project-123';
  const mockTrendData = [
    {
      run_id: 'run-1',
      created_at: '2024-01-10T10:00:00Z',
      health_score: 45,
      total_findings: 20,
    },
    {
      run_id: 'run-2',
      created_at: '2024-01-11T10:00:00Z',
      health_score: 60,
      total_findings: 15,
    },
    {
      run_id: 'run-3',
      created_at: '2024-01-12T10:00:00Z',
      health_score: 75,
      total_findings: 10,
    },
    {
      run_id: 'run-4',
      created_at: '2024-01-13T10:00:00Z',
      health_score: 85,
      total_findings: 5,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<HealthScoreTrendChart projectId={mockProjectId} />);
      
      // Check for loading skeleton
      const card = screen.getByRole('generic');
      expect(card).toBeInTheDocument();
    });

    it('should render chart after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Health Score Trend')).toBeInTheDocument();
      });

      expect(screen.getByText(/Latest:/)).toBeInTheDocument();
      expect(screen.getByText(/Total Runs:/)).toBeInTheDocument();
    });

    it('should display latest health score', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('85.0')).toBeInTheDocument();
      });
    });

    it('should display total runs count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load trend data')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Error loading trend data')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show message when no historical data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('No historical data available')).toBeInTheDocument();
      });
    });
  });

  describe('Chart Rendering', () => {
    it('should render SVG chart with data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });

    it('should render grid lines', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBeGreaterThan(0);
      });
    });

    it('should render data points as circles', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const circles = container.querySelectorAll('circle');
        expect(circles).toHaveLength(4);
      });
    });

    it('should render line path connecting points', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const path = container.querySelector('path');
        expect(path).toBeInTheDocument();
        expect(path?.getAttribute('d')).toContain('M');
        expect(path?.getAttribute('d')).toContain('L');
      });
    });

    it('should render axis labels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const texts = container.querySelectorAll('text');
        expect(texts.length).toBeGreaterThan(0);
      });
    });

    it('should show tooltips on data points', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const titles = container.querySelectorAll('title');
        expect(titles.length).toBe(4);
      });
    });
  });

  describe('Color Coding', () => {
    it('should use green color for high scores (>=80)', async () => {
      const highScoreData = [
        {
          run_id: 'run-1',
          created_at: '2024-01-10T10:00:00Z',
          health_score: 85,
          total_findings: 5,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: highScoreData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const path = container.querySelector('path');
        expect(path?.getAttribute('stroke')).toBe('#10b981'); // green
      });
    });

    it('should use yellow color for medium scores (50-79)', async () => {
      const mediumScoreData = [
        {
          run_id: 'run-1',
          created_at: '2024-01-10T10:00:00Z',
          health_score: 65,
          total_findings: 10,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mediumScoreData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const path = container.querySelector('path');
        expect(path?.getAttribute('stroke')).toBe('#f59e0b'); // yellow
      });
    });

    it('should use red color for low scores (<50)', async () => {
      const lowScoreData = [
        {
          run_id: 'run-1',
          created_at: '2024-01-10T10:00:00Z',
          health_score: 35,
          total_findings: 20,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: lowScoreData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const path = container.querySelector('path');
        expect(path?.getAttribute('stroke')).toBe('#ef4444'); // red
      });
    });
  });

  describe('API Integration', () => {
    it('should call correct API endpoint with default limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/projects/${mockProjectId}/history?action=trend&limit=10`
        );
      });
    });

    it('should call API endpoint with custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<HealthScoreTrendChart projectId={mockProjectId} limit={20} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/projects/${mockProjectId}/history?action=trend&limit=20`
        );
      });
    });

    it('should refetch when projectId changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const { rerender } = render(<HealthScoreTrendChart projectId="project-1" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/project-1/history?action=trend&limit=10'
        );
      });

      rerender(<HealthScoreTrendChart projectId="project-2" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/project-2/history?action=trend&limit=10'
        );
      });
    });
  });

  describe('Data Visualization', () => {
    it('should handle single data point', async () => {
      const singlePoint = [
        {
          run_id: 'run-1',
          created_at: '2024-01-10T10:00:00Z',
          health_score: 75,
          total_findings: 10,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: singlePoint }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const circles = container.querySelectorAll('circle');
        expect(circles).toHaveLength(1);
      });
    });

    it('should handle multiple data points', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const circles = container.querySelectorAll('circle');
        expect(circles).toHaveLength(4);
      });
    });

    it('should format dates correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendData }),
      });

      const { container } = render(<HealthScoreTrendChart projectId={mockProjectId} />);

      await waitFor(() => {
        const texts = Array.from(container.querySelectorAll('text'));
        const dateTexts = texts.filter(t => t.textContent?.includes('Jan'));
        expect(dateTexts.length).toBeGreaterThan(0);
      });
    });
  });
});
