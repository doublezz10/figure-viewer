const chokidar = require('chokidar');

function createWatcher(figuresDir, onChange) {
  const watcher = chokidar.watch(figuresDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  watcher
    .on('add', (filePath) => {
      console.log(`\n[Watch] New figure detected: ${filePath}`);
      onChange();
    })
    .on('change', (filePath) => {
      console.log(`\n[Watch] Figure changed: ${filePath}`);
      onChange();
    })
    .on('unlink', (filePath) => {
      console.log(`\n[Watch] Figure removed: ${filePath}`);
      onChange();
    })
    .on('error', (error) => {
      console.error(`[Watch] Error: ${error.message}`);
    });

  return watcher;
}

function closeWatcher(watcher) {
  if (watcher) {
    watcher.close();
  }
}

module.exports = {
  createWatcher,
  closeWatcher
};
