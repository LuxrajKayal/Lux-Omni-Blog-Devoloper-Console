# Lux Omni Blog Developer Console

Browser-based controls for Topbar content in a locally selected website project.

## Workflow

1. Open in a current Chrome or Edge browser.
2. Choose the website project's root folder; the folder may have any name.
3. The console automatically locates the HTML file containing `data-config-key="topbarSlogan"`. It prefers `site/index.html`, then root-level `index.html`, then searches HTML files in the project.
4. Edit the slogan, newsletter link, social destinations, email link and About link in the main workspace.
5. Click **Save changes** to write directly to the selected local HTML file. There is no backup download or review screen. Open the site preview separately to check the result.

## Topbar settings

- Slogan text.
- Newsletter link text and destination.
- Facebook, Instagram, X, YouTube and GitHub destinations.
- Email link text and email address.
- About link text and destination.

The editor updates only these Topbar elements and preserves the rest of the HTML source. This first module manages Topbar content and links; it is not yet a general HTML/CSS/JavaScript editor.

## Project connection

The Developer Console topbar displays the selected project folder name and connection status. The Topbar workspace displays the HTML file selected automatically from inside the project. `localStorage` saves the remembered project details and IndexedDB stores the folder handle.

- **Disconnect** pauses the connection while preserving remembered settings.
- **Choose another folder** switches projects.
- **Clear local data** removes the console's saved project details and remembered folder handle from this browser. It does not alter website files.

Saving writes to the selected local project; it does not push to GitHub. Use your normal Git workflow to publish.
