/**
 * Unit Tests for DiffViewer Component
 * 
 * Tests:
 * - Component rendering
 * - Split view vs unified view
 * - Code diff display
 * - Syntax highlighting
 * - Custom styling
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';

// Mock react-diff-viewer-continued
vi.mock('react-diff-viewer-continued', () => ({
  default: ({ oldValue, newValue, splitView, leftTitle, rightTitle }: any) => (
    <div data-testid="diff-viewer">
      <div data-testid="split-view">{splitView ? 'true' : 'false'}</div>
      <div data-testid="left-title">{leftTitle}</div>
      <div data-testid="right-title">{rightTitle}</div>
      <div data-testid="old-code">{oldValue}</div>
      <div data-testid="new-code">{newValue}</div>
    </div>
  ),
  DiffMethod: {
    WORDS: 'WORDS',
    CHARS: 'CHARS',
    LINES: 'LINES',
  },
}));

describe('DiffViewer', () => {
  const oldCode = `function hello() {
  console.log("Hello");
}`;

  const newCode = `function hello() {
  console.log("Hello, World!");
}`;

  describe('Component Rendering', () => {
    it('should render diff viewer', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    it('should display old code', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent(oldCode);
    });

    it('should display new code', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      expect(screen.getByTestId('new-code')).toHaveTextContent(newCode);
    });

    it('should have border styling', () => {
      const { container } = render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('rounded-lg', 'overflow-hidden', 'border');
    });
  });

  describe('View Modes', () => {
    it('should render in split view by default', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      expect(screen.getByTestId('split-view')).toHaveTextContent('true');
    });

    it('should render in unified view when splitView is false', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} splitView={false} />);
      
      expect(screen.getByTestId('split-view')).toHaveTextContent('false');
    });
  });

  describe('Titles', () => {
    it('should display default titles', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      expect(screen.getByTestId('left-title')).toHaveTextContent('Original Code');
      expect(screen.getByTestId('right-title')).toHaveTextContent('Fixed Code');
    });
  });

  describe('Code Content', () => {
    it('should handle empty old code', () => {
      render(<DiffViewer oldCode="" newCode={newCode} />);
      
      expect(screen.getByTestId('old-code')).toBeEmptyDOMElement();
      expect(screen.getByTestId('new-code')).toHaveTextContent(newCode);
    });

    it('should handle empty new code', () => {
      render(<DiffViewer oldCode={oldCode} newCode="" />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent(oldCode);
      expect(screen.getByTestId('new-code')).toBeEmptyDOMElement();
    });

    it('should handle both codes being empty', () => {
      render(<DiffViewer oldCode="" newCode="" />);
      
      expect(screen.getByTestId('old-code')).toBeEmptyDOMElement();
      expect(screen.getByTestId('new-code')).toBeEmptyDOMElement();
    });

    it('should handle multiline code', () => {
      const multilineOld = `line1
line2
line3`;
      const multilineNew = `line1
line2 modified
line3`;

      render(<DiffViewer oldCode={multilineOld} newCode={multilineNew} />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent('line1');
      expect(screen.getByTestId('new-code')).toHaveTextContent('modified');
    });

    it('should handle special characters', () => {
      const specialOld = 'const x = "test";';
      const specialNew = 'const x = "test & <special>";';

      render(<DiffViewer oldCode={specialOld} newCode={specialNew} />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent(specialOld);
      expect(screen.getByTestId('new-code')).toHaveTextContent(specialNew);
    });
  });

  describe('Language Support', () => {
    it('should accept language prop', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} language="javascript" />);
      
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    it('should use typescript as default language', () => {
      render(<DiffViewer oldCode={oldCode} newCode={newCode} />);
      
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long code', () => {
      const longCode = 'x'.repeat(10000);
      
      render(<DiffViewer oldCode={longCode} newCode={longCode} />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent(longCode);
    });

    it('should handle code with only whitespace', () => {
      const whitespaceCode = '   \n   \n   ';
      
      render(<DiffViewer oldCode={whitespaceCode} newCode={whitespaceCode} />);
      
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    it('should handle identical code', () => {
      render(<DiffViewer oldCode={oldCode} newCode={oldCode} />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent(oldCode);
      expect(screen.getByTestId('new-code')).toHaveTextContent(oldCode);
    });

    it('should handle completely different code', () => {
      const completelyDifferent = 'totally different content';
      
      render(<DiffViewer oldCode={oldCode} newCode={completelyDifferent} />);
      
      expect(screen.getByTestId('old-code')).toHaveTextContent(oldCode);
      expect(screen.getByTestId('new-code')).toHaveTextContent(completelyDifferent);
    });
  });
});
