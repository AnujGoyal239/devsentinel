import { useEffect, useState, useRef } from 'react';

interface AgentLogEntry {
  stage: string;
  message: string;
  timestamp: string;
}

interface FixProgressState {
  status: 'queued' | 'sandboxing' | 'coding' | 'linting' | 'testing' | 'opening_pr' | 'complete' | 'failed' | null;
  logs: AgentLogEntry[];
  pr_url?: string;
  pr_number?: number;
  isComplete: boolean;
  error: string | null;
}

/**
 * React hook for streaming real-time fix progress via SSE
 * 
 * @param fixJobId - The fix job ID to stream progress for
 * @returns State object with status, logs, pr_url, isComplete, error
 * 
 * @example
 * const { status, logs, pr_url, isComplete, error } = useFixProgress(fixJobId);
 */
export function useFixProgress(fixJobId: string): FixProgressState {
  const [state, setState] = useState<FixProgressState>({
    status: null,
    logs: [],
    isComplete: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!fixJobId) return;

    const connectEventSource = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Establish EventSource connection
      const eventSource = new EventSource(`/api/stream/fix/${fixJobId}`);
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
          setState((prev) => ({
            status: data.status,
            logs: [...prev.logs, ...(data.logs || [])],
            pr_url: data.pr_url,
            pr_number: data.pr_number,
            isComplete: data.status === 'complete' || data.status === 'failed',
            error: data.error_message || null,
          }));

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
  }, [fixJobId]);

  return state;
}
