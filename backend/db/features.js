const pool = require('./pool');

/**
 * Get all features for a user
 * @param {string} userId - User identifier (default: 'default')
 * @returns {Promise<Array>} Array of feature names
 */
async function getFeatures(userId = 'default') {
  try {
    const result = await pool.query(
      'SELECT feature_name FROM features WHERE user_id = $1 ORDER BY id ASC',
      [userId]
    );
    return result.rows.map(row => row.feature_name);
  } catch (error) {
    console.error('Error getting features:', error);
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

    // Delete existing features for this user
    await client.query('DELETE FROM features WHERE user_id = $1', [userId]);

    // Insert new features
    if (features && features.length > 0) {
      const values = features.map((feature, index) =>
        `($1, $${index + 2})`
      ).join(', ');

      const params = [userId, ...features];

      await client.query(
        `INSERT INTO features (user_id, feature_name) VALUES ${values}`,
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

module.exports = {
  getFeatures,
  saveFeatures,
  deleteFeatures
};
