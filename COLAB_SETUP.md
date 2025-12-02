# Google Colab Setup Guide

This guide will help you convert your Node.js/React YouTube to MP3 converter project to work in Google Colab.

## Overview

The original project uses:
- **Backend**: Node.js/Express server
- **Frontend**: React web interface
- **Downloader**: yt-dlp (Python tool called from Node.js)

The Colab version uses:
- **Pure Python** with yt-dlp directly
- **Jupyter Notebook** interface for file upload and processing
- **Google Colab** file system for storage

## Quick Start

### Option 1: Use the Jupyter Notebook (Recommended)

1. **Open Google Colab**: Go to [colab.research.google.com](https://colab.research.google.com)

2. **Upload the Notebook**:
   - Click "File" → "Upload notebook"
   - Upload `YouTube_MP3_Converter_Colab.ipynb`

3. **Run the Cells**:
   - The notebook is divided into steps
   - Run each cell in order (Shift+Enter)
   - Upload your CSV file when prompted
   - Wait for processing to complete
   - Download the zip file with all MP3s

### Option 2: Use the Python Script

1. **Upload the Script**:
   ```python
   # In Colab, upload colab_youtube_converter.py
   ```

2. **Install Dependencies**:
   ```python
   !pip install -U yt-dlp pandas
   ```

3. **Upload Your CSV**:
   ```python
   from google.colab import files
   uploaded = files.upload()
   # Note the filename
   ```

4. **Run the Script**:
   ```python
   import colab_youtube_converter
   colab_youtube_converter.process_csv('your_file.csv')
   ```

5. **Download Results**:
   ```python
   # Download zip file
   !zip -r /content/downloads/all_mp3s.zip /content/downloads/*.mp3
   files.download('/content/downloads/all_mp3s.zip')
   ```

## CSV Format

Your CSV file must have this structure:

```csv
LINKS
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0
```

- **Row 1**: Must contain the header `LINKS` (case-insensitive)
- **Row 2+**: YouTube video URLs (supports both youtube.com and youtu.be formats)

## Key Differences from Node.js Version

### 1. **No Web Server**
- The Node.js version runs an Express server
- Colab version runs directly in Python cells
- No need for separate frontend/backend

### 2. **File Upload**
- Node.js: React frontend with file input
- Colab: `files.upload()` from `google.colab` module

### 3. **File Storage**
- Node.js: Temporary files in `backend/temp/`
- Colab: Files stored in `/content/downloads/` (Colab's file system)

### 4. **Downloading Results**
- Node.js: Browser automatically downloads each MP3
- Colab: Use `files.download()` to download zip or individual files

### 5. **Progress Display**
- Node.js: Real-time React UI with status updates
- Colab: Console output with progress indicators

## Features Preserved

✅ CSV parsing with LINKS column detection  
✅ Sequential download processing (one at a time)  
✅ Rate limiting (1 second delay between downloads)  
✅ MP3 conversion at 192kbps quality  
✅ Video title extraction for filenames  
✅ Error handling and failed download tracking  
✅ Summary statistics  
✅ Automatic zip file creation  

## Code Structure Comparison

### Node.js Backend (`server.js`)
```javascript
// Express endpoints
app.post('/api/parse-csv', ...)
app.post('/api/download', ...)
// Uses subprocess to call yt-dlp
```

### Python Colab Version (`colab_youtube_converter.py`)
```python
# Direct function calls
parse_csv(csv_path)
download_video_to_mp3(url, output_dir, row_number)
# Uses subprocess to call yt-dlp directly
```

## Installation Requirements

The Colab version requires:
- **yt-dlp**: `pip install -U yt-dlp`
- **pandas**: `pip install pandas` (optional, for better CSV parsing)

Note: FFmpeg is automatically handled by yt-dlp in Colab environment.

## Troubleshooting

### "yt-dlp not found"
```python
!pip install -U yt-dlp
```

### "No 'LINKS' column found"
- Make sure your CSV has a header row with "LINKS" (case-insensitive)
- Check that the CSV file was uploaded correctly

### "Download failed" or "403 Forbidden"
- Update yt-dlp: `!pip install -U yt-dlp`
- Some videos may be restricted or unavailable
- Try again later (YouTube rate limiting)

### "File was not created"
- Check if the video URL is valid
- Some videos may be age-restricted or region-locked
- Check the error message for details

### Large Files
- Colab has storage limits
- Download files regularly to avoid running out of space
- Use the zip download feature to get all files at once

## Advantages of Colab Version

1. **No Local Setup**: Runs entirely in the cloud
2. **Free**: Google Colab is free to use
3. **No Node.js Required**: Pure Python solution
4. **Easy Sharing**: Share the notebook with others
5. **Automatic Updates**: yt-dlp updates easily with pip

## Limitations

1. **Session Timeout**: Colab sessions may timeout after inactivity
2. **Storage Limits**: Limited storage space (check Colab limits)
3. **No Real-time UI**: Console output instead of web interface
4. **File Management**: Need to manually download files

## Migration Checklist

- [x] CSV parsing functionality
- [x] YouTube link extraction
- [x] yt-dlp integration
- [x] MP3 conversion
- [x] Sequential processing
- [x] Error handling
- [x] Progress tracking
- [x] Summary statistics
- [x] File download capability

## Next Steps

1. Test with a small CSV file (2-3 links)
2. Verify MP3 quality and filenames
3. Process your full CSV file
4. Download the results

## Support

If you encounter issues:
1. Check that yt-dlp is up to date: `!pip install -U yt-dlp`
2. Verify your CSV format matches the required structure
3. Check YouTube video availability
4. Review error messages in the notebook output


