/**
 * YouTube to MP3 Converter - Main Application Component
 * 
 * Features:
 * - CSV file upload with YouTube links
 * - Sequential download processing
 * - Real-time status updates
 * - Cancellation support
 * - Failed downloads tracking
 * - Summary popup
 */

import React, { useState, useRef, useCallback } from 'react';

// Status constants for tracking download progress
const STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  CONVERTING: 'converting',
  SAVED: 'saved',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Generate unique session ID for cancellation tracking
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function App() {
  // State management
  const [links, setLinks] = useState([]);           // Array of {row, link, status, error}
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [sessionId, setSessionId] = useState(generateSessionId());
  
  // Refs for managing async operations
  const cancelledRef = useRef(false);
  const fileInputRef = useRef(null);

  /**
   * Handle CSV file selection and parsing
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    // Reset state for new upload
    cancelledRef.current = false;
    setSessionId(generateSessionId());
    setShowSummary(false);
    setCurrentIndex(-1);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('csvFile', file);

      // Send to backend for parsing
      const response = await fetch('/api/parse-csv', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Initialize links with pending status
        const initializedLinks = data.links.map(item => ({
          ...item,
          status: STATUS.PENDING,
          error: null
        }));
        setLinks(initializedLinks);
      } else {
        alert(`Error parsing CSV: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload and parse CSV file');
    }

    // Reset file input for re-upload
    event.target.value = '';
  };

  /**
   * Download a single video and save as MP3
   */
  const downloadSingle = async (index) => {
    const item = links[index];
    
    // Update status to downloading
    setLinks(prev => prev.map((l, i) => 
      i === index ? { ...l, status: STATUS.DOWNLOADING } : l
    ));

    try {
      // Request download from backend
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: item.link,
          sessionId: sessionId
        })
      });

      // Check if cancelled
      if (cancelledRef.current) {
        setLinks(prev => prev.map((l, i) => 
          i === index ? { ...l, status: STATUS.CANCELLED, error: 'Cancelled by user' } : l
        ));
        return false;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Download failed');
      }

      // Update to converting status
      setLinks(prev => prev.map((l, i) => 
        i === index ? { ...l, status: STATUS.CONVERTING } : l
      ));

      // Get the filename from response header
      const filename = decodeURIComponent(
        response.headers.get('X-Filename') || `audio_${index + 1}.mp3`
      );

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Update status to saved
      setLinks(prev => prev.map((l, i) => 
        i === index ? { ...l, status: STATUS.SAVED } : l
      ));

      return true;

    } catch (error) {
      console.error(`Download error for row ${item.row}:`, error);
      
      // Update status to failed
      setLinks(prev => prev.map((l, i) => 
        i === index ? { ...l, status: STATUS.FAILED, error: error.message } : l
      ));

      return false;
    }
  };

  /**
   * Start processing all links sequentially
   */
  const startProcessing = async () => {
    if (links.length === 0) return;

    setIsProcessing(true);
    cancelledRef.current = false;
    
    // Clear any previous cancellation
    await fetch('/api/clear-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    // Reset all statuses to pending
    setLinks(prev => prev.map(l => ({ 
      ...l, 
      status: STATUS.PENDING, 
      error: null 
    })));

    // Process each link sequentially
    for (let i = 0; i < links.length; i++) {
      // Check for cancellation
      if (cancelledRef.current) {
        // Mark remaining as cancelled
        setLinks(prev => prev.map((l, idx) => 
          idx >= i ? { ...l, status: STATUS.CANCELLED, error: 'Cancelled by user' } : l
        ));
        break;
      }

      setCurrentIndex(i);
      await downloadSingle(i);
      
      // Small delay between downloads to prevent rate limiting
      if (i < links.length - 1 && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setCurrentIndex(-1);
    setIsProcessing(false);
    setShowSummary(true);
  };

  /**
   * Cancel the download queue
   */
  const cancelProcessing = async () => {
    cancelledRef.current = true;
    
    // Notify backend
    await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
  };

  /**
   * Reset everything for a new batch
   */
  const resetAll = () => {
    setLinks([]);
    setIsProcessing(false);
    setShowSummary(false);
    setCurrentIndex(-1);
    cancelledRef.current = false;
    setSessionId(generateSessionId());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate summary statistics
  const summary = {
    total: links.length,
    saved: links.filter(l => l.status === STATUS.SAVED).length,
    failed: links.filter(l => l.status === STATUS.FAILED).length,
    cancelled: links.filter(l => l.status === STATUS.CANCELLED).length
  };

  // Get failed downloads for display
  const failedDownloads = links.filter(l => l.status === STATUS.FAILED);

  /**
   * Get status display info (text, color, icon)
   */
  const getStatusDisplay = (status) => {
    switch (status) {
      case STATUS.PENDING:
        return { text: 'Pending', class: 'status-pending', icon: '○' };
      case STATUS.DOWNLOADING:
        return { text: 'Downloading...', class: 'status-downloading', icon: '↓' };
      case STATUS.CONVERTING:
        return { text: 'Converting...', class: 'status-converting', icon: '⟳' };
      case STATUS.SAVED:
        return { text: 'Saved', class: 'status-saved', icon: '✓' };
      case STATUS.FAILED:
        return { text: 'Failed', class: 'status-failed', icon: '✕' };
      case STATUS.CANCELLED:
        return { text: 'Cancelled', class: 'status-cancelled', icon: '◌' };
      default:
        return { text: 'Unknown', class: '', icon: '?' };
    }
  };

  return (
    <div className="app-container">
      {/* Animated background elements */}
      <div className="bg-shape bg-shape-1"></div>
      <div className="bg-shape bg-shape-2"></div>
      <div className="bg-shape bg-shape-3"></div>

      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">▶</span>
          <h1>YT<span className="accent">→</span>MP3</h1>
        </div>
        <p className="tagline">Batch convert YouTube videos to MP3</p>
      </header>

      {/* Main content */}
      <main className="main-content">
        {/* Upload Section */}
        <section className="upload-section">
          <div className="upload-card">
            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUpload}
                className="file-input"
                disabled={isProcessing}
              />
              <div className="upload-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17,8 12,3 7,8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="upload-text">
                {isProcessing ? 'Processing...' : 'Click to upload CSV file'}
              </p>
              <p className="upload-hint">or drag and drop</p>
            </div>

            {/* CSV Format Example */}
            <div className="csv-example">
              <h3>📋 CSV Format Example</h3>
              <div className="csv-preview">
                <div className="csv-header">LINKS</div>
                <div className="csv-row">https://www.youtube.com/watch?v=dQw4w9WgXcQ</div>
                <div className="csv-row">https://youtu.be/jNQXAC9IVRw</div>
                <div className="csv-row">https://www.youtube.com/watch?v=...</div>
              </div>
              <p className="csv-note">Row 1 must have "LINKS" header. YouTube URLs start from Row 2.</p>
            </div>
          </div>
        </section>

        {/* Links Table Section */}
        {links.length > 0 && (
          <section className="links-section">
            <div className="section-header">
              <h2>📥 Download Queue ({links.length} videos)</h2>
              <div className="action-buttons">
                {!isProcessing ? (
                  <>
                    <button className="btn btn-primary" onClick={startProcessing}>
                      <span className="btn-icon">▶</span>
                      Start Processing
                    </button>
                    <button className="btn btn-secondary" onClick={resetAll}>
                      <span className="btn-icon">↺</span>
                      Reset
                    </button>
                  </>
                ) : (
                  <button className="btn btn-danger" onClick={cancelProcessing}>
                    <span className="btn-icon">■</span>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${((summary.saved + summary.failed) / summary.total) * 100}%` 
                    }}
                  ></div>
                </div>
                <div className="progress-text">
                  Processing {currentIndex + 1} of {links.length}
                </div>
              </div>
            )}

            {/* Links Table */}
            <div className="table-container">
              <table className="links-table">
                <thead>
                  <tr>
                    <th className="col-row">#</th>
                    <th className="col-link">YouTube Link</th>
                    <th className="col-status">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((item, index) => {
                    const statusInfo = getStatusDisplay(item.status);
                    return (
                      <tr 
                        key={index} 
                        className={`${statusInfo.class} ${currentIndex === index ? 'active-row' : ''}`}
                      >
                        <td className="col-row">{item.row}</td>
                        <td className="col-link">
                          <a href={item.link} target="_blank" rel="noopener noreferrer">
                            {item.link.length > 60 
                              ? item.link.substring(0, 60) + '...' 
                              : item.link
                            }
                          </a>
                        </td>
                        <td className="col-status">
                          <span className={`status-badge ${statusInfo.class}`}>
                            <span className="status-icon">{statusInfo.icon}</span>
                            {statusInfo.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Failed Downloads Section */}
        {failedDownloads.length > 0 && (
          <section className="failed-section">
            <h2>⚠️ Failed Downloads ({failedDownloads.length})</h2>
            <div className="failed-list">
              {failedDownloads.map((item, index) => (
                <div key={index} className="failed-item">
                  <span className="failed-row">Audio #{item.row}</span>
                  <span className="failed-link">{item.link}</span>
                  <span className="failed-error">{item.error || 'Download failed'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Summary Modal */}
      {showSummary && (
        <div className="modal-overlay" onClick={() => setShowSummary(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Processing Complete</h2>
              <button className="modal-close" onClick={() => setShowSummary(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="summary-grid">
                <div className="summary-item summary-total">
                  <span className="summary-number">{summary.total}</span>
                  <span className="summary-label">Total Links</span>
                </div>
                <div className="summary-item summary-success">
                  <span className="summary-number">{summary.saved}</span>
                  <span className="summary-label">Successfully Converted</span>
                </div>
                <div className="summary-item summary-failed">
                  <span className="summary-number">{summary.failed}</span>
                  <span className="summary-label">Failed Conversions</span>
                </div>
                {summary.cancelled > 0 && (
                  <div className="summary-item summary-cancelled">
                    <span className="summary-number">{summary.cancelled}</span>
                    <span className="summary-label">Cancelled</span>
                  </div>
                )}
              </div>
              <div className="success-rate">
                <div className="rate-bar">
                  <div 
                    className="rate-fill" 
                    style={{ width: `${(summary.saved / summary.total) * 100}%` }}
                  ></div>
                </div>
                <p className="rate-text">
                  {Math.round((summary.saved / summary.total) * 100)}% Success Rate
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={resetAll}>
                Start New Batch
              </button>
              <button className="btn btn-primary" onClick={() => setShowSummary(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>Upload a CSV with YouTube links • Download as MP3 • It's that simple</p>
      </footer>
    </div>
  );
}

export default App;
