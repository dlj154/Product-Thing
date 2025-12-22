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

    // Insert new feature suggestions with pain point tracking
    for (const suggestion of newFeatureSuggestions) {
      // Check if similar suggestion exists in previous transcripts (pending status only)
      const similarSuggestions = await client.query(`
        SELECT tfs.id, tfs.pain_points_count
        FROM transcript_feature_suggestions tfs
        JOIN transcripts t ON tfs.transcript_id = t.id
        WHERE t.user_id = $1
        AND LOWER(tfs.feature_name) = LOWER($2)
        AND tfs.status = 'pending'
        ORDER BY tfs.created_at DESC
        LIMIT 1
      `, [userId, suggestion.featureName]);

      // Calculate pain points count (existing count + 1, or 1 if first occurrence)
      const painPointsCount = similarSuggestions.rows.length > 0
        ? similarSuggestions.rows[0].pain_points_count + 1
        : 1;

      // Insert the feature suggestion with AI summary and pain points count
      const suggestionResult = await client.query(
        'INSERT INTO transcript_feature_suggestions (transcript_id, feature_name, ai_summary, status, pain_points_count) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [transcriptId, suggestion.featureName, suggestion.aiSummary, 'pending', painPointsCount]
      );
      const suggestionId = suggestionResult.rows[0].id;

      // Insert quotes for this suggestion
      for (const quoteObj of suggestion.quotes) {
        await client.query(
          'INSERT INTO feature_suggestion_quotes (suggestion_id, quote, pain_point) VALUES ($1, $2, $3)',
          [suggestionId, quoteObj.quote, quoteObj.painPoint]
        );
      }

      // Do NOT automatically add to features table - wait for approval
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
      'SELECT id, feature_name, ai_summary, status, pain_points_count FROM transcript_feature_suggestions WHERE transcript_id = $1',
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
      painPointsCount: row.pain_points_count,
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
 * Approve a feature suggestion and add it to the features list
 */
async function approveSuggestion(suggestionId, userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the suggestion details including transcript_id and pain_points_count
    const suggestionResult = await client.query(
      'SELECT feature_name, ai_summary, transcript_id, pain_points_count FROM transcript_feature_suggestions WHERE id = $1',
      [suggestionId]
    );

    if (suggestionResult.rows.length === 0) {
      throw new Error('Suggestion not found');
    }

    const { feature_name, ai_summary, transcript_id, pain_points_count } = suggestionResult.rows[0];

    // Get all quotes for this suggestion
    const quotesResult = await client.query(
      'SELECT quote, pain_point FROM feature_suggestion_quotes WHERE suggestion_id = $1',
      [suggestionId]
    );

    // Update the suggestion status to approved
    await client.query(
      'UPDATE transcript_feature_suggestions SET status = $1 WHERE id = $2',
      ['approved', suggestionId]
    );

    // Add to features table if it doesn't exist
    const existingFeature = await client.query(
      'SELECT id FROM features WHERE user_id = $1 AND feature_name = $2',
      [userId, feature_name]
    );

    if (existingFeature.rows.length === 0) {
      await client.query(
        'INSERT INTO features (user_id, feature_name, description, is_suggestion) VALUES ($1, $2, $3, $4)',
        [userId, feature_name, ai_summary, false]
      );
    }

    // Transfer pain points and quotes to the feature
    for (const quoteRow of quotesResult.rows) {
      // Create a pain_point entry linked to the original transcript
      const painPointResult = await client.query(
        'INSERT INTO pain_points (transcript_id, pain_point, quote) VALUES ($1, $2, $3) RETURNING id',
        [transcript_id, quoteRow.pain_point, quoteRow.quote]
      );
      const painPointId = painPointResult.rows[0].id;

      // Create feature_mapping to link the pain_point to the new feature
      await client.query(
        'INSERT INTO feature_mappings (pain_point_id, feature_name) VALUES ($1, $2)',
        [painPointId, feature_name]
      );
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
