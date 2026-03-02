# Figure Viewer — Specification

## Overview

A CLI tool for viewing and navigating scientific figures generated during agentic data analysis workflows. Designed for macOS + cmux + OpenCode. Renders figures in a browser pane within cmux for perfect image quality.

## Problem

When AI coding agents (OpenCode) generate figures during data analysis:
- Opening figures requires context-switching to Finder/Preview
- No good TUI-native solution for image preview on macOS
- Hard to track which figures are new vs. iterations
- Want to view figures inside cmux without leaving the terminal

## Solution

- CLI tool: `figure-viewer`
- Generates interactive HTML from figures directory
- HTML opened in cmux browser split
- Auto-discovery of figures folder from working directory
- Freshness tracking for iteration awareness

---

## CLI Interface

### Commands

```bash
# Basic usage — auto-discover figures from cwd
figure-viewer

# Explicit path
figure-viewer ./outputs/figures
figure-viewer /path/to/project/analysis/outputs/figures

# Watch mode (default on)
figure-viewer --watch
figure-viewer --watch ./figures

# Disable auto-open in browser
figure-viewer --no-open

# Specify output HTML path
figure-viewer --output viewer.html

# Help
figure-viewer --help
```

### Auto-Discovery Logic

1. If path provided, use it
2. Else, start at `pwd`
3. Walk up directories looking for:
   - `outputs/figures/`
   - `figures/`
   - `plots/`
   - `output/figures/`
4. If not found, error with suggestion to pass explicit path

---

## HTML Viewer

### Layout

```
┌─────────────────────────────────────────────────────┐
│  🔄 Figure Viewer                    [Refresh]    │
├─────────────────────────────────────────────────────┤
│  Filter: [________________]  Sort: [Newest ▼]       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ img  │  │ img  │  │ img  │  │ img  │          │
│  │  1   │  │  2   │  │  3   │  │  4   │          │
│  │ 🔴   │  │ ⚪   │  │ ⚪   │  │ 🟡   │          │
│  └──────┘  └──────┘  └──────┘  └──────┘          │
│                                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ img  │  │ img  │  │ img  │  │ img  │          │
│  │  5   │  │  6   │  │  7   │  │  8   │          │
│  │ ⚪   │  │ ⚪   │  │ 🔴   │  │ ⚪   │          │
│  └──────┘  └──────┘  └──────┘  └──────┘          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Grid

- Responsive grid: auto-fit, min 200px per image
- Each card shows:
  - Thumbnail (aspect-ratio preserved)
  - Filename (truncated if long)
  - Timestamp (relative: "2 min ago", "1 hour ago")
  - Freshness indicator (color border)

### Freshness Indicators

| Status | Color | Time Window |
|--------|-------|-------------|
| 🔴 Active | Red border | < 5 minutes |
| 🟡 Recent | Yellow border | 5 min – 1 hour |
| ⚪ Older | Gray border | > 1 hour |

### Lightbox

On click:
- Full-size image in modal overlay
- Dark background (rgba(0,0,0,0.9))
- Close: ESC key or click outside
- Navigation: ← → arrows or keyboard
- Shows metadata: filename, dimensions, file size, full path

### Auto-Refresh

- Meta refresh every 5 seconds: `<meta http-equiv="refresh" content="5">`
- Or JavaScript polling (less intrusive)
- Manual refresh button always available

---

## Freshness Tracking

### Storage

`~/.figure-viewer/history.json`:

```json
{
  "/path/to/project/outputs/figures": {
    "figure_1.png": {
      "mtime": 1709324400000,
      "version": 1
    },
    "figure_1.png": {
      "mtime": 1709324500000,
      "version": 2
    }
  }
}
```

### Version Detection

If same filename appears with newer mtime:
- Increment version counter
- Track version history
- Display "v1", "v2", etc. on card

---

## cmux Integration

### Opening the Viewer

```bash
# Generate HTML
figure-viewer --output /tmp/figure-viewer.html

# Open in cmux browser (verify exact command)
cmux browser open file:///tmp/figure-viewer.html
```

### Watch + Open

```bash
# Watch and auto-open on first run
figure-viewer --watch --open
```

On watch detect new/modified figure:
1. Regenerate HTML
2. Refresh browser (cmux command TBD or manual)

### Fallback

If cmux not available or browser split fails:
- Open in default browser: `open file:///path/to/viewer.html`
- Print instruction to user

---

## OpenCode Integration

### Custom Command

Create `.opencode/commands/figures.md`:

```yaml
---
description: Open figure viewer
agent: build
---

Run the figure viewer to check generated figures:

!`figure-viewer --open`
```

### Usage

In OpenCode:
```
/figures
```

Or in conversation:
```
"Can you run /figures to check the plots we generated?"
```

---

## File Structure

```
figure-viewer/
├── figure-viewer.js      # Main CLI entry point
├── lib/
│   ├── discover.js       # Find figures directory
│   ├── html.js           # Generate HTML
│   ├── history.js        # Track freshness/versions
│   └── watcher.js        # File system watch (fswatch)
├── templates/
│   └── viewer.html       # HTML template (inline in js or separate)
├── package.json
└── README.md
```

---

## Dependencies

- Node.js (or could be Go/Bash)
- `chokidar` or `fswatch` for file watching
- Optional: `open` CLI (macOS) for fallback browser open

---

## Edge Cases

1. **No figures directory found**
   - Error message: "No figures directory found. Pass explicit path or create one of: outputs/figures/, figures/, plots/"

2. **Empty figures directory**
   - Show message: "No figures yet. Run your analysis to generate figures."

3. **Very large images**
   - Generate thumbnails for grid? Or lazy load
   - Full size in lightbox

4. **Non-image files in folder**
   - Filter to: .png, .jpg, .jpeg, .pdf, .svg
   - Ignore everything else

5. **Path with spaces/special chars**
   - Proper escaping in HTML file:// URLs

6. **Multiple projects**
   - History stored per directory path
   - Can clear history: `figure-viewer --clear-history`

7. **Watch mode permissions**
   - Handle ENOENT if directory deleted while watching

---

## Future Enhancements

- [ ] Version comparison: side-by-side v1 vs v2
- [ ] Annotations: add notes to figures
- [ ] Export: download all figures as zip
- [ ] Zoom: pinch-zoom in lightbox
- [ ] Slideshow: auto-advance mode
- [ ] AI captioning: generate descriptions with vision model
- [ ] Share: copy image URL or embed

---

## Acceptance Criteria

1. ✅ `figure-viewer` runs from CLI with no arguments and auto-discovers figures
2. ✅ Generated HTML displays grid of images with thumbnails
3. ✅ Freshness indicators show correct colors based on mtime
4. ✅ Click on image opens lightbox with full-size view
5. ✅ Lightbox supports keyboard navigation (ESC to close, arrows to navigate)
6. ✅ Watch mode detects new files and regenerates HTML
7. ✅ Opens in cmux browser split (or fallback to system browser)
8. ✅ Custom command `/figures` works in OpenCode
9. ✅ Works with nested directory structures (project/analysis/outputs/figures)
10. ✅ Handles empty directory gracefully with helpful message
