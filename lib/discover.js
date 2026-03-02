const fs = require('fs');
const path = require('path');
const { getConfig, DEFAULT_CONFIG } = require('./config');

function discoverFiguresDirectory(startPath, config = null, options = {}) {
  // If explicit path provided, validate it
  if (startPath) {
    const resolvedPath = path.resolve(startPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${resolvedPath}`);
    }
    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${resolvedPath}`);
    }
    return resolvedPath;
  }

  const cfg = config || getConfig();
  const figureDirs = cfg.figuresDirs || DEFAULT_CONFIG.figuresDirs;

  // First try upward (default behavior)
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const figureDir of figureDirs) {
      const candidatePath = path.join(currentDir, figureDir);
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
        return candidatePath;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // Check root level as well
  for (const figureDir of figureDirs) {
    const candidatePath = path.join(root, figureDir);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
      return candidatePath;
    }
  }

  return null;
}

// Search subdirectories for figures folders
function discoverFiguresInSubdirs(startPath, config = null) {
  const cfg = config || getConfig();
  const figureDirs = cfg.figuresDirs || DEFAULT_CONFIG.figuresDirs;
  const searchDir = startPath || process.cwd();
  
  const found = [];
  
  if (!fs.existsSync(searchDir)) return found;
  
  const entries = fs.readdirSync(searchDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    
    for (const figureDir of figureDirs) {
      const candidatePath = path.join(searchDir, entry.name, figureDir);
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
        found.push({
          dir: candidatePath,
          parent: entry.name,
          figureDir: figureDir
        });
      }
    }
  }
  
  return found;
}

// Save last used figures directory for this parent
const LAST_USED_FILE = '.figure-viewer-last-used.json';

function saveLastUsed(parentDir, selection) {
  const filePath = path.join(parentDir, LAST_USED_FILE);
  try {
    fs.writeFileSync(filePath, JSON.stringify({
      parentDir,
      selection,
      timestamp: Date.now()
    }));
  } catch (e) {
    // ignore
  }
}

function getLastUsed(parentDir) {
  const filePath = path.join(parentDir, LAST_USED_FILE);
  if (!fs.existsSync(filePath)) return null;
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Verify the selection still exists
    if (data.selection && fs.existsSync(data.selection)) {
      return data.selection;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function getErrorMessage(suggestedDirs) {
  return `No figures directory found. Pass explicit path or create one of: ${suggestedDirs.join(', ')}`;
}

module.exports = {
  discoverFiguresDirectory,
  discoverFiguresInSubdirs,
  getErrorMessage,
  saveLastUsed,
  getLastUsed
};
