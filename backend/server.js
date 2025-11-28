/**
 * YouTube to MP3 Converter Backend Server
 * 
 * This server handles:
 * 1. CSV file uploads containing YouTube links
 * 2. Sequential downloading of YouTube videos using yt-dlp
 * 3. Conversion to MP3 format
 * 4. Streaming MP3 files back to the client
 * 
 * Uses yt-dlp (Python) which is more reliable than ytdl-core
 * for bypassing YouTube's restrictions
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Create temp directory for processing files
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Store for tracking cancellation requests
const cancelledSessions = new Set();

// Store for active download processes (to kill on cancel)
const activeProcesses = new Map();

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

/**
 * Check if yt-dlp is installed
 */
app.get('/api/check-ytdlp', async (req, res) => {
  try {
    const { stdout } = await execPromise('yt-dlp --version');
    res.json({ installed: true, version: stdout.trim() });
  } catch (error) {
    res.json({ installed: false, error: 'yt-dlp not found. Please install it: pip install yt-dlp' });
  }
});

/**
 * Parse CSV file and extract YouTube links
 * POST /api/parse-csv
 * 
 * Expects: multipart form data with 'csvFile' field
 * Returns: Array of { row: number, link: string }
 */
app.post('/api/parse-csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const links = [];

    // Parse CSV content
    const parser = parse(csvContent, {
      columns: true,  // Use first row as headers
      skip_empty_lines: true,
      trim: true
    });

    let rowNumber = 2; // Start from row 2 (row 1 is header)

    for await (const record of parser) {
      // Look for 'LINKS' column (case-insensitive)
      const linkColumn = Object.keys(record).find(
        key => key.toUpperCase() === 'LINKS'
      );

      if (linkColumn && record[linkColumn]) {
        const link = record[linkColumn].trim();
        // Validate it looks like a YouTube URL
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
          links.push({
            row: rowNumber,
            link: link
          });
        }
      }
      rowNumber++;
    }

    res.json({ 
      success: true, 
      links: links,
      totalLinks: links.length
    });

  } catch (error) {
    console.error('CSV parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to parse CSV file',
      details: error.message 
    });
  }
});

/**
 * Get video info (title, duration) without downloading
 * GET /api/video-info?url=...
 */
app.get('/api/video-info', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Use yt-dlp to get video info
    const { stdout } = await execPromise(
      `yt-dlp --dump-json --no-download "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    
    const info = JSON.parse(stdout);
    
    res.json({
      success: true,
      title: info.title,
      duration: info.duration,
      author: info.uploader || info.channel,
      thumbnail: info.thumbnail
    });

  } catch (error) {
    console.error('Video info error:', error);
    res.status(500).json({ 
      error: 'Failed to get video info',
      details: error.message 
    });
  }
});

/**
 * Download and convert a single YouTube video to MP3
 * POST /api/download
 * 
 * Body: { url: string, sessionId: string }
 * Returns: MP3 file stream
 */
app.post('/api/download', async (req, res) => {
  const { url, sessionId } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const outputTemplate = path.join(TEMP_DIR, `audio_${timestamp}`);
  const expectedMp3 = `${outputTemplate}.mp3`;

  let downloadProcess = null;

  try {
    // Check if session was cancelled
    if (cancelledSessions.has(sessionId)) {
      return res.status(499).json({ error: 'Download cancelled by user' });
    }

    console.log(`\n📥 Starting download: ${url}`);

    // First, get the video title for the filename
    let videoTitle = `audio_${timestamp}`;
    try {
      const { stdout } = await execPromise(
        `yt-dlp --get-title "${url}"`,
        { timeout: 30000 }
      );
      videoTitle = stdout.trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '_')     // Replace spaces with underscores
        .substring(0, 50);        // Limit length
      console.log(`📋 Video title: ${videoTitle}`);
    } catch (e) {
      console.log('⚠️ Could not get title, using default');
    }

    // Check cancellation again
    if (cancelledSessions.has(sessionId)) {
      return res.status(499).json({ error: 'Download cancelled by user' });
    }

    // Download and convert to MP3 using yt-dlp
    // yt-dlp handles both downloading and conversion
    await new Promise((resolve, reject) => {
      const args = [
        '-x',                          // Extract audio
        '--audio-format', 'mp3',       // Convert to MP3
        '--audio-quality', '192K',     // 192kbps quality
        '-o', expectedMp3,             // Output path
        '--no-playlist',               // Don't download playlists
        '--no-warnings',               // Suppress warnings
        '--progress',                  // Show progress
        url
      ];

      console.log(`🔧 Running: yt-dlp ${args.join(' ')}`);

      downloadProcess = spawn('yt-dlp', args);
      
      // Store process reference for potential cancellation
      if (sessionId) {
        activeProcesses.set(sessionId, downloadProcess);
      }

      let stderr = '';

      downloadProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('%')) {
          process.stdout.write(`\r⏳ ${output.trim()}`);
        }
      });

      downloadProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      downloadProcess.on('close', (code) => {
        activeProcesses.delete(sessionId);
        
        if (code === 0) {
          console.log('\n✅ Download complete');
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        }
      });

      downloadProcess.on('error', (err) => {
        activeProcesses.delete(sessionId);
        reject(err);
      });
    });

    // Check if file exists
    if (!fs.existsSync(expectedMp3)) {
      // Sometimes yt-dlp adds extra extension, let's check for that
      const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(`audio_${timestamp}`));
      if (files.length > 0) {
        const actualFile = path.join(TEMP_DIR, files[0]);
        if (actualFile !== expectedMp3) {
          fs.renameSync(actualFile, expectedMp3);
        }
      } else {
        throw new Error('MP3 file was not created');
      }
    }

    // Check cancellation before sending
    if (cancelledSessions.has(sessionId)) {
      cleanup(expectedMp3);
      return res.status(499).json({ error: 'Download cancelled by user' });
    }

    // Set response headers for file download
    const filename = `${videoTitle}.mp3`;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Filename', encodeURIComponent(filename));

    // Get file size for Content-Length
    const stat = fs.statSync(expectedMp3);
    res.setHeader('Content-Length', stat.size);

    console.log(`📤 Sending file: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

    // Stream the MP3 file to client
    const fileStream = fs.createReadStream(expectedMp3);
    fileStream.pipe(res);

    // Cleanup temp file after streaming
    fileStream.on('end', () => {
      console.log('✅ File sent successfully');
      cleanup(expectedMp3);
    });

    fileStream.on('error', (err) => {
      console.error('❌ Stream error:', err);
      cleanup(expectedMp3);
    });

  } catch (error) {
    console.error('❌ Download error:', error.message);
    
    // Kill the process if still running
    if (downloadProcess && !downloadProcess.killed) {
      downloadProcess.kill();
    }
    
    cleanup(expectedMp3);
    
    // Send error response if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to download/convert video',
        details: error.message 
      });
    }
  }
});

