const pool = require('./pool');

/**
 * Get all features for a user
 * @param {string} userId - User identifier (default: 'default')
 * @returns {Promise<Array>} Array of feature objects
 */
async function getFeatures(userId = 'default') {
  try {
    const result = await pool.query(
      'SELECT id, feature_name, description, is_suggestion, created_at, updated_at FROM features WHERE user_id = $1 ORDER BY id ASC',
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting features:', error);
    throw error;
  }
}

/**
 * Get feature names only for a user (for backwards compatibility)
 * @param {string} userId - User identifier (default: 'default')
 * @returns {Promise<Array>} Array of feature names
 */
async function getFeatureNames(userId = 'default') {
  try {
    const result = await pool.query(
      'SELECT feature_name FROM features WHERE user_id = $1 ORDER BY id ASC',
      [userId]
    );
    return result.rows.map(row => row.feature_name);
  } catch (error) {
    console.error('Error getting feature names:', error);
    throw error;
  }
}

/**
 * Save multiple features for a user (replaces existing features)
 * @param {string} userId - User identifier
 * @param {Array<string>} features - Array of feature names
 * @returns {Promise<number>} Number of features saved
 */
async function saveFeatures(userId = 'default', features) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing user-defined features for this user (keep AI suggestions)
    await client.query('DELETE FROM features WHERE user_id = $1 AND (is_suggestion = FALSE OR is_suggestion IS NULL)', [userId]);

    // Insert new features
    if (features && features.length > 0) {
      const values = features.map((feature, index) =>
        `($1, $${index + 2}, FALSE)`
      ).join(', ');

      const params = [userId, ...features];

      await client.query(
        `INSERT INTO features (user_id, feature_name, is_suggestion) VALUES ${values}`,
        params
      );
    }

    await client.query('COMMIT');
    return features.length;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving features:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete all features for a user
 * @param {string} userId - User identifier
 * @returns {Promise<number>} Number of features deleted
 */
async function deleteFeatures(userId = 'default') {
  try {
    const result = await pool.query(
      'DELETE FROM features WHERE user_id = $1',
      [userId]
    );
    return result.rowCount;
  } catch (error) {
    console.error('Error deleting features:', error);
    throw error;
  }
}

/**
 * Get a single feature with its pain points grouped by transcript
 * @param {string} featureName - Feature name
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Feature with pain points
 */
async function getFeatureDetails(featureName, userId = 'default') {
  try {
    // Get feature details
    const featureResult = await pool.query(
      'SELECT id, feature_name, description, is_suggestion FROM features WHERE feature_name = $1 AND user_id = $2',
      [featureName, userId]
    );

    if (featureResult.rows.length === 0) {
      return null;
    }

    const feature = featureResult.rows[0];

    // Get pain points with transcript info
    const painPointsResult = await pool.query(`
      SELECT
        pp.id as pain_point_id,
        pp.pain_point,
        pp.quote,
        t.id as transcript_id,
        t.summary as transcript_name,
        fm.id as mapping_id
      FROM feature_mappings fm
      JOIN pain_points pp ON fm.pain_point_id = pp.id
      JOIN transcripts t ON pp.transcript_id = t.id
      WHERE fm.feature_name = $1 AND t.user_id = $2
      ORDER BY t.created_at DESC, pp.id ASC
    `, [featureName, userId]);

    // Group pain points by transcript
    const transcriptMap = {};
    painPointsResult.rows.forEach(row => {
      if (!transcriptMap[row.transcript_id]) {
        transcriptMap[row.transcript_id] = {
          transcriptId: row.transcript_id,
          transcriptName: row.transcript_name || `Transcript #${row.transcript_id}`,
          painPoints: []
        };
      }
      transcriptMap[row.transcript_id].painPoints.push({
        painPointId: row.pain_point_id,
        painPoint: row.pain_point,
        quote: row.quote,
        mappingId: row.mapping_id
      });
    });

    return {
      ...feature,
      transcripts: Object.values(transcriptMap)
    };
  } catch (error) {
    console.error('Error getting feature details:', error);
    throw error;
  }
}

/**
 * Update a feature's title and description
 * @param {number} featureId - Feature ID
 * @param {string} featureName - New feature name
 * @param {string} description - New description
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Updated feature
 */
async function updateFeature(featureId, featureName, description, userId = 'default') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get old feature name
    const oldFeatureResult = await client.query(
      'SELECT feature_name FROM features WHERE id = $1 AND user_id = $2',
      [featureId, userId]
    );

    if (oldFeatureResult.rows.length === 0) {
      throw new Error('Feature not found');
    }

    const oldFeatureName = oldFeatureResult.rows[0].feature_name;

    // Update the feature
    const result = await client.query(
      'UPDATE features SET feature_name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *',
      [featureName, description, featureId, userId]
    );

    // Update feature_mappings to reference the new feature name
    if (oldFeatureName !== featureName) {
      await client.query(
        'UPDATE feature_mappings SET feature_name = $1 WHERE feature_name = $2',
        [featureName, oldFeatureName]
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating feature:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a feature mapping (pain point to feature connection)
 * @param {number} mappingId - Mapping ID
 * @returns {Promise<boolean>} Success
 */
async function deleteFeatureMapping(mappingId) {
  try {
    const result = await pool.query(
      'DELETE FROM feature_mappings WHERE id = $1',
      [mappingId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting feature mapping:', error);
    throw error;
  }
}

/**
 * Get all features with their pain point counts
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} Array of features with pain point counts
 */
async function getAllFeaturesWithCounts(userId = 'default') {
  try {
    const result = await pool.query(`
      SELECT
        f.id,
        f.feature_name,
        f.description,
        f.is_suggestion,
        f.created_at,
        f.updated_at,
        COUNT(DISTINCT pp.transcript_id) as pain_point_count
      FROM features f
      LEFT JOIN feature_mappings fm ON f.feature_name = fm.feature_name
      LEFT JOIN pain_points pp ON fm.pain_point_id = pp.id
      WHERE f.user_id = $1
      GROUP BY f.id, f.feature_name, f.description, f.is_suggestion, f.created_at, f.updated_at
      ORDER BY pain_point_count DESC, f.id ASC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      feature_name: row.feature_name,
      description: row.description,
      is_suggestion: row.is_suggestion,
      painPointCount: parseInt(row.pain_point_count) || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('Error getting features with counts:', error);
    throw error;
  }
}

module.exports = {
  getFeatures,
  getFeatureNames,
  saveFeatures,
  deleteFeatures,
  getFeatureDetails,
  updateFeature,
  deleteFeatureMapping,
  getAllFeaturesWithCounts
};
