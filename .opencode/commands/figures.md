---
description: Open figure viewer for the current project
agent: build
---

Run the figure viewer to check generated figures:

!`figure-viewer --watch`

This will:
- Auto-discover the figures directory (outputs/figures/, figures/, or plots/)
- Open a browser split below in cmux
- Watch for changes in the background

To stop the watcher when done:

!`figure-viewer --kill`
