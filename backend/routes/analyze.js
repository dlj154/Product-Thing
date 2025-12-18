const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST /api/analyze - Analyze interview transcript
router.post('/', async (req, res) => {
  try {
    const { transcript, features } = req.body;

    // Validation
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'transcript is required and must be a string'
      });
    }

    if (!features || typeof features !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'features is required and must be a string'
      });
    }

    // Check if transcript is too short
    if (transcript.trim().length < 10) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'transcript is too short'
      });
    }

    // Check API key is configured
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_claude_api_key_here') {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in .env file'
      });
    }

    console.log(`Analyzing transcript (${transcript.length} chars) with ${features.split('\n').length} features`);

    // Construct system prompt with instructions
    const systemPrompt = `You are an expert analyst specializing in extracting customer pain points from interview transcripts and mapping them to product features.

Your task is to:
1. Identify pain points that represent genuine customer problems, frustrations, or unmet needs
2. Extract contextually complete quotes that demonstrate each pain point
3. Map pain points to relevant features from the provided feature list
4. Synthesize findings into actionable summaries

## Pain Point Criteria

A pain point is:
- A current problem, inefficiency, or obstacle the customer faces
- An expressed frustration, complaint, or dissatisfaction
- An unmet need or desired capability
- A workaround the customer currently uses
- A mentioned time cost, financial cost, or resource constraint

## Quote Extraction Guidelines

- Use VERBATIM quotes from the transcript only - no paraphrasing
- Include preceding context (what led to the issue being discussed)
- Include the core statement about the pain point
- Include following context (impact, elaboration, or consequences)
- Include dialogue from ALL participants (customer, interviewer, etc.) if it adds context
- Include speaker labels (e.g., "Interviewer:", "Customer:") when multiple speakers are present
- Use ellipsis (…) to eliminate extraneous details from lengthy quotes
- Target length: 10-150 words
- Quotes must be self-contained and understandable without reading the full transcript

## Feature Mapping Guidelines

- Only map pain points that clearly relate to a feature in the provided list
- If a pain point doesn't clearly map to any feature, skip it
- Quotes may appear under multiple features if truly relevant, but prioritize only the strongest/most relevant feature mappings
- Use exact feature names from the provided list

## AI Summary Guidelines

For each feature:
- Synthesize themes across all pain points mapped to that feature
- Focus on actionable, product-oriented insights
- Highlight the intensity or frequency of the pain if evident
- Keep summaries concise (1-2 sentences)

## Output Format

Return ONLY valid JSON with no additional text or explanation. Follow this structure:

{
  "features": [
    {
      "featureName": "Exact feature name from the provided list",
      "aiSummary": "Concise synthesis of all pain points for this feature",
      "quotes": [
        {
          "quote": "Verbatim quote with context (10-150 words)",
          "painPoint": "Clear description of what pain point this quote represents"
        }
      ]
    }
  ]
}

## Example

Given transcript snippet:
"Interviewer: How do you currently track customer feedback? Customer: We use spreadsheets, but honestly it's a nightmare. Every time someone submits feedback through email, I have to manually copy it into our master sheet. It takes me about 2 hours every week just doing data entry, and I still miss things."

Given feature: "Automated Feedback Collection"

Expected output:
{
  "features": [
    {
      "featureName": "Automated Feedback Collection",
      "aiSummary": "Customers are spending significant time on manual data entry to consolidate feedback from multiple sources, leading to inefficiency and data loss.",
      "quotes": [
        {
          "quote": "Interviewer: How do you currently track customer feedback? Customer: We use spreadsheets, but honestly it's a nightmare. Every time someone submits feedback through email, I have to manually copy it into our master sheet. It takes me about 2 hours every week just doing data entry, and I still miss things.",
          "painPoint": "Manual data entry for feedback consolidation is time-consuming and error-prone"
        }
      ]
    }
  ]
}`;

    // Construct user message with data
    const userMessage = `INTERVIEW TRANSCRIPT:
${transcript}

FEATURE LIST:
${features}

Analyze this transcript and extract pain points mapped to features. Return only valid JSON.`;

    // Call Claude API with system and user messages
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userMessage
      }]
    });

    const content = message.content[0].text;
    console.log(`Received response from Claude (${content.length} chars)`);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from Claude response');
      return res.status(500).json({
        error: 'Analysis failed',
        message: 'Failed to parse API response - no valid JSON found'
      });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Validate analysis structure
    if (!analysis.features || !Array.isArray(analysis.features)) {
      return res.status(500).json({
        error: 'Analysis failed',
        message: 'Invalid analysis structure received'
      });
    }

    // Count total quotes across all features
    const totalQuotes = analysis.features.reduce((sum, feature) => sum + (feature.quotes?.length || 0), 0);
    console.log(`Successfully analyzed: found ${analysis.features.length} features with ${totalQuotes} total quotes`);

    res.json({
      success: true,
      analysis,
      metadata: {
        transcriptLength: transcript.length,
        featuresFound: analysis.features.length,
        quotesFound: totalQuotes,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);

    // Handle Anthropic API specific errors
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid Anthropic API key configuration'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message || 'Invalid request to Claude API'
      });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return res.status(500).json({
        error: 'Analysis failed',
        message: 'Failed to parse analysis results'
      });
    }

    // Generic error handler
    res.status(500).json({
      error: 'Analysis failed',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'An error occurred during analysis'
    });
  }
});

// GET /api/analyze/test - Test endpoint
router.get('/test', (req, res) => {
  res.json({
    message: 'Analyze API is working',
    endpoints: {
      analyze: 'POST /api/analyze - Analyze interview transcript'
    }
  });
});

module.exports = router;
