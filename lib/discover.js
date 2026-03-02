const fs = require('fs');
const path = require('path');
const { getConfig, DEFAULT_CONFIG } = require('./config');

function discoverFiguresDirectory(startPath, config = null) {
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

  // Start at current working directory
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

function getErrorMessage(suggestedDirs) {
  return `No figures directory found. Pass explicit path or create one of: ${suggestedDirs.join(', ')}`;
}

module.exports = {
  discoverFiguresDirectory,
  getErrorMessage
};
