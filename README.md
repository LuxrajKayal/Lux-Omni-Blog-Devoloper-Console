# Lux Omni Blog Developer Console

A browser-based editor for selected local Lux Omni Blog files. This project is hosted separately from the main blog and does not publish or push blog changes by itself.

## GitHub Pages

The console is published from the `main` branch at the repository root using the GitHub Actions Pages workflow.

## Use the console

1. Open the published console in a current version of Chrome or Edge.
2. Click **Select project folder** in the topbar.
3. Select the root folder of your local `Lux-Omni-Blog` repository — the folder that contains `site/`.
4. Approve read/write access.
5. Change the **Topbar slogan** and click **Save changes**.
6. Review `site/index.html` in VS Code or Git, then commit and push it when satisfied.

The console currently edits the span in `site/index.html` marked `data-config-key="topbarSlogan"`. It preserves the surrounding source and requests a downloadable HTML backup before writing. The backup is sent to the browser's Downloads location, not into the public `site/` directory.

## Saved browser settings

- Local storage remembers the selected folder's display name, the relative target path (`site/index.html`), the last saved slogan, and an unsaved slogan draft.
- The browser does not reveal the absolute filesystem path through the File System Access API. The UI remembers the selected folder name and relative file path instead.
- The browser's File System Access handle is stored separately in IndexedDB, because file handles cannot be stored directly in local storage. On a later visit, the console tries to restore the connection if the browser still grants permission; otherwise, click **Reconnect project** and approve access again.
- This state is local to the same browser profile and origin. Clearing site data or changing browser/profile may require selecting the folder again.

## Security and workflow

- The console is a static HTTPS page; it does not require Node.js or a backend while hosted on GitHub Pages.
- Use an up-to-date Chrome or Edge browser. File System Access API support differs between browsers.
- The page only reads or writes the folder you explicitly select and only targets the expected slogan element.
- The console never pushes to GitHub and never needs a GitHub token. Git and VS Code remain your review, commit, and push workflow.
- Only use a hosted console you trust because it can write to the folder you authorize.
