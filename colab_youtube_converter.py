"""
YouTube to MP3 Batch Converter for Google Colab
================================================

This script processes CSV files containing YouTube links and downloads them as MP3 files.
Designed to run in Google Colab environment.

Usage in Colab:
1. Upload this file to Colab
2. Install dependencies: !pip install yt-dlp pandas
3. Upload your CSV file
4. Run the script with your CSV file path
"""

import os
import csv
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Tuple
import time

# Configuration
OUTPUT_DIR = "/content/downloads"  # Colab default download location
TEMP_DIR = "/content/temp"
AUDIO_QUALITY = "192K"  # MP3 quality


def setup_directories():
    """Create necessary directories if they don't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
    print(f"✅ Directories created: {OUTPUT_DIR}, {TEMP_DIR}")


def check_ytdlp():
    """Check if yt-dlp is installed"""
    try:
        result = subprocess.run(
            ["yt-dlp", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print(f"✅ yt-dlp installed: {result.stdout.strip()}")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    print("❌ yt-dlp not found. Installing...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-U", "yt-dlp"],
            check=True,
            timeout=120
        )
        print("✅ yt-dlp installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install yt-dlp: {e}")
        return False


def parse_csv(csv_path: str) -> List[Dict[str, str]]:
    """
    Parse CSV file and extract YouTube links
    
    Args:
        csv_path: Path to CSV file
        
    Returns:
        List of dictionaries with 'row' and 'link' keys
    """
    links = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Try to detect if pandas is available for better CSV handling
            try:
                import pandas as pd
                df = pd.read_csv(csv_path)
                
                # Find LINKS column (case-insensitive)
                link_column = None
                for col in df.columns:
                    if col.upper() == 'LINKS':
                        link_column = col
                        break
                
                if not link_column:
                    raise ValueError("No 'LINKS' column found in CSV")
                
                # Extract links
                row_number = 2  # Start from row 2 (row 1 is header)
                for idx, row in df.iterrows():
                    link = str(row[link_column]).strip()
                    if link and ('youtube.com' in link or 'youtu.be' in link):
                        links.append({
                            'row': row_number,
                            'link': link
                        })
                    row_number += 1
                    
            except ImportError:
                # Fallback to standard csv module
                reader = csv.DictReader(f)
                row_number = 2
                
                for record in reader:
                    # Find LINKS column (case-insensitive)
                    link_column = None
                    for key in record.keys():
                        if key.upper() == 'LINKS':
                            link_column = key
                            break
                    
                    if link_column and record[link_column]:
                        link = record[link_column].strip()
                        if link and ('youtube.com' in link or 'youtu.be' in link):
                            links.append({
                                'row': row_number,
                                'link': link
                            })
                    row_number += 1
        
        print(f"✅ Found {len(links)} YouTube links in CSV")
        return links
        
    except Exception as e:
        print(f"❌ Error parsing CSV: {e}")
        raise


def get_video_title(url: str) -> str:
    """Get video title from YouTube URL"""
    try:
        result = subprocess.run(
            ["yt-dlp", "--get-title", url],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            title = result.stdout.strip()
            # Clean filename: remove special characters
            title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_'))
            title = title.replace(' ', '_')[:50]  # Limit length
            return title
    except Exception as e:
        print(f"⚠️  Could not get title: {e}")
    
    return f"audio_{int(time.time())}"


def download_video_to_mp3(url: str, output_path: str, row_number: int) -> Tuple[bool, str]:
    """
    Download YouTube video and convert to MP3
    
    Args:
        url: YouTube URL
        output_path: Full path where MP3 should be saved
        row_number: Row number in CSV (for logging)
        
    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        print(f"\n📥 [{row_number}] Downloading: {url}")
        
        # Get video title for better filename
        title = get_video_title(url)
        final_output = os.path.join(OUTPUT_DIR, f"{title}.mp3")
        
        # yt-dlp command to extract audio and convert to MP3
        cmd = [
            "yt-dlp",
            "-x",                          # Extract audio
            "--audio-format", "mp3",       # Convert to MP3
            "--audio-quality", AUDIO_QUALITY,  # Quality
            "-o", final_output,            # Output path
            "--no-playlist",               # Don't download playlists
            "--no-warnings",               # Suppress warnings
            url
        ]
        
        print(f"🔧 Running: {' '.join(cmd)}")
        
        # Run yt-dlp
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Monitor progress
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output and '%' in output:
                print(f"\r⏳ [{row_number}] {output.strip()}", end='', flush=True)
        
        # Wait for completion
        return_code = process.poll()
        
        if return_code == 0:
            # Check if file was created (yt-dlp might add extension)
            if os.path.exists(final_output):
                file_size = os.path.getsize(final_output) / (1024 * 1024)  # MB
                print(f"\n✅ [{row_number}] Download complete: {title}.mp3 ({file_size:.2f} MB)")
                return True, f"Downloaded: {title}.mp3"
            else:
                # Check for files with similar names
                base_name = os.path.splitext(final_output)[0]
                for file in os.listdir(OUTPUT_DIR):
                    if file.startswith(os.path.basename(base_name)):
                        actual_path = os.path.join(OUTPUT_DIR, file)
                        if not file.endswith('.mp3'):
                            # Rename to .mp3
                            new_path = os.path.splitext(actual_path)[0] + '.mp3'
                            os.rename(actual_path, new_path)
                            file_size = os.path.getsize(new_path) / (1024 * 1024)
                            print(f"\n✅ [{row_number}] Download complete: {os.path.basename(new_path)} ({file_size:.2f} MB)")
                            return True, f"Downloaded: {os.path.basename(new_path)}"
                        else:
                            file_size = os.path.getsize(actual_path) / (1024 * 1024)
                            print(f"\n✅ [{row_number}] Download complete: {os.path.basename(actual_path)} ({file_size:.2f} MB)")
                            return True, f"Downloaded: {os.path.basename(actual_path)}"
                
                return False, "File was not created"
        else:
            error = process.stderr.read()
            print(f"\n❌ [{row_number}] Download failed: {error}")
            return False, f"Error: {error[:100]}"
            
    except subprocess.TimeoutExpired:
        return False, "Download timeout"
    except Exception as e:
        print(f"\n❌ [{row_number}] Error: {e}")
        return False, str(e)


