const pool = require('./pool');

/**
 * Save a transcript with its feature mappings and summaries
 */
async function saveTranscript(userId, transcriptText, summary, features, newFeatureSuggestions = []) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert transcript
    const transcriptResult = await client.query(
      'INSERT INTO transcripts (user_id, transcript_text, summary) VALUES ($1, $2, $3) RETURNING id',
      [userId, transcriptText, summary]
    );
    const transcriptId = transcriptResult.rows[0].id;

    // Insert features, their summaries, pain points, and mappings
    for (const feature of features) {
      // Insert the AI summary for this feature
      await client.query(
        'INSERT INTO transcript_feature_summaries (transcript_id, feature_name, ai_summary) VALUES ($1, $2, $3)',
        [transcriptId, feature.featureName, feature.aiSummary]
      );

      // Insert pain points and feature mappings for each quote
      for (const quoteObj of feature.quotes) {
        const painPointResult = await client.query(
          'INSERT INTO pain_points (transcript_id, pain_point, quote) VALUES ($1, $2, $3) RETURNING id',
          [transcriptId, quoteObj.painPoint, quoteObj.quote]
        );
        const painPointId = painPointResult.rows[0].id;

        // Insert feature mapping
        await client.query(
          'INSERT INTO feature_mappings (pain_point_id, feature_name) VALUES ($1, $2)',
          [painPointId, feature.featureName]
        );
      }
    }

    // Insert new feature suggestions directly into features table with 'pending' status
    for (const suggestion of newFeatureSuggestions) {
      // Check if similar pending suggestion already exists for this user
      const similarSuggestions = await client.query(`
        SELECT id, pain_points_count
        FROM features
        WHERE user_id = $1
        AND LOWER(feature_name) = LOWER($2)
        AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, suggestion.featureName]);

      let featureId;
      let painPointsCount;

      if (similarSuggestions.rows.length > 0) {
        // Update existing pending suggestion with incremented count
        const existingId = similarSuggestions.rows[0].id;
        painPointsCount = similarSuggestions.rows[0].pain_points_count + 1;

        const updateResult = await client.query(
          'UPDATE features SET pain_points_count = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
          [painPointsCount, existingId]
        );
        featureId = updateResult.rows[0].id;
      } else {
        // Insert new pending feature suggestion
        painPointsCount = 1;

        const insertResult = await client.query(
          'INSERT INTO features (user_id, feature_name, description, status, is_suggestion, transcript_id, pain_points_count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [userId, suggestion.featureName, suggestion.aiSummary, 'pending', true, transcriptId, painPointsCount]
        );
        featureId = insertResult.rows[0].id;
      }

      // Insert pain points and feature mappings for each quote
      for (const quoteObj of suggestion.quotes) {
        const painPointResult = await client.query(
          'INSERT INTO pain_points (transcript_id, pain_point, quote) VALUES ($1, $2, $3) RETURNING id',
          [transcriptId, quoteObj.painPoint, quoteObj.quote]
        );
        const painPointId = painPointResult.rows[0].id;

        // Insert feature mapping
        await client.query(
          'INSERT INTO feature_mappings (pain_point_id, feature_name) VALUES ($1, $2)',
          [painPointId, suggestion.featureName]
        );
      }
    }

    await client.query('COMMIT');
    return transcriptId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all transcripts for a user
 */
async function getTranscripts(userId = 'default') {
  const result = await pool.query(
    `SELECT id, summary, created_at
     FROM transcripts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get a single transcript with all its features, summaries, and quotes
 */
async function getTranscriptById(transcriptId) {
  const client = await pool.connect();

  try {
    // Get transcript
    const transcriptResult = await client.query(
      'SELECT * FROM transcripts WHERE id = $1',
      [transcriptId]
    );

    if (transcriptResult.rows.length === 0) {
      return null;
    }

    const transcript = transcriptResult.rows[0];

    // Get feature summaries for this transcript
    const summariesResult = await client.query(
      'SELECT feature_name, ai_summary FROM transcript_feature_summaries WHERE transcript_id = $1',
      [transcriptId]
    );

    // Build a map of feature_name to ai_summary
    const summariesMap = {};
    summariesResult.rows.forEach(row => {
      summariesMap[row.feature_name] = row.ai_summary;
    });

    // Get pain points with their feature mappings
    const painPointsResult = await client.query(`
      SELECT pp.id, pp.pain_point, pp.quote, fm.feature_name
      FROM pain_points pp
      JOIN feature_mappings fm ON pp.id = fm.pain_point_id
      WHERE pp.transcript_id = $1
      ORDER BY fm.feature_name, pp.id
    `, [transcriptId]);

    // Group quotes by feature
    const featuresMap = {};
    painPointsResult.rows.forEach(row => {
      if (!featuresMap[row.feature_name]) {
        featuresMap[row.feature_name] = {
          featureName: row.feature_name,
          aiSummary: summariesMap[row.feature_name] || '',
          quotes: []
        };
      }
      featuresMap[row.feature_name].quotes.push({
        quote: row.quote,
        painPoint: row.pain_point
      });
    });

    // Get new feature suggestions for this transcript (pending features linked to this transcript)
    const suggestionsResult = await client.query(
      'SELECT id, feature_name, description, status, pain_points_count FROM features WHERE transcript_id = $1 AND status = $2',
      [transcriptId, 'pending']
    );

    // Get quotes/pain points for all suggestions via feature_mappings
    const suggestionNames = suggestionsResult.rows.map(row => row.feature_name);
    let suggestionQuotesResult = { rows: [] };

    if (suggestionNames.length > 0) {
      suggestionQuotesResult = await client.query(`
        SELECT fm.feature_name, pp.quote, pp.pain_point
        FROM feature_mappings fm
        JOIN pain_points pp ON fm.pain_point_id = pp.id
        WHERE fm.feature_name = ANY($1) AND pp.transcript_id = $2
        ORDER BY fm.feature_name, pp.id
      `, [suggestionNames, transcriptId]);
    }

    // Build a map of feature_name to quotes
    const suggestionQuotesMap = {};
    suggestionQuotesResult.rows.forEach(row => {
      if (!suggestionQuotesMap[row.feature_name]) {
        suggestionQuotesMap[row.feature_name] = [];
      }
      suggestionQuotesMap[row.feature_name].push({
        quote: row.quote,
        painPoint: row.pain_point
      });
    });

    // Build new feature suggestions array
    const newFeatureSuggestions = suggestionsResult.rows.map(row => ({
      id: row.id,
      featureName: row.feature_name,
      aiSummary: row.description,
      status: row.status,
      painPointsCount: row.pain_points_count,
      quotes: suggestionQuotesMap[row.feature_name] || []
    }));

    return {
      id: transcript.id,
      transcriptText: transcript.transcript_text,
      summary: transcript.summary,
      createdAt: transcript.created_at,
      features: Object.values(featuresMap),
      newFeatureSuggestions: newFeatureSuggestions
    };
  } finally {
    client.release();
  }
}

/**
 * Delete a transcript and all associated data
 */
async function deleteTranscript(transcriptId) {
  await pool.query('DELETE FROM transcripts WHERE id = $1', [transcriptId]);
}

/**
 * Approve a feature suggestion (change status from 'pending' to 'active')
 */
async function approveSuggestion(suggestionId, userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update the feature status from 'pending' to 'active'
    const result = await client.query(
      'UPDATE features SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND status = $4 RETURNING *',
      ['active', suggestionId, userId, 'pending']
    );

    if (result.rows.length === 0) {
      throw new Error('Suggestion not found or already approved');
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  saveTranscript,
  getTranscripts,
  getTranscriptById,
  deleteTranscript,
  approveSuggestion
};
