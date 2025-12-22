const pool = require('./pool');

/**
 * Migration: Consolidate transcript_feature_suggestions into features table
 *
 * This migration:
 * 1. Adds status, transcript_id, and pain_points_count columns to features table
 * 2. Migrates data from transcript_feature_suggestions to features
 * 3. Migrates quotes from feature_suggestion_quotes to pain_points
 * 4. Drops old tables
 */
async function migrateFeatureSuggestions() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting feature suggestions migration...');

    // Step 1: Add new columns to features table
    console.log('Step 1: Adding new columns to features table...');
    await client.query(`
      ALTER TABLE features
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    `);

    await client.query(`
      ALTER TABLE features
      ADD COLUMN IF NOT EXISTS transcript_id INTEGER REFERENCES transcripts(id) ON DELETE SET NULL
    `);

    await client.query(`
      ALTER TABLE features
      ADD COLUMN IF NOT EXISTS pain_points_count INTEGER
    `);

    // Step 2: Update existing features to have 'active' status
    console.log('Step 2: Setting existing features to active status...');
    await client.query(`
      UPDATE features
      SET status = 'active'
      WHERE status IS NULL
    `);

    // Step 3: Check if old tables exist
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'transcript_feature_suggestions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('transcript_feature_suggestions table does not exist. Migration may have already run.');
      await client.query('COMMIT');
      return { success: true, message: 'Migration already completed or not needed' };
    }

    // Step 4: Migrate pending suggestions from transcript_feature_suggestions to features
    console.log('Step 3: Migrating feature suggestions to features table...');
    const migrateResult = await client.query(`
      INSERT INTO features (user_id, feature_name, description, status, is_suggestion, transcript_id, pain_points_count, created_at)
      SELECT
        t.user_id,
        tfs.feature_name,
        tfs.ai_summary,
        CASE
          WHEN tfs.status = 'approved' THEN 'active'
          ELSE 'pending'
        END as status,
        TRUE as is_suggestion,
        tfs.transcript_id,
        tfs.pain_points_count,
        tfs.created_at
      FROM transcript_feature_suggestions tfs
      JOIN transcripts t ON tfs.transcript_id = t.id
      WHERE NOT EXISTS (
        SELECT 1 FROM features f
        WHERE f.feature_name = tfs.feature_name
        AND f.user_id = t.user_id
        AND f.is_suggestion = TRUE
      )
      RETURNING id
    `);
    console.log(`Migrated ${migrateResult.rowCount} feature suggestions`);

    // Step 5: Migrate quotes from feature_suggestion_quotes to pain_points
    // We need to create pain_points for each quote and link them via feature_mappings
    console.log('Step 4: Migrating feature suggestion quotes...');

    // Get all quotes with their related data
    const quotesResult = await client.query(`
      SELECT
        fsq.quote,
        fsq.pain_point,
        tfs.transcript_id,
        tfs.feature_name,
        t.user_id
      FROM feature_suggestion_quotes fsq
      JOIN transcript_feature_suggestions tfs ON fsq.suggestion_id = tfs.id
      JOIN transcripts t ON tfs.transcript_id = t.id
    `);

    // For each quote, create a pain_point and feature_mapping
    for (const quote of quotesResult.rows) {
      // Insert pain point
      const painPointResult = await client.query(`
        INSERT INTO pain_points (transcript_id, pain_point, quote)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [quote.transcript_id, quote.pain_point, quote.quote]);

      const painPointId = painPointResult.rows[0].id;

      // Insert feature mapping
      await client.query(`
        INSERT INTO feature_mappings (pain_point_id, feature_name)
        VALUES ($1, $2)
      `, [painPointId, quote.feature_name]);
    }
    console.log(`Migrated ${quotesResult.rowCount} quotes to pain_points`);

    // Step 6: Drop old tables
    console.log('Step 5: Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS feature_suggestion_quotes CASCADE');
    await client.query('DROP TABLE IF EXISTS transcript_feature_suggestions CASCADE');

    await client.query('COMMIT');
    console.log('✓ Migration completed successfully!');

    return {
      success: true,
      message: 'Migration completed',
      stats: {
        featuresMigrated: migrateResult.rowCount,
        quotesMigrated: quotesResult.rowCount
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rollback migration (if needed)
 */
async function rollbackMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rolling back migration...');

    // Recreate transcript_feature_suggestions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transcript_feature_suggestions (
        id SERIAL PRIMARY KEY,
        transcript_id INTEGER REFERENCES transcripts(id) ON DELETE CASCADE,
        feature_name TEXT NOT NULL,
        ai_summary TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        pain_points_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Recreate feature_suggestion_quotes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_suggestion_quotes (
        id SERIAL PRIMARY KEY,
        suggestion_id INTEGER REFERENCES transcript_feature_suggestions(id) ON DELETE CASCADE,
        quote TEXT NOT NULL,
        pain_point TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Move pending features back to transcript_feature_suggestions
    await client.query(`
      INSERT INTO transcript_feature_suggestions (transcript_id, feature_name, ai_summary, status, pain_points_count, created_at)
      SELECT
        transcript_id,
        feature_name,
        description,
        status,
        pain_points_count,
        created_at
      FROM features
      WHERE status = 'pending' AND is_suggestion = TRUE AND transcript_id IS NOT NULL
    `);

    // Delete migrated pending features from features table
    await client.query(`
      DELETE FROM features
      WHERE status = 'pending' AND is_suggestion = TRUE AND transcript_id IS NOT NULL
    `);

    // Remove added columns
    await client.query(`
      ALTER TABLE features
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS transcript_id,
      DROP COLUMN IF EXISTS pain_points_count
    `);

    await client.query('COMMIT');
    console.log('✓ Rollback completed');

    return { success: true, message: 'Rollback completed' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow running from command line
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'migrate') {
    migrateFeatureSuggestions()
      .then(result => {
        console.log('Result:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else if (command === 'rollback') {
    rollbackMigration()
      .then(result => {
        console.log('Result:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node migrate.js [migrate|rollback]');
    process.exit(1);
  }
}

module.exports = {
  migrateFeatureSuggestions,
  rollbackMigration
};
