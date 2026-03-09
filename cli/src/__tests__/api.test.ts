import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import { DevSentinelAPI } from '../api';
import type { CLIConfig } from '../types';

vi.mock('axios');

describe('DevSentinelAPI', () => {
  const mockConfig: CLIConfig = {
    apiKey: 'ds_test_key_123',
    apiUrl: 'https://api.test.com',
    verbose: false,
  };

  let api: DevSentinelAPI;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
    };
    
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance);
    vi.mocked(axios.isAxiosError).mockImplementation((error: any) => {
      return error && error.isAxiosError === true;
    });
    
    api = new DevSentinelAPI(mockConfig);
  });

  describe('triggerAnalysis', () => {
    it('should trigger analysis successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'run_123',
            project_id: 'proj_456',
            status: 'queued',
            health_score: null,
            current_stage: null,
            current_progress: 0,
            error_message: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await api.triggerAnalysis('proj_456');

      expect(result.data.id).toBe('run_123');
      expect(result.data.status).toBe('queued');
    });

    it('should handle 401 authentication error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: 'Invalid API key' },
        },
        message: 'Unauthorized',
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(api.triggerAnalysis('proj_456')).rejects.toThrow(
        'Authentication failed. Please check your API key.'
      );
    });

    it('should handle 404 not found error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: 'Project not found' },
        },
        message: 'Not Found',
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(api.triggerAnalysis('proj_456')).rejects.toThrow(
        'Resource not found. Please check the project ID or run ID.'
      );
    });

    it('should handle 429 rate limit error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: { error: 'Too many requests' },
        },
        message: 'Too Many Requests',
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(api.triggerAnalysis('proj_456')).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );
    });
  });

  describe('getAnalysisRun', () => {
    it('should get analysis run successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'run_123',
            project_id: 'proj_456',
            status: 'complete',
            health_score: 85,
            current_stage: 'Complete',
            current_progress: 100,
            error_message: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await api.getAnalysisRun('run_123');

      expect(result.data.id).toBe('run_123');
      expect(result.data.status).toBe('complete');
      expect(result.data.health_score).toBe(85);
    });
  });

  describe('getProject', () => {
    it('should get project successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'proj_456',
            name: 'Test Project',
            repo_url: 'https://github.com/test/repo',
            status: 'idle',
            health_score: 85,
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await api.getProject('proj_456');

      expect(result.data.id).toBe('proj_456');
      expect(result.data.name).toBe('Test Project');
    });
  });
});
