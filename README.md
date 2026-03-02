# Figure Viewer

[![npm](https://img.shields.io/npm/v/figure-viewer)](https://www.npmjs.com/package/figure-viewer)

CLI tool for viewing and navigating scientific figures in a browser pane. Automatically splits a browser pane below the active OpenCode session with an HTML site to browse the generated figures.

**Note:** This project is not affiliated with or endorsed by OpenCode or cmux. It simply integrates with their tools.

## Features

- Auto-discovers figures directories (`outputs/figures`, `figures`, `plots`, etc.)
- Interactive HTML viewer with grid layout
- Freshness indicators (Active/Recent/Older)
- Lightbox for full-size image viewing
- File watching with auto-refresh
- cmux browser integration (opens in split below)
- Configurable via `.figure-viewer.json`
- Multiple independent sessions support

## Installation

```bash
npm install -g figure-viewer
```

Or link locally:
```bash
cd figure-viewer
npm link
```

## Usage

```bash
# Basic - auto-discover figures directory
figure-viewer --watch

# With options
figure-viewer --watch --refresh 60 --timeout 120

# Kill watcher when done
figure-viewer --kill
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --path <path>` | Explicit path to figures directory | auto-discover |
| `-o, --output <path>` | Output HTML file path | `figure-viewer.html` |
| `-w, --watch` | Watch for file changes | false |
| `--no-open` | Don't open browser | false |
| `-r, --refresh <seconds>` | Auto-refresh interval | 30 |
| `-t, --timeout <minutes>` | Kill after inactivity | 60 |
| `--kill` | Kill background watcher | - |
| `--clear-history` | Clear figure history | - |

## Configuration

Create a `.figure-viewer.json` in your project or home directory:

```json
{
  "figuresDirs": [
    "outputs/figures",
    "figures",
    "plots",
    "output/figures",
    "output/plots"
  ],
  "refreshInterval": 30000,
  "watcherTimeout": 3600000,
  "openOnStartup": true
}
```

## OpenCode Integration

Add `/figures` command to OpenCode:

```bash
# Link the command
ln -s /path/to/figure-viewer/.opencode/command/figures.md ~/.config/opencode/command/figures.md
```

Then use in OpenCode:
```
/figures
```

## How It Works

1. Auto-discovers figures directory by walking up from current directory
2. Generates interactive HTML with figure grid
3. Opens in cmux browser split (or falls back to system browser)
4. Watches for file changes in background
5. Auto-kills after inactivity timeout (configurable)

## License

MIT
