# YouTube to MP3 Batch Converter 🎵

A web application that allows you to batch convert YouTube videos to MP3 files by uploading a CSV file containing YouTube links.

**⚠️ Important:** This application uses `yt-dlp` for downloading, which is more reliable than other solutions and actively maintained to work around YouTube's restrictions.

![Preview](https://via.placeholder.com/800x400/0f0f0f/ff6b35?text=YT+to+MP3+Converter)

## ✨ Features

- **CSV Upload**: Upload a CSV file containing YouTube video links
- **Batch Processing**: Process multiple videos sequentially
- **Real-time Status**: Track progress of each download with live status updates
- **Cancel Support**: Stop the download queue at any time
- **Failed Downloads Tracking**: See which videos failed and why
- **Summary Popup**: View conversion statistics after processing
- **Browser Downloads**: MP3 files download directly to your browser

## 📋 CSV Format

Your CSV file should have this structure:

```csv
LINKS
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0
```

- **Row 1**: Must contain the header `LINKS` (case-insensitive)
- **Row 2+**: YouTube video URLs (supports both youtube.com and youtu.be formats)

## 🛠️ Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **Python 3** - Required for yt-dlp
3. **yt-dlp** - The YouTube downloader (more reliable than alternatives)
   ```bash
   pip install yt-dlp
   ```
   Or update to latest:
   ```bash
   pip install -U yt-dlp
   ```
4. **FFmpeg** - Required for audio conversion
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt install ffmpeg`
   - **Windows**: [Download](https://ffmpeg.org/download.html) and add to PATH

## 🚀 Installation & Setup

### 1. Clone/Download the project

```bash
cd youtube-mp3-downloader
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Start the Backend Server

```bash
cd ../backend
npm start
```

The backend will run on `http://localhost:3001`

### 5. Start the Frontend (in a new terminal)

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

### 6. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

## 📁 Project Structure

```
youtube-mp3-downloader/
├── backend/
│   ├── package.json       # Backend dependencies
│   ├── server.js          # Express server with download/conversion logic
│   └── temp/              # Temporary files (auto-created)
├── frontend/
│   ├── package.json       # Frontend dependencies
│   ├── vite.config.js     # Vite configuration
│   ├── index.html         # HTML entry point
│   └── src/
│       ├── main.jsx       # React entry point
│       ├── App.jsx        # Main application component
│       └── styles.css     # Styling
├── sample_youtube_links.csv  # Demo CSV file
└── README.md              # This file
```

## 🔧 How It Works

1. **CSV Parsing**: When you upload a CSV, the backend parses it to extract YouTube links
2. **Sequential Processing**: Videos are processed one at a time to avoid rate limiting
3. **Download**: Audio stream is downloaded from YouTube using ytdl-core
4. **Conversion**: FFmpeg converts the audio to MP3 format (192kbps)
5. **Browser Download**: The MP3 file is streamed to your browser for download

## 📊 Status Indicators

| Status | Icon | Description |
|--------|------|-------------|
| Pending | ○ | Waiting to be processed |
| Downloading... | ↓ | Currently downloading from YouTube |
| Converting... | ⟳ | Converting to MP3 format |
| Saved | ✓ | Successfully downloaded and saved |
| Failed | ✕ | Download or conversion failed |
| Cancelled | ◌ | Cancelled by user |

## ⚠️ Important Notes

- **Rate Limiting**: There's a 1-second delay between downloads to prevent rate limiting
- **Large Files**: Very long videos may take longer to process
- **Network**: Ensure stable internet connection for best results
- **Storage**: Temporary files are automatically cleaned up

## 🐛 Troubleshooting

### "yt-dlp not found"
Install yt-dlp:
```bash
pip install yt-dlp
```

### "FFmpeg not found"
Make sure FFmpeg is installed and accessible from the command line:
```bash
ffmpeg -version
```

### "403 Forbidden" or "Download failed"
This usually means YouTube is blocking requests. Try:
1. **Update yt-dlp** to the latest version:
   ```bash
   pip install -U yt-dlp
   ```
2. **Check if the video is available** - some videos are restricted or unavailable in your region
3. **Age-restricted videos** may require authentication (not currently supported)
4. **Wait and retry** - YouTube may temporarily rate-limit requests

### "Network error"
- Ensure the backend server is running on port 3001
- Check if both frontend and backend are running
- Make sure there's no VPN/proxy blocking YouTube

### "Sign in to confirm you're not a bot"
YouTube sometimes requires verification. Solutions:
1. Update yt-dlp: `pip install -U yt-dlp`
2. Try again later
3. Use cookies (advanced) - see yt-dlp documentation

## 📄 License

MIT License - Feel free to use and modify as needed.

## 🙏 Credits

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloading (actively maintained fork of youtube-dl)
- [Express](https://expressjs.com/) - Backend framework
- [React](https://reactjs.org/) - Frontend framework
- [Vite](https://vitejs.dev/) - Build tool
