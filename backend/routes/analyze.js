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

    // Construct prompt for Claude
    const prompt = `You are analyzing a customer interview transcript to extract pain points and map them to potential product features.

INTERVIEW TRANSCRIPT:
${transcript}

FEATURE LIST:
${features}

Please analyze this transcript and provide:

1. Extract all pain points mentioned by the customer (problems, frustrations, difficulties, needs)
2. For each pain point, provide a direct quote from the transcript that demonstrates it
3. Map each pain point to one or more relevant features from the feature list
4. Group the results by feature, with each feature having:
   - An AI-generated summary that synthesizes all the pain points mapped to that feature
   - All the quotes associated with those pain points

Return your analysis in the following JSON format:
{
  "features": [
    {
      "featureName": "Feature name from the feature list",
      "aiSummary": "A concise summary (1-2 sentences) synthesizing all pain points for this feature",
      "quotes": [
        {
          "quote": "Exact quote from transcript",
          "painPoint": "Description of the pain point this quote represents"
        }
      ]
    }
  ]
}

Be thorough and extract all pain points, even subtle ones. Make sure quotes are exact excerpts from the transcript. Each feature should appear only once, with all relevant quotes grouped under it.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
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
