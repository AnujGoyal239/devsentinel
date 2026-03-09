/**
 * DiffViewer Component
 * 
 * Displays side-by-side or unified diff view with syntax highlighting.
 * Shows original code vs fixed code with highlighted changes.
 */

'use client';

import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
  language?: string;
  splitView?: boolean;
}

export function DiffViewer({ 
  oldCode, 
  newCode, 
  language = 'typescript',
  splitView = true 
}: DiffViewerProps) {
  // Custom styles for the diff viewer
  const customStyles = {
    variables: {
      light: {
        diffViewerBackground: '#fff',
        diffViewerColor: '#212529',
        addedBackground: '#e6ffed',
        addedColor: '#24292e',
        removedBackground: '#ffeef0',
        removedColor: '#24292e',
        wordAddedBackground: '#acf2bd',
        wordRemovedBackground: '#fdb8c0',
        addedGutterBackground: '#cdffd8',
        removedGutterBackground: '#ffdce0',
        gutterBackground: '#f7f7f7',
        gutterBackgroundDark: '#f3f1f1',
        highlightBackground: '#fffbdd',
        highlightGutterBackground: '#fff5b1',
      },
    },
    line: {
      padding: '10px 2px',
      fontSize: '0.875rem',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    gutter: {
      padding: '0 8px',
      minWidth: '50px',
      fontSize: '0.75rem',
    },
    marker: {
      padding: '0 8px',
    },
    content: {
      width: '100%',
    },
  };

  return (
    <div className="rounded-lg overflow-hidden border">
      <ReactDiffViewer
        oldValue={oldCode}
        newValue={newCode}
        splitView={splitView}
        compareMethod={DiffMethod.WORDS}
        leftTitle="Original Code"
        rightTitle="Fixed Code"
        styles={customStyles}
        useDarkTheme={false}
        hideLineNumbers={false}
        showDiffOnly={false}
      />
    </div>
  );
}
