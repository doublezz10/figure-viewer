const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  figuresDirs: [
    'outputs/figures',
    'figures',
    'plots',
    'output/figures',
    'output/plots'
  ],
  refreshInterval: 30000,
  watcherTimeout: 3600000,
  openOnStartup: true,
  searchSubdirs: true
};

function getConfig(dir = process.cwd()) {
  // Check for config in current directory first
  const localConfig = path.join(dir, '.figure-viewer.json');
  if (fs.existsSync(localConfig)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(localConfig, 'utf8')) };
    } catch (e) {
      console.warn('Invalid config file, using defaults');
    }
  }
  
  // Check in home directory
  const homeConfig = path.join(process.env.HOME || process.env.USERPROFILE, '.figure-viewer.json');
  if (fs.existsSync(homeConfig)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(homeConfig, 'utf8')) };
    } catch (e) {
      // ignore
    }
  }
  
  return DEFAULT_CONFIG;
}

module.exports = {
  getConfig,
  DEFAULT_CONFIG
};
