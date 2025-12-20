const pool = require('./pool');

async function initDatabase() {
  try {
    console.log('Initializing database schema...');

    // Create features table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS features (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        feature_name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add description column if it doesn't exist (for existing databases)
    await pool.query(`
      ALTER TABLE features
      ADD COLUMN IF NOT EXISTS description TEXT
    `);

    // Add is_suggestion column if it doesn't exist (for existing databases)
    await pool.query(`
      ALTER TABLE features
      ADD COLUMN IF NOT EXISTS is_suggestion BOOLEAN DEFAULT FALSE
    `);

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_features_user_id
      ON features(user_id)
    `);

    // Create transcripts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        transcript_text TEXT NOT NULL,
        summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for transcripts
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transcripts_user_id
      ON transcripts(user_id)
    `);

    // Create pain_points table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pain_points (
        id SERIAL PRIMARY KEY,
        transcript_id INTEGER REFERENCES transcripts(id) ON DELETE CASCADE,
        pain_point TEXT NOT NULL,
        quote TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for pain_points
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pain_points_transcript_id
      ON pain_points(transcript_id)
    `);

    // Create feature_mappings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feature_mappings (
        id SERIAL PRIMARY KEY,
        pain_point_id INTEGER REFERENCES pain_points(id) ON DELETE CASCADE,
        feature_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for feature_mappings
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feature_mappings_pain_point_id
      ON feature_mappings(pain_point_id)
    `);

    // Create transcript_feature_summaries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transcript_feature_summaries (
        id SERIAL PRIMARY KEY,
        transcript_id INTEGER REFERENCES transcripts(id) ON DELETE CASCADE,
        feature_name TEXT NOT NULL,
        ai_summary TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for transcript_feature_summaries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transcript_feature_summaries_transcript_id
      ON transcript_feature_summaries(transcript_id)
    `);

    // Create transcript_feature_suggestions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transcript_feature_suggestions (
        id SERIAL PRIMARY KEY,
        transcript_id INTEGER REFERENCES transcripts(id) ON DELETE CASCADE,
        feature_name TEXT NOT NULL,
        ai_summary TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for transcript_feature_suggestions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transcript_feature_suggestions_transcript_id
      ON transcript_feature_suggestions(transcript_id)
    `);

    // Create feature_suggestion_quotes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feature_suggestion_quotes (
        id SERIAL PRIMARY KEY,
        suggestion_id INTEGER REFERENCES transcript_feature_suggestions(id) ON DELETE CASCADE,
        quote TEXT NOT NULL,
        pain_point TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for feature_suggestion_quotes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feature_suggestion_quotes_suggestion_id
      ON feature_suggestion_quotes(suggestion_id)
    `);

    // Add status column to transcript_feature_suggestions (for approval workflow)
    await pool.query(`
      ALTER TABLE transcript_feature_suggestions
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    `);

    // Add pain_points_count column to transcript_feature_suggestions (tracks recurrence)
    await pool.query(`
      ALTER TABLE transcript_feature_suggestions
      ADD COLUMN IF NOT EXISTS pain_points_count INTEGER DEFAULT 1
    `);

    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = { initDatabase };
