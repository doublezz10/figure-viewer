const fs = require('fs');
const path = require('path');
const { getFigureStatus, getRelativeTime, getVersion } = require('./history');
const { getConfig, DEFAULT_CONFIG } = require('./config');

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.svg', '.gif', '.webp'];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeFileUrl(filepath) {
  // Use encodeURIComponent only for special chars, not the entire URL
  const encoded = filepath.split('/').map(p => encodeURIComponent(p)).join('/');
  return 'file://' + encoded;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getImages(figuresDir) {
  if (!fs.existsSync(figuresDir)) {
    return [];
  }

  const files = fs.readdirSync(figuresDir);
  const images = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

    const filePath = path.join(figuresDir, file);
    const stats = fs.statSync(filePath);
    
    if (!stats.isFile()) continue;

    images.push({
      name: file,
      path: filePath,
      mtime: stats.mtimeMs,
      size: stats.size,
      ext: ext
    });
  }

  // Sort by mtime, newest first
  images.sort((a, b) => b.mtime - a.mtime);

  return images;
}

function generateFigureCards(figuresDir, history) {
  const images = getImages(figuresDir);
  
  if (images.length === 0) {
    return '';
  }

  return images.map((img, index) => {
    const status = getFigureStatus(img.path, img.mtime);
    const relativeTime = getRelativeTime(img.mtime);
    const version = getVersion(img.path, history);
    
    const statusColors = {
      active: '#ef4444',   // Red
      recent: '#eab308',   // Yellow
      older: '#9ca3af'    // Gray
    };

    const statusLabels = {
      active: 'Active',
      recent: 'Recent',
      older: 'Older'
    };

    const borderColor = statusColors[status];
    const fileUrl = escapeFileUrl(img.path);
    const truncatedName = img.name.length > 25 
      ? img.name.substring(0, 22) + '...' 
      : img.name;

    return `
      <div class="figure-card" 
           data-index="${index}"
           data-path="${escapeHtml(img.path)}"
           data-name="${escapeHtml(img.name)}"
           data-size="${img.size}"
           data-mtime="${img.mtime}"
           onclick="openLightbox(${index})">
        <div class="figure-image" style="border-color: ${borderColor}">
          <img src="${fileUrl}" alt="${escapeHtml(img.name)}" loading="lazy">
          <span class="status-indicator" style="background-color: ${borderColor}"></span>
        </div>
        <div class="figure-info">
          <div class="figure-name" title="${escapeHtml(img.name)}">${escapeHtml(truncatedName)}</div>
          <div class="figure-meta">
            <span class="figure-time">${relativeTime}</span>
            ${version > 1 ? `<span class="figure-version">v${version}</span>` : ''}
          </div>
        </div>
      </div>
    `.trim();
  }).join('\n');
}

