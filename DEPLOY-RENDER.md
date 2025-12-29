# Deploy to Render - Step by Step Guide

This guide will help you deploy the Interview Analysis Tool backend to Render, making it accessible from your iPad.

## Prerequisites

- [x] GitHub repository with your code (already done!)
- [ ] Render account (free) - [Sign up here](https://render.com)
- [ ] Anthropic API key - [Get one here](https://console.anthropic.com/)

---

## Method 1: One-Click Deploy (Easiest)

### Step 1: Push to GitHub
Your code should already be pushed to GitHub. Verify at:
```
https://github.com/dlj154/Product-Thing
```

### Step 2: Deploy to Render

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign up or log in (can use GitHub account)

2. **Create New Web Service**
   - Click **"New +"** button
   - Select **"Web Service"**

3. **Connect Repository**
   - Select **"Build and deploy from a Git repository"**
   - Click **"Connect account"** to link GitHub
   - Find and select your repository: `dlj154/Product-Thing`
   - Select branch: `claude/backend-server-setup-01JuLmJbJA7eLKomyMNsVarF`

4. **Configure Service**
   ```
   Name: interview-analyzer-backend
   Region: Oregon (US West) - or closest to you
   Branch: claude/backend-server-setup-01JuLmJbJA7eLKomyMNsVarF
   Root Directory: (leave empty)
   Runtime: Node
   Build Command: cd backend && npm install
   Start Command: cd backend && npm start
   Plan: Free
   ```

5. **Add Environment Variables**
   Click **"Advanced"** and add these environment variables:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `CORS_ORIGIN` | `*` |
   | `ANTHROPIC_API_KEY` | `your-actual-api-key-here` |

   ⚠️ **Important**: Replace `your-actual-api-key-here` with your real Claude API key!

6. **Deploy**
   - Click **"Create Web Service"**
   - Wait 2-3 minutes for deployment to complete
   - You'll see build logs in real-time

### Step 3: Get Your Backend URL

Once deployed, Render will give you a URL like:
```
https://interview-analyzer-backend.onrender.com
```

**Test it:**
```
https://interview-analyzer-backend.onrender.com/health
```

You should see:
```json
{
  "status": "ok",
  "message": "Interview Analyzer Backend is running",
  "timestamp": "2025-12-11T..."
}
```

---

## Method 2: Using render.yaml (Alternative)

If you have a `render.yaml` file in your repo:

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your repository
4. Render will auto-detect `render.yaml`
5. Add your `ANTHROPIC_API_KEY` in the environment variables
6. Click **"Apply"**

---

## Step 4: Update Frontend to Use Deployed Backend

You have two options:

### Option A: Deploy Frontend to Render (Recommended)

1. **Create Static Site on Render**
   - In Render Dashboard, click **"New +"** → **"Static Site"**
   - Connect same repository
   - Configure:
     ```
     Name: interview-analyzer-frontend
     Branch: claude/backend-server-setup-01JuLmJbJA7eLKomyMNsVarF
     Build Command: (leave empty)
     Publish Directory: .
     ```

2. **Your frontend will be at:**
   ```
   https://interview-analyzer-frontend.onrender.com
   ```

3. **Update the frontend code** to use your backend URL:

   Edit `index.html` line ~618-620:
   ```javascript
   const API_BASE_URL = 'https://interview-analyzer-backend.onrender.com';
   ```

### Option B: Use Frontend Locally (iPad)

1. Download `index.html` to your iPad
2. Edit line ~618-620 in a text editor app to add your backend URL:
   ```javascript
   const API_BASE_URL = 'https://interview-analyzer-backend.onrender.com';
   ```
3. Save and open in Safari

---

## Step 5: Test Your Deployed App

1. **Open frontend** (deployed or local)
2. **Add a test transcript** and features
3. **Click "Analyze Transcript"**
4. **Check results** - you should see pain points extracted!

---

## Render Free Tier Details

✅ **What's Included (Free):**
- 750 hours/month of runtime
- Auto-deploy from GitHub
- Free SSL certificate (HTTPS)
- Automatic restarts

⚠️ **Limitations:**
- Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- 512 MB RAM

💡 **Tip**: If the backend is sleeping, the first analysis will be slow. Subsequent ones will be fast!

---

## Updating Your Deployment

When you make changes:

1. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Update backend"
   git push
   ```

2. **Render auto-deploys** - just wait 2-3 minutes!

---

## Troubleshooting

### Backend Won't Start
- Check **Logs** tab in Render dashboard
- Verify `ANTHROPIC_API_KEY` is set correctly
- Ensure `Start Command` is: `cd backend && npm start`

### Frontend Can't Connect
- Verify backend URL is correct in frontend code
- Check backend `/health` endpoint is responding
- Look at browser console (Safari Dev Tools) for errors
- Check the 🐛 Debug panel in the UI

### API Key Errors
- In Render dashboard, go to **Environment**
- Click **Edit** on `ANTHROPIC_API_KEY`
- Update with correct key
- Save - service will auto-restart

### Backend Sleeping (Slow First Request)
- This is normal on free tier
- Upgrade to Starter ($7/month) for always-on
- Or make a request every 10 minutes to keep it awake

---

## Cost Breakdown

| Tier | Cost | Benefits |
|------|------|----------|
| **Free** | $0/month | Perfect for testing, spins down after 15min |
| **Starter** | $7/month | Always on, no spin-down, faster |
| **Standard** | $25/month | More RAM, better for production |

**Recommendation**: Start with Free tier. Upgrade to Starter ($7/month) if you use it daily.

---

## Next Steps

Once deployed:

- ✅ Access from your iPad anywhere
- ✅ Share with your team (send them the URL)
- ✅ No need for local server
- ✅ Automatic updates when you push to GitHub
- ✅ Free SSL certificate (HTTPS)

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **This Repo Issues**: Check the GitHub repository issues

Enjoy analyzing interviews from your iPad! 🎉
