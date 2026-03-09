/**
 * DOCX Document Parser
 * 
 * Parses DOCX files and extracts text content using mammoth library
 */

import mammoth from 'mammoth';

export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
