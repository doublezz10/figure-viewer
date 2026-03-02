#!/usr/bin/env node

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];  // Now this is the output directory
const figuresDir = process.argv[3];
const outputPath = process.argv[4];
const refreshInterval = parseInt(process.argv[5]) || 30000;
const watcherTimeout = parseInt(process.argv[6]) || 3600000;
const pidFile = path.join(projectRoot, '.figure-viewer.pid');

let lastActivity = Date.now();

function generateAndSave() {
  // Require fresh each time to get updated modules
  delete require.cache[require.resolve(path.join(__dirname, '..', 'lib/html'))];
  delete require.cache[require.resolve(path.join(__dirname, '..', 'lib/history'))];
  delete require.cache[require.resolve(path.join(__dirname, '..', 'lib/config'))];
  
  const { generateHtml, getImages } = require(path.join(__dirname, '..', 'lib/html'));
  const { updateHistory } = require(path.join(__dirname, '..', 'lib/history'));
  const { getConfig } = require(path.join(__dirname, '..', 'lib/config'));
  
  const config = getConfig();
  config.refreshInterval = refreshInterval;
  
  const images = getImages(figuresDir);
  const history = updateHistory(figuresDir, images);
  const html = generateHtml(figuresDir, { history, config });
  fs.writeFileSync(outputPath, html);
  console.log('Regenerated at', new Date().toLocaleTimeString(), `(${images.length} figures)`);
  
  lastActivity = Date.now();
}

// Save PID and metadata
fs.writeFileSync(pidFile, JSON.stringify({
  pid: process.pid,
  startTime: Date.now(),
  figuresDir,
  outputPath
}));

// Cleanup on exit
process.on('exit', () => {
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
});

process.on('SIGINT', () => {
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  process.exit(0);
});

// Check for inactivity timeout
const inactivityCheck = setInterval(() => {
  const idleTime = Date.now() - lastActivity;
  if (idleTime > watcherTimeout) {
    console.log(`No activity for ${Math.round(idleTime/60000)} minutes. Stopping watcher...`);
    clearInterval(inactivityCheck);
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    process.exit(0);
  }
}, 60000); // Check every minute

const watcher = chokidar.watch(figuresDir, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
});

watcher.on('add', (file) => {
  console.log('New figure:', path.basename(file));
  generateAndSave();
});
watcher.on('change', (file) => {
  console.log('Changed:', path.basename(file));
  generateAndSave();
});
watcher.on('unlink', (file) => {
  console.log('Removed:', path.basename(file));
  generateAndSave();
});
watcher.on('error', (error) => {
  console.error('Watcher error:', error.message);
});

console.log('Watching', figuresDir, 'for changes... (PID:', process.pid + ')');
console.log('Will stop after', Math.round(watcherTimeout/60000), 'minutes of inactivity');
