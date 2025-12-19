const express = require('express');
const router = express.Router();
const {
  saveTranscript,
  getTranscripts,
  getTranscriptById,
  deleteTranscript,
  approveSuggestion,
  ignoreSuggestion,
  getSuggestionHistory,
  getTranscriptByIdWithHistory
} = require('../db/transcripts');

/**
 * GET /api/transcripts
 * Get all transcripts for the default user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const transcripts = await getTranscripts(userId);

    res.json({
      success: true,
      transcripts
    });
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transcripts'
    });
  }
});

/**
 * GET /api/transcripts/:id
 * Get a specific transcript with all details
 * Add ?withHistory=true to include suggestion history across all transcripts
 */
router.get('/:id', async (req, res) => {
  try {
    const transcriptId = parseInt(req.params.id);
    const userId = req.query.userId || 'default';
    const withHistory = req.query.withHistory === 'true';

    let transcript;
    if (withHistory) {
      transcript = await getTranscriptByIdWithHistory(transcriptId, userId);
    } else {
      transcript = await getTranscriptById(transcriptId);
    }

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    res.json({
      success: true,
      transcript
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transcript'
    });
  }
});

/**
 * POST /api/transcripts
 * Save a new transcript with pain points and feature mappings
 */
router.post('/', async (req, res) => {
  try {
    const { transcriptText, summary, features, newFeatureSuggestions } = req.body;
    const userId = req.body.userId || 'default';

    if (!transcriptText || !features) {
      return res.status(400).json({
        success: false,
        error: 'transcriptText and features are required'
      });
    }

    const transcriptId = await saveTranscript(
      userId,
      transcriptText,
      summary,
      features,
      newFeatureSuggestions || []
    );

    res.json({
      success: true,
      transcriptId
    });
  } catch (error) {
    console.error('Error saving transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save transcript'
    });
  }
});

/**
 * DELETE /api/transcripts/:id
 * Delete a transcript
 */
router.delete('/:id', async (req, res) => {
  try {
    const transcriptId = parseInt(req.params.id);
    await deleteTranscript(transcriptId);

    res.json({
      success: true,
      message: 'Transcript deleted'
    });
  } catch (error) {
    console.error('Error deleting transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete transcript'
    });
  }
});

/**
 * POST /api/transcripts/suggestions/:suggestionId/approve
 * Approve a feature suggestion
 */
router.post('/suggestions/:suggestionId/approve', async (req, res) => {
  try {
    const suggestionId = parseInt(req.params.suggestionId);
    const userId = req.body.userId || 'default';

    await approveSuggestion(suggestionId, userId);

    res.json({
      success: true,
      message: 'Feature suggestion approved and added to features list'
    });
  } catch (error) {
    console.error('Error approving suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve suggestion',
      message: error.message
    });
  }
});

/**
 * POST /api/transcripts/suggestions/:suggestionId/ignore
 * Ignore a feature suggestion
 */
router.post('/suggestions/:suggestionId/ignore', async (req, res) => {
  try {
    const suggestionId = parseInt(req.params.suggestionId);

    const success = await ignoreSuggestion(suggestionId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }

    res.json({
      success: true,
      message: 'Feature suggestion ignored'
    });
  } catch (error) {
    console.error('Error ignoring suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ignore suggestion',
      message: error.message
    });
  }
});

/**
 * GET /api/transcripts/suggestions/history/:featureName
 * Get suggestion history for a feature name across all transcripts
 */
router.get('/suggestions/history/:featureName', async (req, res) => {
  try {
    const featureName = decodeURIComponent(req.params.featureName);
    const userId = req.query.userId || 'default';

    const history = await getSuggestionHistory(featureName, userId);

    if (!history) {
      return res.status(404).json({
        success: false,
        error: 'No suggestions found for this feature'
      });
    }

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching suggestion history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestion history',
      message: error.message
    });
  }
});

module.exports = router;
