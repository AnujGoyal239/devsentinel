/**
 * Groq AI Client
 * 
 * Unified client for all AI operations using Groq's LLM API
 * Replaces both Gemini (analysis) and Claude (fix agent)
 */

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

if (!process.env.GROQ_API_KEY) {
  console.warn('GROQ_API_KEY not set. AI operations will fail.');
}

/**
 * AI API Error Types
 */
export class AIApiError extends Error {
  constructor(
    message: string,
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
 * Extract requirements from PRD text using Groq
 * 
 * @param prdText - PRD document text content
 * @returns Array of extracted requirements
 * @throws AIApiError if Groq fails
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
  } catch (error) {
    console.error('[Groq] Failed to extract requirements:', error);
    
    const isRateLimit = error instanceof Error && 
      (error.message.includes('quota') || error.message.includes('rate limit'));
    
    throw new AIApiError(
      'Failed to extract requirements from PRD using Groq API.',
      isRateLimit
    );
  }
}

/**
 * Generate AI completion using Groq
 * Used for analysis pipeline (all 4 passes)
 * 
 * @param prompt - The prompt to send to the AI
 * @param temperature - Temperature for generation (default: 0.0 for deterministic output)
 * @returns Generated text response
 */
export async function generateCompletion(
  prompt: string,
  temperature: number = 0.0
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.1-70b-versatile',
      temperature,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('[Groq] Failed to generate completion:', error);
    
    const isRateLimit = error instanceof Error && 
      (error.message.includes('quota') || error.message.includes('rate limit'));
    
    throw new AIApiError(
      'Failed to generate AI completion using Groq API.',
      isRateLimit
    );
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
    console.error('[Groq] Failed to parse requirements JSON:', error);
    throw new AIApiError(
      'Failed to parse requirements from AI response',
      false
    );
  }
}

export { groq };
