const express = require('express');
const router = express.Router();
const {
  saveTranscript,
  getTranscripts,
  getTranscriptById,
  deleteTranscript,
  approveSuggestion
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
 */
router.get('/:id', async (req, res) => {
  try {
    const transcriptId = parseInt(req.params.id);
    const transcript = await getTranscriptById(transcriptId);

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
 * POST /api/transcripts/suggestions/:id/approve
 * Approve a feature suggestion
 */
router.post('/suggestions/:id/approve', async (req, res) => {
  try {
    const suggestionId = parseInt(req.params.id);
    const userId = req.body.userId || 'default';

    await approveSuggestion(suggestionId, userId);

    res.json({
      success: true,
      message: 'Suggestion approved'
    });
  } catch (error) {
    console.error('Error approving suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve suggestion'
    });
  }
});

module.exports = router;