/**
 * Cancel a download session
 * POST /api/cancel
 */
app.post('/api/cancel', (req, res) => {
  const { sessionId } = req.body;
  
  if (sessionId) {
    cancelledSessions.add(sessionId);
    
    // Kill any active process for this session
    const process = activeProcesses.get(sessionId);
    if (process && !process.killed) {
      console.log(`🛑 Killing download process for session: ${sessionId}`);
      process.kill('SIGTERM');
    }
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => cancelledSessions.delete(sessionId), 5 * 60 * 1000);
  }
  
  res.json({ success: true, message: 'Cancellation requested' });
});

/**
 * Clear cancellation for a session (for new downloads)
 * POST /api/clear-cancel
 */
app.post('/api/clear-cancel', (req, res) => {
  const { sessionId } = req.body;
  
  if (sessionId) {
    cancelledSessions.delete(sessionId);
  }
  
  res.json({ success: true });
});

/**
 * Helper function to cleanup temporary files
 */
function cleanup(...files) {
  files.forEach(file => {
    try {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🧹 Cleaned up: ${path.basename(file)}`);
      }
    } catch (err) {
      console.error(`Cleanup error for ${file}:`, err.message);
    }
  });
}

/**
 * Cleanup temp directory on startup
 */
function cleanupTempDir() {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    files.forEach(file => {
      fs.unlinkSync(path.join(TEMP_DIR, file));
    });
    console.log(`🧹 Cleaned up ${files.length} temp files`);
  } catch (err) {
    // Directory might not exist yet
  }
}

// Cleanup on startup
cleanupTempDir();

// Start the server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     YouTube to MP3 Converter - Backend Server             ║
║     Running on http://localhost:${PORT}                      ║
║                                                           ║
║     Using yt-dlp for reliable YouTube downloads           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Verify yt-dlp is installed
  exec('yt-dlp --version', (error, stdout) => {
    if (error) {
      console.log('⚠️  WARNING: yt-dlp not found!');
      console.log('   Please install it: pip install yt-dlp');
    } else {
      console.log(`✅ yt-dlp version: ${stdout.trim()}`);
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  
  // Kill all active download processes
  activeProcesses.forEach((proc, sessionId) => {
    if (!proc.killed) {
      console.log(`   Killing process: ${sessionId}`);
      proc.kill('SIGTERM');
    }
  });
  
  // Clean up temp directory
  cleanupTempDir();
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.emit('SIGINT');
});