function generateHtml(figuresDir, options = {}) {
  const images = getImages(figuresDir);
  const history = options.history || {};
  const config = options.config || getConfig();
  const refreshInterval = config.refreshInterval || DEFAULT_CONFIG.refreshInterval;
  const figureCards = generateFigureCards(figuresDir, history);

  const hasImages = images.length > 0;
  const emptyMessage = !hasImages 
    ? '<div class="empty-state"><p>No figures yet.</p><p>Run your analysis to generate figures.</p></div>'
    : '';

  const imagesJson = JSON.stringify(images.map(img => ({
    name: img.name,
    path: escapeFileUrl(img.path),
    size: img.size,
    mtime: img.mtime,
    ext: img.ext
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figure Viewer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #1a1a1a;
      color: #e5e5e5;
      min-height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background-color: #262626;
      border-bottom: 1px solid #404040;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .filter-input {
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #404040;
      background-color: #1a1a1a;
      color: #e5e5e5;
      font-size: 14px;
      width: 200px;
    }
    .filter-input:focus {
      outline: none;
      border-color: #6366f1;
    }
    .refresh-btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      background-color: #6366f1;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .refresh-btn:hover {
      background-color: #4f46e5;
    }
    .stats {
      padding: 12px 24px;
      background-color: #262626;
      border-bottom: 1px solid #404040;
      font-size: 13px;
      color: #9ca3af;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      padding: 24px;
    }
    .figure-card {
      background-color: #262626;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .figure-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .figure-image {
      position: relative;
      aspect-ratio: 16/10;
      background-color: #1a1a1a;
      border-bottom: 3px solid;
      overflow: hidden;
    }
    .figure-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .status-indicator {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    .figure-info {
      padding: 12px;
    }
    .figure-name {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .figure-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .figure-version {
      background-color: #6366f1;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      color: #9ca3af;
    }
    .empty-state p {
      margin: 8px 0;
    }
    .legend {
      display: flex;
      gap: 24px;
      padding: 8px 0;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .legend-dot.active { background-color: #ef4444; }
    .legend-dot.recent { background-color: #eab308; }
    .legend-dot.older { background-color: #9ca3af; }

    /* Lightbox */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.95);
      z-index: 1000;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox-content {
      max-width: 90vw;
      max-height: 80vh;
      position: relative;
    }
    .lightbox-content img {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
    }
    .lightbox-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: none;
      border: none;
      color: white;
      font-size: 32px;
      cursor: pointer;
      padding: 8px;
    }
    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      font-size: 32px;
      padding: 16px;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .lightbox-nav:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .lightbox-prev { left: -60px; }
    .lightbox-next { right: -60px; }
    .lightbox-meta {
      margin-top: 20px;
      text-align: center;
      color: #9ca3af;
    }
    .lightbox-meta .filename {
      font-size: 18px;
      font-weight: 600;
      color: #e5e5e5;
      margin-bottom: 8px;
    }
    .lightbox-meta .details {
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Figure Viewer</h1>
    <div class="header-controls">
      <input type="text" class="filter-input" placeholder="Filter figures..." id="filterInput">
      <button class="refresh-btn" onclick="location.reload()">Refresh</button>
    </div>
  </div>
  <div class="stats">
    <div class="legend">
      <div class="legend-item"><span class="legend-dot active"></span> Active (&lt;5 min)</div>
      <div class="legend-item"><span class="legend-dot recent"></span> Recent (5 min - 1 hour)</div>
      <div class="legend-item"><span class="legend-dot older"></span> Older (&gt;1 hour)</div>
    </div>
  </div>
  <div class="grid" id="figureGrid">
    ${figureCards}
    ${emptyMessage}
  </div>

  <div class="lightbox" id="lightbox">
    <div class="lightbox-content">
      <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
      <button class="lightbox-nav lightbox-prev" onclick="navigate(-1)">&#8249;</button>
      <img id="lightboxImage" src="" alt="">
      <button class="lightbox-nav lightbox-next" onclick="navigate(1)">&#8250;</button>
    </div>
    <div class="lightbox-meta">
      <div class="filename" id="lightboxFilename"></div>
      <div class="details" id="lightboxDetails"></div>
    </div>
  </div>

  <script>
    const images = ${imagesJson};
    const refreshInterval = ${refreshInterval};
    let currentIndex = 0;

    // Filter functionality
    const filterInput = document.getElementById('filterInput');
    const figureCards = document.querySelectorAll('.figure-card');
    
    filterInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      figureCards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        card.style.display = name.includes(query) ? 'block' : 'none';
      });
    });

    // Lightbox functionality
    function openLightbox(index) {
      currentIndex = index;
      showImage();
      document.getElementById('lightbox').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
      document.body.style.overflow = '';
    }

    function navigate(direction) {
      currentIndex += direction;
      if (currentIndex < 0) currentIndex = images.length - 1;
      if (currentIndex >= images.length) currentIndex = 0;
      showImage();
    }

    function showImage() {
      const img = images[currentIndex];
      document.getElementById('lightboxImage').src = img.path;
      document.getElementById('lightboxFilename').textContent = img.name;
      
      const size = ${images.length} > 0 ? formatFileSize(images[currentIndex].size) : '';
      document.getElementById('lightboxDetails').textContent = size;
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('lightbox');
      if (!lightbox.classList.contains('active')) return;
      
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });

    // Click outside to close
    document.getElementById('lightbox').addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') closeLightbox();
    });

    // Auto-refresh every 30 seconds
    setInterval(() => {
      location.reload();
    }, ${refreshInterval});
  </script>
</body>
</html>`;
}

module.exports = {
  generateHtml,
  getImages,
  SUPPORTED_EXTENSIONS
};
