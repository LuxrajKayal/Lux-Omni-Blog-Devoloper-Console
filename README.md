# Lux Omni Blog Developer Console

A browser-based editor for selected local Lux Omni Blog files. The console is hosted separately from the main blog.

## GitHub Pages setup

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then save.
4. After GitHub Pages finishes publishing, open the published URL in Chrome or Edge.

## Use it

1. Click **Select website folder**.
2. Choose the root folder of your local `Lux-Omni-Blog` repository — the folder that contains `site/`.
3. Approve read/write access.
4. Change the **Topbar slogan** and click **Save to website file**.
5. The console edits only the element in `site/index.html` marked `data-config-key="topbarSlogan"`.
6. Review the change in VS Code, then commit and push it as usual.

The console does not push to GitHub and does not access the GitHub API. The local file changes only when you explicitly save and grant file access.

## Browser and security notes

- Use an up-to-date Chrome or Edge browser. The File System Access API is not supported uniformly by all browsers.
- This is a static HTTPS page; it does not require Node.js or a backend when hosted on GitHub Pages.
- Access is granted by the user through the browser's folder picker. The app cannot access arbitrary local files without permission.
- A timestamped backup of `site/index.html` is created inside the selected `site/` directory before the source file is modified. Backup filenames end with `.backup-<timestamp>`.
- Only use a Developer Console version you trust, because it has write permission to the folder you select.
