# How to Run YouTube to MP3 Converter in Google Colab

## Quick Start Guide

### Step 1: Open Google Colab

1. Go to [https://colab.research.google.com](https://colab.research.google.com)
2. Sign in with your Google account (if not already signed in)

### Step 2: Upload the Notebook

**Option A: Upload from your computer**
1. Click **File** → **Upload notebook**
2. Select `YouTube_MP3_Converter_Colab.ipynb` from your project folder
3. Wait for upload to complete

**Option B: Open from GitHub (if you push to GitHub)**
1. Click **File** → **Open notebook**
2. Go to **GitHub** tab
3. Enter your repository URL

### Step 3: Run the Notebook

The notebook is organized into cells. Run each cell **in order** by clicking the play button (▶) or pressing **Shift + Enter**.

#### Cell 1: Install Dependencies
- This installs `yt-dlp` and `pandas`
- Click the play button or press **Shift + Enter**
- Wait for installation to complete (you'll see "✅ Dependencies installed")

#### Cell 2: Upload Your CSV File
- Click the play button
- A file upload dialog will appear
- Select your CSV file containing YouTube links
- Wait for upload to complete
- You'll see "✅ CSV file uploaded: [filename]"

#### Cell 3: Load Converter Functions
- This cell contains all the conversion logic
- Click the play button
- You'll see "✅ Converter functions loaded"

#### Cell 4: Process Your CSV
- This is the main processing cell
- Click the play button
- The script will:
  - Parse your CSV file
  - Download each YouTube video
  - Convert to MP3 format
  - Show progress for each download
- **This may take a while** depending on the number of videos

#### Cell 5: Download All MP3s as Zip
- After processing completes, run this cell
- It creates a zip file with all MP3s
- The zip file will automatically download to your computer
- You'll see "✅ Created zip file with X MP3 files"

#### Cell 6: Download Individual Files (Optional)
- If you prefer individual files instead of a zip
- Run this cell to download each MP3 separately

## Example Workflow

```
1. Open Colab → Upload notebook
2. Run Cell 1 (Install) → Wait for ✅
3. Run Cell 2 (Upload CSV) → Select your CSV file
4. Run Cell 3 (Load functions) → Wait for ✅
5. Run Cell 4 (Process) → Wait for all downloads (this takes time!)
6. Run Cell 5 (Download zip) → Get your MP3s!
```

## CSV File Format

Your CSV file must look like this:

```csv
LINKS
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0
```

**Important:**
- First row must be `LINKS` (case-insensitive)
- Each YouTube URL on a new row
- Supports both `youtube.com` and `youtu.be` formats

## What You'll See

During processing, you'll see output like:

```
📥 [2] Downloading: https://www.youtube.com/watch?v=...
⏳ [2] [download] 45.2% of 3.21MiB
✅ [2] Download complete: Video_Title.mp3 (2.15 MB)
```

At the end, you'll see a summary:

```
📊 Processing Complete
Total: 10
✅ Success: 9
❌ Failed: 1
```

## Troubleshooting

### "yt-dlp not found"
- The first cell should install it automatically
- If it fails, run: `!pip install -U yt-dlp` in a new cell

### "No CSV file found"
- Make sure you ran Cell 2 and uploaded a CSV file
- Check that the file has `.csv` extension

### "No 'LINKS' column found"
- Your CSV must have a header row with "LINKS"
- Check your CSV file format

### Download fails for some videos
- Some videos may be restricted or unavailable
- Check the error message in the output
- Try updating yt-dlp: `!pip install -U yt-dlp`

### Session timeout
- Colab sessions timeout after inactivity
- If this happens, re-run the cells (your CSV upload will be lost, re-upload it)

## Tips

1. **Start Small**: Test with 2-3 videos first before processing large batches
2. **Be Patient**: Each video takes time to download and convert
3. **Check Progress**: Watch the output to see which videos are processing
4. **Download Regularly**: Download your files before the Colab session ends
5. **Save Your Work**: Consider saving the notebook to Google Drive

## Alternative: Using the Python Script Directly

If you prefer not to use the notebook, you can also use the Python script:

```python
# In a Colab cell:
!pip install -U yt-dlp pandas

# Upload your CSV
from google.colab import files
uploaded = files.upload()
csv_file = list(uploaded.keys())[0]  # Get first uploaded file

# Import and run
import colab_youtube_converter
colab_youtube_converter.process_csv(csv_file)

# Download results
import zipfile
import os
zip_path = "/content/downloads/all_mp3s.zip"
with zipfile.ZipFile(zip_path, 'w') as zipf:
    for file in os.listdir("/content/downloads"):
        if file.endswith('.mp3'):
            zipf.write(f"/content/downloads/{file}", file)
files.download(zip_path)
```

## Need Help?

- Check the `COLAB_SETUP.md` file for detailed information
- Review error messages in the notebook output
- Make sure your CSV format is correct
- Verify YouTube links are accessible

