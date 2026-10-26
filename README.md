# Lux Omni Blog Developer Console

A browser-based editor for selected local Lux Omni Blog files. This repository is independent from the main blog repository.

## How the connection is remembered

- **localStorage** remembers the selected project folder's display name, the relative target `site/index.html`, the saved slogan, and the unsaved slogan draft.
- **IndexedDB** stores the browser's File System Access directory handle. The app restores the handle on a later visit and checks whether read/write permission is still granted.
- The topbar shows one of three states: connected and writable, project remembered but permission needed, or no project connected.
- The browser does not expose a portable absolute filesystem path to the page. The stored handle is the browser-authorized reference to the folder; the UI displays the folder name plus `site/index.html`.
- Browser permission is ultimately controlled by Chrome/Edge and may need to be granted again. If a handle is missing or permission is not restored, use the topbar button to reconnect or select the folder again.

## Use the console

1. Open the GitHub Pages URL in a current version of Chrome or Edge.
2. Click **Select project folder** in the topbar.
3. Select the root of your local `Lux-Omni-Blog` repository — the folder containing `site/`.
4. Grant read/write access.
5. Change **Topbar slogan** and select **Save changes**.
6. Review the local `site/index.html` change in VS Code or Git. Commit and push only after review.

The editor currently targets the span in `site/index.html` marked `data-config-key="topbarSlogan"`. It replaces only the text inside this span and preserves the surrounding source. Before writing, it requests a downloadable backup of the original HTML.

## Important

- GitHub Pages hosts only the console's interface. It does not upload or change files in your blog repository.
- The console does not call the GitHub API and does not push commits.
- Access is limited to the folder selected by the user and can be revoked through browser permissions/site data.
- Only use a hosted console you trust because it writes to the folder you explicitly authorize.
