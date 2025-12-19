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

    // Insert new feature suggestions with 'pending' status
    for (const suggestion of newFeatureSuggestions) {
      // Insert the feature suggestion with AI summary and 'pending' status
      const suggestionResult = await client.query(
        'INSERT INTO transcript_feature_suggestions (transcript_id, feature_name, ai_summary, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [transcriptId, suggestion.featureName, suggestion.aiSummary, 'pending']
      );
      const suggestionId = suggestionResult.rows[0].id;

      // Insert quotes for this suggestion
      for (const quoteObj of suggestion.quotes) {
        await client.query(
          'INSERT INTO feature_suggestion_quotes (suggestion_id, quote, pain_point) VALUES ($1, $2, $3)',
          [suggestionId, quoteObj.quote, quoteObj.painPoint]
        );
      }

      // NOTE: No longer automatically adding suggestions to features table
      // User must explicitly approve each suggestion to add it to their features list
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

    // Get new feature suggestions for this transcript
    const suggestionsResult = await client.query(
      'SELECT id, feature_name, ai_summary, status FROM transcript_feature_suggestions WHERE transcript_id = $1',
      [transcriptId]
    );

    // Get quotes for all suggestions
    const suggestionIds = suggestionsResult.rows.map(row => row.id);
    let suggestionQuotesResult = { rows: [] };

    if (suggestionIds.length > 0) {
      suggestionQuotesResult = await client.query(`
        SELECT suggestion_id, quote, pain_point
        FROM feature_suggestion_quotes
        WHERE suggestion_id = ANY($1)
        ORDER BY suggestion_id, id
      `, [suggestionIds]);
    }

    // Build a map of suggestion_id to quotes
    const suggestionQuotesMap = {};
    suggestionQuotesResult.rows.forEach(row => {
      if (!suggestionQuotesMap[row.suggestion_id]) {
        suggestionQuotesMap[row.suggestion_id] = [];
      }
      suggestionQuotesMap[row.suggestion_id].push({
        quote: row.quote,
        painPoint: row.pain_point
      });
    });

    // Build new feature suggestions array
    const newFeatureSuggestions = suggestionsResult.rows.map(row => ({
      id: row.id,
      featureName: row.feature_name,
      aiSummary: row.ai_summary,
      status: row.status,
      quotes: suggestionQuotesMap[row.id] || []
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
 * Approve a feature suggestion - adds it to the features table and marks as approved
 */
async function approveSuggestion(suggestionId, userId = 'default') {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the suggestion details
    const suggestionResult = await client.query(
      'SELECT feature_name, ai_summary FROM transcript_feature_suggestions WHERE id = $1',
      [suggestionId]
    );

    if (suggestionResult.rows.length === 0) {
      throw new Error('Suggestion not found');
    }

    const { feature_name, ai_summary } = suggestionResult.rows[0];

    // Check if feature already exists
    const existingFeature = await client.query(
      'SELECT id FROM features WHERE user_id = $1 AND feature_name = $2',
      [userId, feature_name]
    );

    // Only add to features table if it doesn't already exist
    if (existingFeature.rows.length === 0) {
      await client.query(
        'INSERT INTO features (user_id, feature_name, description, is_suggestion) VALUES ($1, $2, $3, $4)',
        [userId, feature_name, ai_summary, true]
      );
    }

    // Update suggestion status to 'approved'
    await client.query(
      'UPDATE transcript_feature_suggestions SET status = $1 WHERE id = $2',
      ['approved', suggestionId]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ignore a feature suggestion - marks it as ignored
 */
async function ignoreSuggestion(suggestionId) {
  try {
    const result = await pool.query(
      'UPDATE transcript_feature_suggestions SET status = $1 WHERE id = $2',
      ['ignored', suggestionId]
    );
    return result.rowCount > 0;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  saveTranscript,
  getTranscripts,
  getTranscriptById,
  deleteTranscript,
  approveSuggestion,
  ignoreSuggestion
};
