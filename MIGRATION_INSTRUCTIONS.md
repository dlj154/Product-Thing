# Migration Instructions: Consolidate Feature Suggestions

## Overview
This migration consolidates the `transcript_feature_suggestions` and `features` tables into a single unified `features` table with status-based workflow.

## Before Migration
- Backup your database
- Ensure your application is stopped or in maintenance mode
- Review `MIGRATION_PLAN.md` for detailed technical information

## Running the Migration

### Method 1: Using the Migration Script (Recommended)
```bash
cd backend
node db/migrate.js migrate
```

### Method 2: Manual SQL (if needed)
The migration script handles everything automatically, but if you need to run SQL manually, see the queries in `backend/db/migrate.js`

## What the Migration Does

1. **Adds new columns to features table**:
   - `status` (TEXT): 'pending', 'active', or 'archived'
   - `transcript_id` (INTEGER): Links to source transcript for suggestions
   - `pain_points_count` (INTEGER): Tracks suggestion recurrence

2. **Migrates existing data**:
   - Copies all pending/approved suggestions from `transcript_feature_suggestions` to `features`
   - Migrates quotes from `feature_suggestion_quotes` to `pain_points` and `feature_mappings`
   - Sets existing features to 'active' status

3. **Drops old tables**:
   - `feature_suggestion_quotes`
   - `transcript_feature_suggestions`

## Rollback (if needed)
```bash
cd backend
node db/migrate.js rollback
```

**Note**: Rollback only works if you haven't made new changes after migration. It will:
- Recreate old tables
- Move pending features back to `transcript_feature_suggestions`
- Remove new columns from features table

## After Migration

### New Status Workflow
- **Pending**: Feature suggestion awaiting approval (previously in `transcript_feature_suggestions`)
- **Active**: Approved feature being tracked (previously in `features` or approved suggestions)
- **Archived**: Feature no longer being pursued

### API Changes
No breaking API changes - the endpoints remain the same:
- `GET /api/features` - Returns active features by default
- `POST /api/transcripts/suggestions/:id/approve` - Approves suggestions (now updates status instead of copying data)
- `POST /api/features/:id/archive` - Archives features (sets status to 'archived')

### Database Schema Changes
The `features` table now has:
```sql
CREATE TABLE features (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  feature_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',          -- NEW
  is_suggestion BOOLEAN DEFAULT FALSE,
  transcript_id INTEGER,                 -- NEW
  pain_points_count INTEGER,             -- NEW
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Verification

After migration, verify:
1. All your manually created features are present with `status='active'`
2. All pending suggestions appear in transcript views
3. Approving a suggestion changes its status to 'active'
4. Archived features don't appear in the main features list

## Troubleshooting

### Migration fails with "table already exists"
The migration may have already run. Check if `transcript_feature_suggestions` table still exists:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'transcript_feature_suggestions';
```

### Data appears duplicated
This may happen if suggestions were approved before migration. The migration script checks for duplicates, but verify:
```sql
SELECT feature_name, COUNT(*) FROM features GROUP BY feature_name HAVING COUNT(*) > 1;
```

### Need to re-run migration
First rollback, then run migrate again:
```bash
node db/migrate.js rollback
node db/migrate.js migrate
```

## Support
For issues, check the logs or contact the development team.
