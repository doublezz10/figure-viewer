const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.figure-viewer', 'history.json');

function ensureHistoryDir() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadHistory() {
  ensureHistoryDir();
  if (!fs.existsSync(HISTORY_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveHistory(history) {
  ensureHistoryDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getFigureStatus(figurePath, mtime) {
  const now = Date.now();
  const age = now - mtime;
  const fiveMinutes = 5 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;

  if (age < fiveMinutes) {
    return 'active';
  } else if (age < oneHour) {
    return 'recent';
  }
  return 'older';
}

function getRelativeTime(mtime) {
  const now = Date.now();
  const diff = now - mtime;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function updateHistory(figuresDir, figures) {
  const history = loadHistory();
  
  if (!history[figuresDir]) {
    history[figuresDir] = {};
  }

  const dirHistory = history[figuresDir];
  const now = Date.now();

  // Update or add figures
  for (const figure of figures) {
    const existing = dirHistory[figure.name];
    
    if (existing) {
      if (figure.mtime > existing.mtime) {
        // Same file with newer mtime - increment version
        dirHistory[figure.name] = {
          mtime: figure.mtime,
          version: existing.version + 1,
          firstSeen: existing.firstSeen || existing.mtime
        };
      }
      // If mtime hasn't changed, keep existing version
    } else {
      // New figure
      dirHistory[figure.name] = {
        mtime: figure.mtime,
        version: 1,
        firstSeen: figure.mtime
      };
    }
  }

  // Remove figures that no longer exist
  const figureNames = new Set(figures.map(f => f.name));
  for (const name of Object.keys(dirHistory)) {
    if (!figureNames.has(name)) {
      delete dirHistory[name];
    }
  }

  saveHistory(history);
  return dirHistory;
}

function getVersion(figurePath, history) {
  const name = path.basename(figurePath);
  return history[name]?.version || 1;
}

function clearHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    fs.unlinkSync(HISTORY_FILE);
  }
}

function getHistoryForDir(figuresDir) {
  const history = loadHistory();
  return history[figuresDir] || {};
}

module.exports = {
  loadHistory,
  saveHistory,
  getFigureStatus,
  getRelativeTime,
  updateHistory,
  getVersion,
  clearHistory,
  getHistoryForDir,
  HISTORY_FILE
};
