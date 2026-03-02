#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const { discoverFiguresDirectory, discoverFiguresInSubdirs, getErrorMessage } = require('./lib/discover');
const { generateHtml, getImages } = require('./lib/html');
const { updateHistory, getHistoryForDir, clearHistory: clearHistoryFn } = require('./lib/history');
const { createWatcher, closeWatcher } = require('./lib/watcher');
const { getConfig } = require('./lib/config');

const program = new Command();

const PID_FILE = '.figure-viewer.pid';

program
  .name('figure-viewer')
  .description('CLI tool for viewing and navigating scientific figures in a browser pane')
  .version('1.0.0')
  .option('-p, --path <path>', 'Explicit path to figures directory')
  .option('-s, --subdirs', 'Search subdirectories for figures folders')
  .option('-o, --output <path>', 'Output HTML file path', 'figure-viewer.html')
  .option('-w, --watch', 'Watch for file changes and auto-refresh', false)
  .option('--no-open', 'Do not open browser automatically')
  .option('-r, --refresh <seconds>', 'Auto-refresh interval in seconds (default: 30)', parseInt)
  .option('-t, --timeout <minutes>', 'Kill watcher after N minutes of inactivity (default: 60)', parseInt)
  .option('--clear-history', 'Clear figure history')
  .option('--kill', 'Kill the background watcher process');

program.parse(process.argv);

const options = program.opts();

function generateAndSave(figuresDir, outputPath) {
  const config = getConfig();
  // CLI options override config
  if (options.refresh) {
    config.refreshInterval = options.refresh * 1000;
  }
  if (options.timeout) {
    config.watcherTimeout = options.timeout * 60 * 1000;
  }
  const images = getImages(figuresDir);
  const history = updateHistory(figuresDir, images);
  const html = generateHtml(figuresDir, { history, config });
  
  fs.writeFileSync(outputPath, html);
  console.log(`Generated: ${outputPath} (${images.length} figures)`);
  
  return outputPath;
}

function openInBrowser(filePath) {
  // Try cmux first, fallback to system browser
  const fileUrl = 'file://' + filePath;
  
  // Check if cmux socket exists (cmux sets CMUX_SOCKET_PATH or we can check default)
  const cmuxSocket = process.env.CMUX_SOCKET_PATH || '/tmp/cmux.sock';
  const hasCmux = fs.existsSync(cmuxSocket) || process.env.CMUX_WORKSPACE_ID;
  
  if (hasCmux) {
    console.log('Detected cmux session - opening in cmux browser...');
    try {
      const { execSync } = require('child_process');
      // Try cmux browser open command
      // Use new-pane with direction for cmux
      execSync(`cmux new-pane --type browser --direction down --url "${fileUrl}"`, { stdio: 'inherit' });
      console.log('Opened in cmux browser');
      return;
    } catch (e) {
      console.log('cmux command failed, falling back to system browser:', e.message);
    }
  }
  
  // Fallback: use system open command
  const { exec } = require('child_process');
  exec(`open "${fileUrl}"`, (err) => {
    if (err) {
      console.error('Failed to open browser:', err.message);
    } else {
      console.log('Opened in default browser');
    }
  });
}

async function main() {
  // Handle kill option
  if (options.kill) {
    const pidPath = path.join(process.cwd(), PID_FILE);
    if (fs.existsSync(pidPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(pidPath, 'utf8'));
        const pid = data.pid;
        process.kill(pid, 'SIGTERM');
        console.log(`Killed watcher process (PID: ${pid})`);
      } catch (e) {
        console.log('Watcher process already stopped or invalid PID file.');
      }
      // Clean up PID file
      try { fs.unlinkSync(pidPath); } catch {}
    } else {
      console.log('No watcher process found in current directory.');
    }
    return;
  }

  // Handle clear history
  if (options.clearHistory) {
    clearHistoryFn();
    console.log('History cleared.');
    return;
  }

  // Discover figures directory
  const config = getConfig();
  let figuresDir;
  try {
    figuresDir = discoverFiguresDirectory(options.path);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // If not found and searchSubdirs enabled (CLI or config), search subdirectories
  const useSubdirs = options.subdirs !== undefined ? options.subdirs : config.searchSubdirs;
  if (!figuresDir && useSubdirs) {
    const subdirs = discoverFiguresInSubdirs();
    if (subdirs.length === 0) {
      console.error(getErrorMessage(['outputs/figures', 'figures', 'plots']));
      process.exit(1);
    }
    
    if (subdirs.length === 1) {
      figuresDir = subdirs[0].dir;
      console.log(`Found figures in subdirectory: ${subdirs[0].parent}/${subdirs[0].figureDir}`);
    } else {
      console.log('Found multiple figures directories:\n');
      subdirs.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.parent}/${s.figureDir}`);
      });
      console.log('\nUse -p to specify one explicitly.');
      process.exit(1);
    }
  }

  if (!figuresDir) {
    console.error(getErrorMessage(['outputs/figures', 'figures', 'plots']));
    process.exit(1);
  }

  console.log(`Figures directory: ${figuresDir}`);

  // Generate HTML
  const outputPath = path.resolve(options.output);
  generateAndSave(figuresDir, outputPath);

  // Check if watcher already running
  const pidPath = path.join(process.cwd(), PID_FILE);
  const watcherAlreadyRunning = fs.existsSync(pidPath);

  // Watch mode - run as background process
  if (options.watch) {
    if (watcherAlreadyRunning) {
      console.log('Watcher already running in this directory.');
    } else {
      const { spawn } = require('child_process');
      
      // Get config for refresh and timeout
      const config = getConfig();
      const refreshMs = options.refresh ? options.refresh * 1000 : config.refreshInterval;
      const timeoutMs = options.timeout ? options.timeout * 60 * 1000 : config.watcherTimeout;
      
      // Pass the output directory as first arg (projectRoot)
      const child = spawn(
        process.execPath, 
        [
          path.join(__dirname, 'lib/watcher-daemon.js'), 
          path.dirname(outputPath), 
          figuresDir, 
          outputPath,
          refreshMs.toString(),
          timeoutMs.toString()
        ], 
        {
          cwd: __dirname,
          detached: true,
          stdio: 'ignore'
        }
      );
      
      child.unref();
      
      console.log('Watching for changes in background...');
      console.log(`Auto-refresh every ${refreshMs/1000}s, timeout after ${Math.round(timeoutMs/60000)}min`);
    }
  }

  // Open in browser (only if not already watching and not explicitly disabled)
  if (options.open !== false && !watcherAlreadyRunning) {
    openInBrowser(outputPath);
  } else if (watcherAlreadyRunning) {
    console.log('Browser already open. Use --no-open to skip browser entirely.');
  } else if (!options.watch) {
    // Only show URL for non-watch mode
    console.log(`\nOpen this URL in your browser:\nfile://${outputPath}`);
  }
}

main().catch(console.error);
