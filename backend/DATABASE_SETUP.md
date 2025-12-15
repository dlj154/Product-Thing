# Database Setup Guide

This guide explains how to set up PostgreSQL for feature persistence in the Interview Analysis Tool.

## Overview

The application now supports **optional** database persistence for predefined features. When configured, features entered by Product Managers are automatically saved and restored between sessions.

**Note:** The database is completely optional. The app works without it, but features won't persist.

## Features

- ✅ Auto-save features as you type (1-second debounce)
- ✅ Auto-load saved features on page load
- ✅ Visual feedback for save status
- ✅ Clear all data including database
- ✅ Works without database (graceful degradation)

## Setup Options

### Option 1: PostgreSQL on Render (Recommended for Production)

**Cost:** FREE tier available (1GB storage)

#### Steps:

1. **Create PostgreSQL database on Render:**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "PostgreSQL"
   - Choose:
     - Name: `interview-analyzer-db`
     - Region: Same as your backend server
     - Plan: **Free** (or paid if needed)
   - Click "Create Database"

2. **Get connection string:**
   - Wait for database to provision (1-2 minutes)
   - Copy the **Internal Database URL** from the database page
   - Format: `postgresql://user:pass@host:port/database`

3. **Add to backend environment:**
   - In Render backend service settings
   - Go to "Environment" tab
   - Add environment variable:
     ```
     DATABASE_URL=<paste-internal-database-url>
     ```
   - Click "Save Changes"
   - Backend will auto-redeploy

4. **Verify:**
   - Check backend logs for: `✓ Database ready`
   - Check: `💾 Database: Connected` in startup message

### Option 2: Local PostgreSQL (Development)

**Requirements:** PostgreSQL installed locally

#### Steps:

1. **Install PostgreSQL:**
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql

   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create database:**
   ```bash
   # Access PostgreSQL
   psql postgres

   # Create database
   CREATE DATABASE interview_analyzer;

   # Create user (optional)
   CREATE USER analyzer_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE interview_analyzer TO analyzer_user;

   # Exit
   \q
   ```

3. **Configure backend:**
   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `.env` and add:
   ```
   DATABASE_URL=postgresql://analyzer_user:your_password@localhost:5432/interview_analyzer
   ```

4. **Start backend:**
   ```bash
   npm run dev
   ```

5. **Verify:**
   - Look for: `✓ Database ready`
   - Check logs: `💾 Database: Connected`

### Option 3: Other PostgreSQL Providers

The app works with any PostgreSQL provider. Simply set the `DATABASE_URL`:

**Supabase:**
```
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/postgres
```

**Heroku Postgres:**
```
DATABASE_URL=postgres://[user]:[password]@[host]:5432/[database]
```

**Railway:**
```
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/railway
```

**AWS RDS:**
```
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/[database]
```

## Database Schema

The application automatically creates this schema on startup:

```sql
CREATE TABLE IF NOT EXISTS features (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  feature_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_features_user_id ON features(user_id);
```

## API Endpoints

Once configured, these endpoints are available:

### GET `/api/features`
Retrieve saved features
```bash
curl https://your-backend.onrender.com/api/features
```

**Response:**
```json
{
  "success": true,
  "features": ["Email notifications", "Dashboard analytics"],
  "count": 2
}
```

### POST `/api/features`
Save features (replaces existing)
```bash
curl -X POST https://your-backend.onrender.com/api/features \
  -H "Content-Type: application/json" \
  -d '{"features": ["Feature 1", "Feature 2"]}'
```

**Response:**
```json
{
  "success": true,
  "message": "Features saved successfully",
  "count": 2
}
```

### DELETE `/api/features`
Delete all features
```bash
curl -X DELETE https://your-backend.onrender.com/api/features
```

**Response:**
```json
{
  "success": true,
  "message": "Features deleted successfully",
  "count": 2
}
```

## User Experience

### With Database Configured:
1. User types features in textarea
2. After 1 second of no typing, features auto-save
3. Visual feedback: "Saved X features"
4. On page refresh, features automatically load
5. "Clear All" button deletes from database

### Without Database:
1. User types features in textarea
2. No save status shown
3. Features work for current session only
4. On page refresh, features are lost

## Troubleshooting

### Database connection fails
**Symptom:** `⚠️ Database initialization failed`

**Solutions:**
- Verify `DATABASE_URL` is correct
- Check database is running
- Ensure network access (firewall, security groups)
- Check database credentials

### Features not saving
**Symptom:** Save status shows errors

**Check:**
1. Database connection established at startup
2. Backend logs for errors
3. Browser console for fetch errors
4. CORS is allowing requests

### Features not loading on refresh
**Verify:**
1. Features were actually saved (check "Saved X features" message)
2. Database has data: `SELECT * FROM features;`
3. No console errors on page load

## Security Notes

- Default user_id is 'default' (single-user mode)
- For multi-user: Add authentication and pass user_id
- Use SSL in production (DATABASE_URL with `sslmode=require`)
- Render's internal URLs are automatically encrypted

## Cost Estimates

| Provider | Free Tier | Limits |
|----------|-----------|--------|
| **Render** | ✅ Yes | 1GB storage, 97 hours/month |
| **Supabase** | ✅ Yes | 500MB, 50K MAU |
| **Railway** | ⚠️ Limited | $5 free credit |
| **Heroku** | ❌ No | Paid only |

**Recommendation:** Render Free tier is sufficient for small teams.

## Backup

**Render:**
- Free tier: No automated backups
- Paid: Daily automated backups

**Manual backup:**
```bash
pg_dump $DATABASE_URL > backup.sql
```

**Restore:**
```bash
psql $DATABASE_URL < backup.sql
```

## Support

For issues:
1. Check backend logs for error messages
2. Verify DATABASE_URL format
3. Test connection with: `psql $DATABASE_URL`
4. Check Render database status page
