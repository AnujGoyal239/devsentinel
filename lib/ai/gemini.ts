/**
 * Gemini AI Client
 * 
 * Provides Gemini Flash API integration for requirement extraction
 * with automatic fallback to Groq on failures
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

/**
 * AI API Error Types
 */
export class AIApiError extends Error {
  constructor(
    message: string,
    public provider: 'gemini' | 'groq',
    public isRateLimit: boolean = false
  ) {
    super(message);
    this.name = 'AIApiError';
  }
}

export interface ExtractedRequirement {
  category: 'feature' | 'endpoint' | 'acceptance_criteria' | 'edge_case';
  feature_name: string;
  description?: string;
  endpoint?: string;
  expected_behavior?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Extract requirements from PRD text using Gemini Flash with Groq fallback
 * 
 * @param prdText - PRD document text content
 * @returns Array of extracted requirements
 * @throws AIApiError if both Gemini and Groq fail
 */
export async function extractRequirements(
  prdText: string
): Promise<ExtractedRequirement[]> {
  const prompt = `You are an expert at analyzing Product Requirements Documents (PRDs) and extracting structured requirements.

Analyze the following PRD text and extract all requirements. For each requirement, identify:
- category: One of "feature", "endpoint", "acceptance_criteria", or "edge_case"
- feature_name: A concise name for the feature or requirement
- description: A brief description of the requirement (optional)
- endpoint: The API endpoint if applicable (e.g., "POST /api/auth/login")
- expected_behavior: What the system should do
- priority: One of "high", "medium", or "low"

Return the results as a JSON array of requirements. Each requirement should be a separate object.

PRD Text:
${prdText}

Return ONLY valid JSON in this format:
[
  {
    "category": "feature",
    "feature_name": "User Authentication",
    "description": "Allow users to sign in with GitHub",
    "endpoint": "POST /api/auth/login",
    "expected_behavior": "User should be redirected to GitHub OAuth and then back to the app",
    "priority": "high"
  }
]`;

  // Try Gemini first
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return parseRequirementsJson(text);
  } catch (error) {
    console.error('[Gemini] Failed to extract requirements:', error);
    
    // Check if it's a rate limit error
    const isRateLimit = error instanceof Error && 
      (error.message.includes('quota') || error.message.includes('rate limit'));

    // Fallback to Groq
    console.log('[AI] Falling back to Groq...');
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'llama-3.1-70b-versatile',
        temperature: 0,
      });

      const text = completion.choices[0]?.message?.content || '';
      return parseRequirementsJson(text);
    } catch (groqError) {
      console.error('[Groq] Failed to extract requirements:', groqError);
      throw new AIApiError(
        'Failed to extract requirements from PRD. Both Gemini and Groq APIs failed.',
        'groq',
        false
      );
    }
  }
}

/**
 * Parse requirements JSON from AI response
 * Handles markdown code blocks and extracts JSON
 */
function parseRequirementsJson(text: string): ExtractedRequirement[] {
  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const requirements = JSON.parse(jsonText) as ExtractedRequirement[];
    return requirements;
  } catch (error) {
    console.error('[AI] Failed to parse requirements JSON:', error);
    throw new AIApiError(
      'Failed to parse requirements from AI response',
      'gemini',
      false
    );
  }
}
