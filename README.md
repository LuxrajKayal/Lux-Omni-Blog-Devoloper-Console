# Lux Omni Blog Developer Console

A browser-based editor for the local Lux Omni Blog source files. This console is hosted separately from the main blog.

## Connect a project

1. Open the GitHub Pages console in current Chrome or Edge.
2. Click **Select project folder**.
3. Select the root of your local `Lux-Omni-Blog` repository — the folder containing `site/`.
4. Grant read/write access.

## Topbar actions

- **Disconnect** releases the active file references but keeps the remembered project details and folder handle in browser storage.
- **Reconnect project** attempts to restore the remembered folder permission.
- **Choose another folder** lets you select a different local project that contains `site/index.html`.

When disconnected, the console remembers the last project name and relative file path. It does not claim the project is currently writable until a connection has been restored.

## Current setting

The **Topbar slogan** control targets the span in `site/index.html` marked `data-config-key="topbarSlogan"`. The editor replaces only that span's text and preserves the surrounding HTML source. Before writing, it requests a downloadable backup of the original `index.html`.

## How browser storage works

- `localStorage` saves the project display name, relative target path, saved slogan, unsaved draft, and explicit disconnect state.
- IndexedDB stores the File System Access directory handle, because the handle itself cannot be stored directly in localStorage.
- The browser can restore a saved handle only if it still exists and browser permission allows it. If permission is no longer granted, click **Reconnect project** or **Choose another folder**.
- A complete absolute local filesystem path is not exposed portably to the webpage; the console displays the chosen folder name and relative file path.
- Clearing site data, using a different browser profile, or browser permission changes can require selecting the project again.

## Publishing and safety

- GitHub Pages serves the console only. It does not push or commit changes to the blog repository.
- After saving, review the real local change in VS Code/Git, then commit and push manually.
- The console only writes into the directory the user selects and only edits the known slogan element.
- Use only a console version you trust, as it has write access to the folder you authorize.
