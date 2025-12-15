const express = require('express');
const router = express.Router();
const { getFeatures, saveFeatures, deleteFeatures } = require('../db/features');

/**
 * GET /api/features
 * Retrieve all saved features for a user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const features = await getFeatures(userId);

    res.json({
      success: true,
      features,
      count: features.length
    });
  } catch (error) {
    console.error('Error retrieving features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve features',
      message: error.message
    });
  }
});

/**
 * POST /api/features
 * Save features for a user (replaces existing features)
 * Body: { features: ["Feature 1", "Feature 2", ...], userId: "optional" }
 */
router.post('/', async (req, res) => {
  try {
    const { features, userId = 'default' } = req.body;

    if (!features || !Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Features must be an array of strings'
      });
    }

    // Filter out empty strings
    const cleanedFeatures = features
      .filter(f => typeof f === 'string' && f.trim())
      .map(f => f.trim());

    const count = await saveFeatures(userId, cleanedFeatures);

    res.json({
      success: true,
      message: 'Features saved successfully',
      count
    });
  } catch (error) {
    console.error('Error saving features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save features',
      message: error.message
    });
  }
});

/**
 * DELETE /api/features
 * Delete all features for a user
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const count = await deleteFeatures(userId);

    res.json({
      success: true,
      message: 'Features deleted successfully',
      count
    });
  } catch (error) {
    console.error('Error deleting features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete features',
      message: error.message
    });
  }
});

module.exports = router;
