/**
 * Document Parser Index
 * 
 * Exports all document parsers and provides a unified parsing interface
 */

import { parsePDF } from './pdf';
import { parseDOCX } from './docx';
import { parseMarkdown } from './markdown';

export { parsePDF, parseDOCX, parseMarkdown };

export type FileType = 'pdf' | 'docx' | 'md';

/**
 * Parse document based on file type
 */
export async function parseDocument(
  buffer: Buffer,
  fileType: FileType
): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseDOCX(buffer);
    case 'md':
      return parseMarkdown(buffer.toString('utf-8'));
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
