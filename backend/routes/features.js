const express = require('express');
const router = express.Router();
const { getFeatures, getFeatureNames, saveFeatures, deleteFeatures, getFeatureDetails, updateFeature, deleteFeatureMapping } = require('../db/features');

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

/**
 * GET /api/features/details/:featureName
 * Get detailed information about a feature including pain points
 */
router.get('/details/:featureName', async (req, res) => {
  try {
    const featureName = decodeURIComponent(req.params.featureName);
    const userId = req.query.userId || 'default';

    const featureDetails = await getFeatureDetails(featureName, userId);

    if (!featureDetails) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found'
      });
    }

    res.json({
      success: true,
      feature: featureDetails
    });
  } catch (error) {
    console.error('Error retrieving feature details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve feature details',
      message: error.message
    });
  }
});

/**
 * PUT /api/features/:featureId
 * Update a feature's title and description
 */
router.put('/:featureId', async (req, res) => {
  try {
    const featureId = parseInt(req.params.featureId);
    const { featureName, description, userId = 'default' } = req.body;

    if (!featureName) {
      return res.status(400).json({
        success: false,
        error: 'Feature name is required'
      });
    }

    const updatedFeature = await updateFeature(featureId, featureName, description, userId);

    res.json({
      success: true,
      message: 'Feature updated successfully',
      feature: updatedFeature
    });
  } catch (error) {
    console.error('Error updating feature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update feature',
      message: error.message
    });
  }
});

/**
 * DELETE /api/feature-mappings/:mappingId
 * Delete a feature mapping (pain point to feature connection)
 */
router.delete('/mappings/:mappingId', async (req, res) => {
  try {
    const mappingId = parseInt(req.params.mappingId);
    const success = await deleteFeatureMapping(mappingId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    res.json({
      success: true,
      message: 'Feature mapping deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feature mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete feature mapping',
      message: error.message
    });
  }
});

module.exports = router;
