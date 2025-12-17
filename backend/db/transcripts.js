const pool = require('./pool');

/**
 * Save a transcript with its feature mappings and summaries
 */
async function saveTranscript(userId, transcriptText, summary, features) {
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

    return {
      id: transcript.id,
      transcriptText: transcript.transcript_text,
      summary: transcript.summary,
      createdAt: transcript.created_at,
      features: Object.values(featuresMap)
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

module.exports = {
  saveTranscript,
  getTranscripts,
  getTranscriptById,
  deleteTranscript
};
