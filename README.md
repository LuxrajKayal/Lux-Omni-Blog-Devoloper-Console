# Lux Omni Blog Developer Console

A browser-based editor for selected local Lux Omni Blog files. This project is separate from the main blog repository.

## Enable GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then save.
4. Open the published URL in a current version of Chrome or Edge.

## Use the console

1. Click **Select website folder**.
2. Select the root folder of your local `Lux-Omni-Blog` repository — the folder that contains `site/`.
3. Approve read/write access.
4. Change the **Topbar slogan** and click **Save to website file**.
5. The console edits the element in `site/index.html` marked `data-config-key="topbarSlogan"`.
6. Review the local change in VS Code and commit/push it as usual.

The console does not push to GitHub and does not use a GitHub token. The local file changes only when you explicitly save and grant file access.

## Browser/security notes

- Use an up-to-date Chrome or Edge browser. The File System Access API is not supported uniformly by all browsers.
- The GitHub Pages version is static HTTPS; it does not need Node.js or a backend.
- The app cannot access local files without the permission you grant through the folder picker.
- A timestamped backup of `site/index.html` is written into the selected `site/` directory before the source is changed. Backup files are named `index.html.backup-<timestamp>`.
- Only use a console version you trust, because it can write to the folder you select.
