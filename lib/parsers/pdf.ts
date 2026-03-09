/**
 * PDF Document Parser
 * 
 * Parses PDF files and extracts text content using pdf-parse library
 */

import * as pdfParse from 'pdf-parse';

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
