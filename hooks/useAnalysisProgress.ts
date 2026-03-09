import { useEffect, useState, useRef } from 'react';

interface AnalysisProgressState {
  status: 'queued' | 'running' | 'complete' | 'failed' | null;
  stage: string;
  progress: number;
  health_score?: number;
  isComplete: boolean;
  error: string | null;
}

/**
 * React hook for streaming real-time analysis progress via SSE
 * 
 * @param runId - The analysis run ID to stream progress for
 * @returns State object with status, stage, progress, isComplete, error
 * 
 * @example
 * const { status, stage, progress, isComplete, error } = useAnalysisProgress(runId);
 */
export function useAnalysisProgress(runId: string): AnalysisProgressState {
  const [state, setState] = useState<AnalysisProgressState>({
    status: null,
    stage: 'Initializing...',
    progress: 0,
    isComplete: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!runId) return;

    const connectEventSource = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Establish EventSource connection
      const eventSource = new EventSource(`/api/stream/${runId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle error in event data
          if (data.error) {
            setState((prev) => ({
              ...prev,
              error: data.error,
              isComplete: true,
            }));
            eventSource.close();
            return;
          }

          // Update state with progress data
          setState({
            status: data.status,
            stage: data.stage || 'Processing...',
            progress: data.progress || 0,
            health_score: data.health_score,
            isComplete: data.status === 'complete' || data.status === 'failed',
            error: data.error_message || null,
          });

          // Close connection if complete or failed
          if (data.status === 'complete' || data.status === 'failed') {
            eventSource.close();
            reconnectAttemptsRef.current = 0; // Reset reconnect attempts
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
          setState((prev) => ({
            ...prev,
            error: 'Failed to parse progress update',
          }));
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();

        // Implement reconnection logic with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          reconnectAttemptsRef.current += 1;

          console.log(
            `Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectEventSource();
          }, backoffDelay);
        } else {
          setState((prev) => ({
            ...prev,
            error: 'Connection lost. Please refresh the page.',
            isComplete: true,
          }));
        }
      };

      eventSource.onopen = () => {
        console.log('SSE connection established');
        reconnectAttemptsRef.current = 0; // Reset on successful connection
      };
    };

    connectEventSource();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [runId]);

  return state;
}
