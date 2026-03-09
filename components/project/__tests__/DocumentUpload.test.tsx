/**
 * Unit Tests for DocumentUpload Component
 * 
 * Tests:
 * - Component rendering
 * - File selection via input
 * - Drag and drop interaction
 * - File validation (type and size)
 * - Upload functionality
 * - Success and error states
 * - Loading states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentUpload } from '../DocumentUpload';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DocumentUpload', () => {
  const mockProjectId = 'project-123';
  const mockOnUploadComplete = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render upload component', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      expect(screen.getByText('Upload PRD Document')).toBeInTheDocument();
    });

    it('should display description', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      expect(screen.getByText(/Upload a Product Requirements Document/i)).toBeInTheDocument();
    });

    it('should show drag and drop zone', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      expect(screen.getByText(/Drag and drop your PRD document here/i)).toBeInTheDocument();
    });

    it('should display accepted file types', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      expect(screen.getByText(/Supports PDF, DOCX, and Markdown/i)).toBeInTheDocument();
    });

    it('should show close button when onClose is provided', () => {
      render(<DocumentUpload projectId={mockProjectId} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: '' });
      expect(closeButton).toBeInTheDocument();
    });

    it('should not show close button when onClose is not provided', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1); // Only upload button
    });
  });

  describe('File Selection', () => {
    it('should allow file selection via input', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('should display file size', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText(/MB/)).toBeInTheDocument();
      });
    });

    it('should show file icon when file is selected', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('should allow changing selected file', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file1 = new File(['test content'], 'test1.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file1);
      
      await waitFor(() => {
        expect(screen.getByText('test1.pdf')).toBeInTheDocument();
      });
      
      const changeButton = screen.getByText('Choose Different File');
      await userEvent.click(changeButton);
      
      expect(screen.queryByText('test1.pdf')).not.toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over event', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const dropZone = screen.getByText(/Drag and drop/i).closest('div');
      
      fireEvent.dragOver(dropZone!);
      
      expect(dropZone).toHaveClass('border-primary');
    });

    it('should handle drag leave event', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const dropZone = screen.getByText(/Drag and drop/i).closest('div');
      
      fireEvent.dragOver(dropZone!);
      fireEvent.dragLeave(dropZone!);
      
      expect(dropZone).not.toHaveClass('border-primary');
    });

    it('should handle file drop', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const dropZone = screen.getByText(/Drag and drop/i).closest('div');
      
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        types: ['Files'],
      };
      
      fireEvent.drop(dropZone!, { dataTransfer });
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('File Validation', () => {
    it('should accept PDF files', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
      
      expect(screen.queryByText(/Invalid file type/i)).not.toBeInTheDocument();
    });

    it('should accept DOCX files', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.docx')).toBeInTheDocument();
      });
    });

    it('should accept Markdown files', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.md', { type: 'text/markdown' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument();
      });
    });

    it('should reject invalid file types', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });
    });

    it('should reject files larger than 10MB', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText(/File size exceeds 10MB limit/i)).toBeInTheDocument();
      });
    });

    it('should accept files under 10MB', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const content = 'x'.repeat(5 * 1024 * 1024); // 5MB
      const file = new File([content], 'valid.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('valid.pdf')).toBeInTheDocument();
      });
      
      expect(screen.queryByText(/File size exceeds/i)).not.toBeInTheDocument();
    });
  });

  describe('Upload Functionality', () => {
    it('should disable upload button when no file selected', () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      expect(uploadButton).toBeDisabled();
    });

    it('should enable upload button when file is selected', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload document/i });
        expect(uploadButton).not.toBeDisabled();
      });
    });

    it('should upload file successfully', async () => {
      const mockResponse = {
        document: { filename: 'test.pdf' },
        requirements_count: 5,
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      render(<DocumentUpload projectId={mockProjectId} onUploadComplete={mockOnUploadComplete} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Document uploaded successfully/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/Extracted 5 requirements/i)).toBeInTheDocument();
    });

    it('should show loading state during upload', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Uploading and Processing/i)).toBeInTheDocument();
      });
    });

    it('should disable form during upload', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(uploadButton).toBeDisabled();
      });
    });

    it('should call onUploadComplete after successful upload', async () => {
      vi.useFakeTimers();
      
      const mockResponse = {
        document: { filename: 'test.pdf' },
        requirements_count: 5,
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      
      render(<DocumentUpload projectId={mockProjectId} onUploadComplete={mockOnUploadComplete} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Document uploaded successfully/i)).toBeInTheDocument();
      });
      
      vi.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(mockOnUploadComplete).toHaveBeenCalled();
      });
      
      vi.useRealTimers();
    });

    it('should show error message on upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' }),
      });
      
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      render(<DocumentUpload projectId={mockProjectId} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: '' });
      await userEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    it('should call correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ document: {}, requirements_count: 0 }),
      });
      
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/projects/${mockProjectId}/documents`,
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should send file in FormData', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ document: {}, requirements_count: 0 }),
      });
      
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[1].body).toBeInstanceOf(FormData);
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset form after choosing different file', async () => {
      render(<DocumentUpload projectId={mockProjectId} />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      await userEvent.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
      
      const changeButton = screen.getByText('Choose Different File');
      await userEvent.click(changeButton);
      
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
      expect(screen.getByText(/Drag and drop/i)).toBeInTheDocument();
    });
  });
});
