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

### Getting Started

1. Open `interview-analyzer.html` in your web browser
2. On first use, you'll be prompted to enter your Claude API key (get one at https://console.anthropic.com/)
3. Paste your interview transcript in the first text area
4. Add your feature list (one feature per line) in the second text area
5. Click "Analyze Transcript" to process
6. View the results showing pain points with quotes, feature mappings, and priority rankings

### Multiple Transcripts

- After analyzing one transcript, paste another and analyze again
- Results accumulate and show trends across all interviews
- Feature priority ranking updates automatically

### Exporting Results

- Click "Export Results" button
- Choose between CSV (for spreadsheets) or Text format (for reports)

### Privacy & Security

- Your Claude API key is stored in browser localStorage only
- All data stays in your browser except API calls to Claude
- Click "Clear All" to reset data while keeping your API key saved

## Technical Details

- Pure HTML/CSS/JavaScript (no build required)
- Uses Claude 3.5 Sonnet via Anthropic API
- Mobile-responsive and iPad-optimized
