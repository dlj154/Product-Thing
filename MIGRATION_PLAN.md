# Feature Suggestions Schema Migration Plan

## Overview
Consolidate `transcript_feature_suggestions` and `features` tables into a single unified `features` table with a status-based workflow.

## Current Schema Issues
1. **Data Duplication**: Approved suggestions are copied from `transcript_feature_suggestions` to `features`
2. **Two Sources of Truth**: Features exist in two places
3. **Complex Queries**: Need to join multiple tables to get complete feature view
4. **Inconsistency Risk**: Data can drift between tables

## New Unified Schema

### Updated `features` Table
```sql
CREATE TABLE features (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  feature_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',           -- NEW: 'pending', 'active', 'archived'
  is_suggestion BOOLEAN DEFAULT FALSE,    -- EXISTING: Tracks if AI-suggested vs manual
  transcript_id INTEGER REFERENCES transcripts(id) ON DELETE SET NULL,  -- NEW: Link to source transcript (nullable)
  pain_points_count INTEGER,              -- NEW: For suggestions, tracks recurrence across transcripts
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Status Flow
- **pending**: Feature suggestion awaiting approval (previously in `transcript_feature_suggestions`)
- **active**: Approved feature being tracked (previously in `features` or approved suggestions)
- **archived**: Feature no longer being pursued

### Quotes Storage
Since pending suggestions currently use `feature_suggestion_quotes` table, we have two options:

**Option A: Unified quotes in pain_points**
- Migrate quotes from `feature_suggestion_quotes` to `pain_points` table
- All features (pending and active) use the same `pain_points` → `feature_mappings` structure
- Delete `feature_suggestion_quotes` table

**Option B: Keep feature_suggestion_quotes for pending features**
- Pending features use `feature_suggestion_quotes`
- Active features use `pain_points` → `feature_mappings`
- More complex but no structural change to existing quotes

**Recommendation: Option A** - Cleaner, single source of truth for quotes

## Migration Steps

### 1. Add new columns to features table
```sql
ALTER TABLE features
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS transcript_id INTEGER REFERENCES transcripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pain_points_count INTEGER;
```

### 2. Migrate data from transcript_feature_suggestions to features
```sql
-- Insert pending suggestions as features with status='pending'
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
  -- Avoid duplicates if suggestion was already approved to features table
  SELECT 1 FROM features f
  WHERE f.feature_name = tfs.feature_name
  AND f.user_id = t.user_id
);
```

### 3. Migrate quotes from feature_suggestion_quotes to pain_points
```sql
-- For each quote in feature_suggestion_quotes, create corresponding pain_point and mapping
INSERT INTO pain_points (transcript_id, pain_point, quote, created_at)
SELECT
  tfs.transcript_id,
  fsq.pain_point,
  fsq.quote,
  fsq.created_at
FROM feature_suggestion_quotes fsq
JOIN transcript_feature_suggestions tfs ON fsq.suggestion_id = tfs.id;

-- Create feature mappings for these new pain points
-- (This is complex due to needing to track which pain_points were just created)
```

### 4. Drop old tables
```sql
DROP TABLE feature_suggestion_quotes;
DROP TABLE transcript_feature_suggestions;
```

## Code Changes Required

### Backend Database Functions (`backend/db/transcripts.js`)
- **saveTranscript()**: Insert suggestions directly into `features` table with `status='pending'`
- **getTranscriptById()**: Query `features` table with `status='pending'` instead of `transcript_feature_suggestions`
- **approveSuggestion()**: Update `features.status` from 'pending' to 'active' (no more copying data)
- Remove references to `transcript_feature_suggestions` and `feature_suggestion_quotes`

### Backend Database Functions (`backend/db/features.js`)
- **getFeatures()**: Add status filtering (default to `status='active'`)
- **saveFeatures()**: Set `status='active'` for manually created features
- **archiveFeature()**: Update `status='archived'` instead of changing `is_suggestion`
- Update queries to include `status` field

### Backend Routes (`backend/routes/transcripts.js`)
- **POST /api/transcripts/suggestions/:id/approve**: Update to change status instead of migrating data
- No structural changes needed

### Frontend (`index.html`)
- Update references to `newFeatureSuggestions` to filter `features` where `status='pending'`
- Update feature filtering to use `status='active'` instead of `!is_suggestion`
- Update approval logic to call same endpoint (backend changes handle it)

## Testing Checklist
- [ ] Manually created features work correctly
- [ ] New feature suggestions are created with pending status
- [ ] Approving suggestions changes status to active
- [ ] Archived features don't show in main list
- [ ] Quotes/pain points are preserved during migration
- [ ] Transcript detail view shows suggestions correctly
- [ ] Feature detail view shows pain points correctly

## Rollback Plan
If migration fails:
1. Keep old tables (`transcript_feature_suggestions`, `feature_suggestion_quotes`)
2. Restore previous code from git
3. Drop new status column if needed
