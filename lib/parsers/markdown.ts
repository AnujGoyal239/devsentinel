/**
 * Markdown Document Parser
 * 
 * Parses Markdown files and extracts text content using marked library
 */

import { marked } from 'marked';

export async function parseMarkdown(content: string): Promise<string> {
  try {
    // Parse markdown to HTML, then strip HTML tags to get plain text
    const html = await marked(content);
    // Remove HTML tags
    const text = html.replace(/<[^>]*>/g, '');
    // Decode HTML entities
    const decoded = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return decoded.trim();
  } catch (error) {
    throw new Error(`Failed to parse Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
