# Product-Thing
The ultimate product management tool for converting customer insights into impact

## Interview Analysis Tool

An interactive web app that helps analyze customer interview transcripts using Claude AI to extract pain points and map them to product features.

### Features

- **Transcript Analysis**: Paste interview transcripts and get AI-powered pain point extraction
- **Feature Mapping**: Automatically maps pain points to your predefined feature list
- **Cumulative Results**: Analyze multiple transcripts and see aggregated insights
- **Priority Ranking**: Features are ranked by frequency of pain points addressed
- **Export Options**: Download results as CSV or text format
- **iPad Optimized**: Clean, professional interface designed for desktop and tablet use
- **Secure Backend**: API keys stored securely on the server, not in the browser

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher) - [Download here](https://nodejs.org/)
- Claude API key - [Get one here](https://console.anthropic.com/)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Product-Thing
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Edit backend/.env and add your Claude API key
   ANTHROPIC_API_KEY=your_actual_api_key_here
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=*
   ```

4. **Start the backend server**
   ```bash
   npm run dev
   # For production: npm start
   ```

   You should see:
   ```
   ╔════════════════════════════════════════════════════════╗
   ║   Interview Analyzer Backend Server                   ║
   ╚════════════════════════════════════════════════════════╝

   🚀 Server running on: http://localhost:3001
   ```

5. **Open the frontend**
   - Open `interview-analyzer.html` in your web browser
   - Or use the backend to serve it: navigate to `http://localhost:3001/interview-analyzer.html`

---

## 📖 Usage Guide

### Analyzing Transcripts

1. **Paste Interview Transcript**: Copy and paste your customer interview into the first text area
2. **Add Feature List**: List your predefined features (one per line) in the second text area
3. **Click "Analyze Transcript"**: The backend will process your transcript using Claude AI
4. **View Results**: See pain points with direct quotes and feature mappings
5. **Analyze More**: Add additional transcripts to build cumulative insights

### Multiple Transcripts

- After analyzing one transcript, paste another and analyze again
- Results accumulate and show trends across all interviews
- Feature priority ranking updates automatically based on all analyzed transcripts

### Exporting Results

- Click "Export Results" button
- Choose between:
  - **CSV format**: For spreadsheets (Excel, Google Sheets)
  - **Text format**: For reports and documentation

---

## 🏗️ Architecture

### Backend (Node.js + Express)

```
backend/
├── server.js              # Main server file
├── routes/
│   └── analyze.js         # API endpoint for transcript analysis
├── .env                   # Environment variables (DO NOT COMMIT)
├── .env.example           # Template for environment variables
└── package.json           # Dependencies
```

**Key Endpoints:**
- `GET /health` - Health check endpoint
- `POST /api/analyze` - Analyze transcript endpoint
- `GET /api/analyze/test` - Test endpoint

### Frontend (HTML/CSS/JavaScript)

- Single-page application (`interview-analyzer.html`)
- No build process required
- Connects to backend API for analysis
- Includes debug panel for troubleshooting

### API Flow

```
Frontend → Backend → Claude API → Backend → Frontend
   ↓          ↓                       ↓         ↓
 User      Secure API Key         Analysis   Results
 Input     Management             Processing  Display
```

---

## 🔒 Security

- **API keys** stored securely in backend `.env` file (never exposed to browser)
- **CORS** configured to control which origins can access the API
- **Input validation** on backend to prevent malicious requests
- **Error handling** to prevent information leakage
- **.gitignore** configured to never commit sensitive files

---

## 🛠️ Development

### Running in Development Mode

```bash
cd backend
npm run dev  # Uses nodemon for auto-restart on changes
```

### Project Structure

```
Product-Thing/
├── backend/                    # Backend server
│   ├── server.js
│   ├── routes/
│   │   └── analyze.js
│   ├── .env
│   ├── .env.example
│   └── package.json
├── interview-analyzer.html     # Frontend application
├── README.md
└── .gitignore
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Claude API key | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment (development/production) | development |
| `CORS_ORIGIN` | Allowed CORS origins | * |

---

## 🚢 Deployment

### Quick Deploy to Render (Recommended for iPad Users)

**Perfect for iPad users!** Deploy in 5 minutes with free tier.

1. **Sign up at [Render](https://render.com)** (free)
2. **Create New Web Service** → Connect this GitHub repository
3. **Configure**:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Add Environment Variable: `ANTHROPIC_API_KEY=your-key-here`
4. **Deploy** - Get your backend URL: `https://your-app.onrender.com`
5. **Update frontend** to use your backend URL

📖 **Detailed Guide**: See [DEPLOY-RENDER.md](DEPLOY-RENDER.md) for step-by-step instructions with screenshots.

### Other Backend Deployment Options

- **Heroku**: Easy deployment with `git push heroku main` ($7/month minimum)
- **Railway**: Modern platform with automatic deployments ($5/month credit)
- **Fly.io**: Global edge network with free tier
- **AWS/GCP/Azure**: For enterprise deployments

### Frontend Deployment Options

- **Netlify**: Drag-and-drop deployment (free tier)
- **Vercel**: Optimized for static sites (free tier)
- **GitHub Pages**: Free hosting for public repos
- **Same server as backend**: Serve from Express static middleware (recommended)

### Production Checklist

- [ ] Set `NODE_ENV=production` in backend
- [ ] Configure proper `CORS_ORIGIN` (not `*`)
- [ ] Use HTTPS for both frontend and backend
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Update frontend `API_BASE_URL` to production backend URL

---

## 🐛 Troubleshooting

### Backend won't start
- Check that port 3001 is not in use: `lsof -i :3001`
- Verify `.env` file exists with valid `ANTHROPIC_API_KEY`
- Run `npm install` to ensure dependencies are installed

### Frontend can't connect to backend
- Verify backend is running on `http://localhost:3001`
- Check browser console for CORS errors
- Click the "🐛 Debug" button in the UI for detailed logs

### Analysis fails
- Check backend logs for error messages
- Verify Anthropic API key is valid
- Ensure transcript and features are not empty
- Check the debug panel for detailed error information

### CORS errors
- Update `CORS_ORIGIN` in backend `.env`
- Restart backend after changing `.env`
- For development, use `CORS_ORIGIN=*`

---

## 📊 API Documentation

### POST /api/analyze

Analyze a customer interview transcript.

**Request Body:**
```json
{
  "transcript": "Customer interview text...",
  "features": "Feature 1\nFeature 2\nFeature 3"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "painPoints": [
      {
        "painPoint": "Description of pain point",
        "quote": "Exact quote from transcript",
        "mappedFeatures": ["Feature 1", "Feature 2"]
      }
    ]
  },
  "metadata": {
    "transcriptLength": 1234,
    "painPointsFound": 5,
    "timestamp": "2025-12-11T00:00:00.000Z"
  }
}
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📝 License

ISC

---

## 💡 Future Enhancements

- [ ] Database integration for persistent storage
- [ ] User authentication and accounts
- [ ] Team collaboration features
- [ ] Advanced analytics and visualizations
- [ ] Export to more formats (PDF, JSON, etc.)
- [ ] Batch processing of multiple transcripts
- [ ] Custom AI prompts and analysis templates