def process_csv(csv_path: str, delay: float = 1.0):
    """
    Process all YouTube links from CSV file
    
    Args:
        csv_path: Path to CSV file
        delay: Delay between downloads in seconds (to avoid rate limiting)
    """
    print("=" * 60)
    print("YouTube to MP3 Batch Converter")
    print("=" * 60)
    
    # Setup
    setup_directories()
    
    if not check_ytdlp():
        print("❌ Cannot proceed without yt-dlp")
        return
    
    # Parse CSV
    try:
        links = parse_csv(csv_path)
    except Exception as e:
        print(f"❌ Failed to parse CSV: {e}")
        return
    
    if not links:
        print("⚠️  No YouTube links found in CSV")
        return
    
    # Process each link
    print(f"\n🚀 Starting batch download of {len(links)} videos...\n")
    
    results = {
        'total': len(links),
        'success': 0,
        'failed': 0,
        'failed_links': []
    }
    
    for i, item in enumerate(links, 1):
        success, message = download_video_to_mp3(
            item['link'],
            OUTPUT_DIR,
            item['row']
        )
        
        if success:
            results['success'] += 1
        else:
            results['failed'] += 1
            results['failed_links'].append({
                'row': item['row'],
                'link': item['link'],
                'error': message
            })
        
        # Delay between downloads to avoid rate limiting
        if i < len(links):
            time.sleep(delay)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 Processing Complete")
    print("=" * 60)
    print(f"Total: {results['total']}")
    print(f"✅ Success: {results['success']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"📁 Output directory: {OUTPUT_DIR}")
    
    if results['failed_links']:
        print("\n⚠️  Failed Downloads:")
        for item in results['failed_links']:
            print(f"  Row {item['row']}: {item['link']}")
            print(f"    Error: {item['error']}")
    
    # Create download zip (optional, for Colab)
    try:
        import zipfile
        zip_path = os.path.join(OUTPUT_DIR, "all_mp3s.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for file in os.listdir(OUTPUT_DIR):
                if file.endswith('.mp3'):
                    zipf.write(
                        os.path.join(OUTPUT_DIR, file),
                        file
                    )
        print(f"\n📦 Created zip file: {zip_path}")
    except Exception as e:
        print(f"\n⚠️  Could not create zip file: {e}")


# Main execution for Colab
if __name__ == "__main__":
    # Example usage - modify csv_path to your uploaded file
    csv_path = "/content/sample_youtube_links.csv"  # Change this to your CSV file path
    
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        print("\n📝 Usage:")
        print("  1. Upload your CSV file to Colab")
        print("  2. Update csv_path variable or pass as argument:")
        print("     process_csv('/content/your_file.csv')")
        sys.exit(1)
    
    process_csv(csv_path)


