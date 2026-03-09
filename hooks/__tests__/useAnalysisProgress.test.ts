/**
 * Tests for useAnalysisProgress hook
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAnalysisProgress } from '../useAnalysisProgress';

// Mock EventSource
class MockEventSource {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState: number = 0;

  constructor(url: string) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 0);
  }

  close() {
    this.readyState = 2;
  }

  // Helper method to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
      });
      this.onmessage(event);
    }
  }

  // Helper method to simulate an error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

describe('useAnalysisProgress', () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock EventSource globally
    global.EventSource = vi.fn((url: string) => {
      mockEventSource = new MockEventSource(url);
      return mockEventSource as any;
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAnalysisProgress('test-run-id'));

    expect(result.current.status).toBeNull();
    expect(result.current.stage).toBe('Initializing...');
    expect(result.current.progress).toBe(0);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should establish EventSource connection with correct URL', () => {
    renderHook(() => useAnalysisProgress('test-run-id'));

    expect(global.EventSource).toHaveBeenCalledWith('/api/stream/test-run-id');
  });

  it('should update state when receiving progress events', async () => {
    const { result } = renderHook(() => useAnalysisProgress('test-run-id'));

    // Simulate receiving a progress update
    await waitFor(() => {
      mockEventSource.simulateMessage({
        status: 'running',
        stage: 'Understanding codebase',
        progress: 25,
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('running');
      expect(result.current.stage).toBe('Understanding codebase');
      expect(result.current.progress).toBe(25);
      expect(result.current.isComplete).toBe(false);
    });
  });

  it('should mark as complete when status is "complete"', async () => {
    const { result } = renderHook(() => useAnalysisProgress('test-run-id'));

    await waitFor(() => {
      mockEventSource.simulateMessage({
        status: 'complete',
        stage: 'Analysis complete',
        progress: 100,
        health_score: 85,
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('complete');
      expect(result.current.progress).toBe(100);
      expect(result.current.health_score).toBe(85);
      expect(result.current.isComplete).toBe(true);
    });
  });

  it('should mark as complete when status is "failed"', async () => {
    const { result } = renderHook(() => useAnalysisProgress('test-run-id'));

    await waitFor(() => {
      mockEventSource.simulateMessage({
        status: 'failed',
        stage: 'Analysis failed',
        progress: 50,
        error_message: 'Something went wrong',
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.isComplete).toBe(true);
      expect(result.current.error).toBe('Something went wrong');
    });
  });

  it('should handle error events in SSE stream', async () => {
    const { result } = renderHook(() => useAnalysisProgress('test-run-id'));

    await waitFor(() => {
      mockEventSource.simulateMessage({
        error: 'Failed to fetch analysis status',
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch analysis status');
      expect(result.current.isComplete).toBe(true);
    });
  });

  it('should close EventSource on unmount', () => {
    const { unmount } = renderHook(() => useAnalysisProgress('test-run-id'));

    const closeSpy = vi.spyOn(mockEventSource, 'close');
    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should not establish connection if runId is empty', () => {
    renderHook(() => useAnalysisProgress(''));

    expect(global.EventSource).not.toHaveBeenCalled();
  });

  it('should handle multiple progress updates', async () => {
    const { result } = renderHook(() => useAnalysisProgress('test-run-id'));

    // First update
    await waitFor(() => {
      mockEventSource.simulateMessage({
        status: 'running',
        stage: 'Pass 1',
        progress: 10,
      });
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(10);
    });

    // Second update
    await waitFor(() => {
      mockEventSource.simulateMessage({
        status: 'running',
        stage: 'Pass 2',
        progress: 50,
      });
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(50);
      expect(result.current.stage).toBe('Pass 2');
    });

    // Final update
    await waitFor(() => {
      mockEventSource.simulateMessage({
        status: 'complete',
        stage: 'Complete',
        progress: 100,
        health_score: 90,
      });
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(100);
      expect(result.current.isComplete).toBe(true);
      expect(result.current.health_score).toBe(90);
    });
  });
});
