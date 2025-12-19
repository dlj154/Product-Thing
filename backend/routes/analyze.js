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
2. Extract ONE comprehensive quote per pain point that includes all related dialogue exchanges
3. Map pain points to relevant features from the provided feature list
4. Suggest NEW features for pain points that don't map to existing features
5. Synthesize findings into actionable summaries

## Pain Point Criteria

A pain point is:
- A current problem, inefficiency, or obstacle the customer faces
- An expressed frustration, complaint, or dissatisfaction
- An unmet need or desired capability
- A workaround the customer currently uses
- A mentioned time cost, financial cost, or resource constraint

## Quote Extraction Guidelines

- Use VERBATIM quotes from the transcript only - no paraphrasing
- **CRITICAL: Consolidate related exchanges into ONE quote** - If multiple back-and-forth exchanges discuss the same pain point, combine them into a single quote rather than creating separate quotes
- Include preceding context (what led to the issue being discussed)
- Include the core statement about the pain point
- Include following context (impact, elaboration, or consequences)
- Include dialogue from ALL participants (customer, interviewer, etc.) when they discuss the same pain point
- Include speaker labels (e.g., "Interviewer:", "Customer:") when multiple speakers are present
- Use ellipsis (…) to eliminate extraneous details from lengthy quotes or to skip unrelated tangents between related exchanges
- Target length: 10-150 words (longer is acceptable if the conversation naturally extends across multiple exchanges about the same pain point)
- Quotes must be self-contained and understandable without reading the full transcript
- Each feature should typically have 1-3 quotes maximum, with each quote covering a distinct pain point

## Feature Mapping Guidelines

- Only map pain points that clearly relate to a feature in the provided list
- The feature list may include both user-defined features and AI-suggested features from previous transcripts
- If a pain point doesn't clearly map to any feature, skip it
- Quotes may appear under multiple features if truly relevant, but prioritize only the strongest/most relevant feature mappings
- Use exact feature names from the provided list

## AI Summary Guidelines

For each feature:
- Synthesize themes across all pain points mapped to that feature
- Focus on actionable, product-oriented insights
- Highlight the intensity or frequency of the pain if evident
- Keep summaries concise (1-2 sentences)

## New Feature Suggestion Guidelines

For pain points that don't map to existing features:
- Suggest a NEW feature that would address the pain point
- Give the feature a clear, descriptive name (2-5 words)
- Ensure the suggested feature is genuinely NEW and not in the provided feature list
- Avoid suggesting minor variations of existing features
- Focus on features that would have meaningful impact based on the pain points
- Follow the same quote extraction and AI summary guidelines as existing features

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
  ],
  "newFeatureSuggestions": [
    {
      "featureName": "New feature name (2-5 words, NOT in the provided feature list)",
      "aiSummary": "Concise explanation of why this feature is needed based on pain points",
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
"Maya: What's stopping you from doing that today? Chris: User management, mainly. We need better authentication and permissions. We're a big company, so SSO is basically table stakes. Also, not everyone should be able to edit everything. Maya: What kind of permissions would you want? Chris: Admins who manage integrations, editors who can tag and map insights, and viewers who can just see trends and evidence. Without that, I can't responsibly open it up. Maya: Is security or compliance part of the concern as well? Chris: Yes, especially when calls include sensitive customer info. Leadership will ask those questions immediately. Maya: How do you currently share insights from calls? Chris: We're stuck taking screenshots and pasting them into Slack or email. It's tedious, and you lose all the context. Maya: What would make that easier? Chris: Some kind of direct integration where I could push key findings straight to our team channels without all the copy-paste work."

Given feature list: "Manager Users"

Expected output:
{
  "features": [
    {
      "featureName": "Manager Users",
      "aiSummary": "Lack of proper user management and permission controls prevents broader organizational rollout, as companies cannot safely grant access without role-based permissions for admins, editors, and viewers.",
      "quotes": [
        {
          "quote": "Maya: What's stopping you from doing that today? Chris: User management, mainly. We need better authentication and permissions. We're a big company, so SSO is basically table stakes. Also, not everyone should be able to edit everything. Maya: What kind of permissions would you want? Chris: Admins who manage integrations, editors who can tag and map insights, and viewers who can just see trends and evidence. Without that, I can't responsibly open it up. Maya: Is security or compliance part of the concern as well? Chris: Yes, especially when calls include sensitive customer info. Leadership will ask those questions immediately.",
          "painPoint": "Lack of role-based access controls and SSO prevents safe organizational rollout"
        }
      ]
    }
  ],
  "newFeatureSuggestions": [
    {
      "featureName": "Slack Integration",
      "aiSummary": "Users waste time manually copying insights via screenshots and lose important context when sharing findings with their teams through current methods.",
      "quotes": [
        {
          "quote": "Maya: How do you currently share insights from calls? Chris: We're stuck taking screenshots and pasting them into Slack or email. It's tedious, and you lose all the context. Maya: What would make that easier? Chris: Some kind of direct integration where I could push key findings straight to our team channels without all the copy-paste work.",
          "painPoint": "Manual screenshot workflow for sharing insights is tedious and loses context"
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

    // Initialize newFeatureSuggestions if not present
    if (!analysis.newFeatureSuggestions) {
      analysis.newFeatureSuggestions = [];
    }

    // Count total quotes across all features
    const totalQuotes = analysis.features.reduce((sum, feature) => sum + (feature.quotes?.length || 0), 0);
    const totalSuggestionQuotes = analysis.newFeatureSuggestions.reduce((sum, feature) => sum + (feature.quotes?.length || 0), 0);
    console.log(`Successfully analyzed: found ${analysis.features.length} features with ${totalQuotes} total quotes, ${analysis.newFeatureSuggestions.length} new feature suggestions with ${totalSuggestionQuotes} quotes`);

    res.json({
      success: true,
      analysis,
      metadata: {
        transcriptLength: transcript.length,
        featuresFound: analysis.features.length,
        quotesFound: totalQuotes,
        newFeatureSuggestionsFound: analysis.newFeatureSuggestions.length,
        suggestionQuotesFound: totalSuggestionQuotes,
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
