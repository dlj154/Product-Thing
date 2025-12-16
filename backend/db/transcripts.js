const pool = require('./pool');

/**
 * Save a transcript with its pain points and feature mappings
 */
async function saveTranscript(userId, transcriptText, summary, painPoints) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert transcript
    const transcriptResult = await client.query(
      'INSERT INTO transcripts (user_id, transcript_text, summary) VALUES ($1, $2, $3) RETURNING id',
      [userId, transcriptText, summary]
    );
    const transcriptId = transcriptResult.rows[0].id;

    // Insert pain points and feature mappings
    for (const pp of painPoints) {
      const painPointResult = await client.query(
        'INSERT INTO pain_points (transcript_id, pain_point, quote) VALUES ($1, $2, $3) RETURNING id',
        [transcriptId, pp.painPoint, pp.quote]
      );
      const painPointId = painPointResult.rows[0].id;

      // Insert feature mappings
      for (const feature of pp.mappedFeatures) {
        await client.query(
          'INSERT INTO feature_mappings (pain_point_id, feature_name) VALUES ($1, $2)',
          [painPointId, feature]
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
 * Get a single transcript with all its pain points and feature mappings
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

    // Get pain points
    const painPointsResult = await client.query(
      'SELECT id, pain_point, quote FROM pain_points WHERE transcript_id = $1',
      [transcriptId]
    );

    // Get feature mappings for each pain point
    const painPoints = await Promise.all(
      painPointsResult.rows.map(async (pp) => {
        const mappingsResult = await client.query(
          'SELECT feature_name FROM feature_mappings WHERE pain_point_id = $1',
          [pp.id]
        );

        return {
          painPoint: pp.pain_point,
          quote: pp.quote,
          mappedFeatures: mappingsResult.rows.map(r => r.feature_name)
        };
      })
    );

    return {
      id: transcript.id,
      transcriptText: transcript.transcript_text,
      summary: transcript.summary,
      createdAt: transcript.created_at,
      painPoints
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
