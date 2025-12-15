# Quick Start Guide

Get the Interview Analysis Tool running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Configure API Key

Edit `backend/.env` and add your Claude API key:

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Your actual API key here
```

Get your API key from: https://console.anthropic.com/

## Step 3: Start the Backend

```bash
npm run dev
```

You should see:
```
🚀 Server running on: http://localhost:3001
```

## Step 4: Open the Frontend

Open `interview-analyzer.html` in your web browser, or navigate to:
```
http://localhost:3001/interview-analyzer.html
```

## Step 5: Analyze Your First Transcript

1. **Paste an interview transcript** in the first text box
2. **Add your features** (one per line) in the second text box
3. **Click "Analyze Transcript"**
4. **View results** showing pain points and feature mappings!

---

## Troubleshooting

**Backend won't start?**
- Make sure port 3001 is available
- Check that your API key is correct in `.env`

**Frontend can't connect?**
- Make sure backend is running
- Check the 🐛 Debug panel in the bottom right

**Need help?**
- Check the full [README.md](README.md) for detailed documentation
- Look at backend logs for error messages

---

## Project Structure

```
Product-Thing/
├── backend/
│   ├── server.js              # Backend server
│   ├── routes/analyze.js      # API endpoints
│   ├── .env                   # Your API key (DO NOT COMMIT)
│   └── package.json
└── interview-analyzer.html    # Frontend app
```

---

## Next Steps

- ✅ Analyze multiple transcripts to build insights
- ✅ Export results as CSV or Text
- ✅ See feature priority rankings
- ✅ Share with your team

Enjoy analyzing your customer interviews! 🎯
