(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const connectButton = $("#connect-button");
  const sloganInput = $("#slogan-input");
  const currentSlogan = $("#current-slogan");
  const saveButton = $("#save-button");
  const saveStatus = $("#save-status");
  const connection = $(".connection");
  const connectionLabel = $("#connection-label");
  const connectionSub = $("#connection-sub");
  const browserNotice = $("#browser-notice");

  const TARGET_MARKER = 'data-config-key="topbarSlogan"';
  let siteDirectoryHandle = null;
  let fileHandle = null;
  let originalHtml = "";

  function setStatus(message, type = "") {
    saveStatus.textContent = message;
    saveStatus.className = type;
  }

  function setConnected(label, detail) {
    connection.classList.add("connected");
    connectionLabel.textContent = label;
    connectionSub.textContent = detail;
    connectButton.textContent = "Change website folder";
  }

  function findSloganMatch(html) {
    const matches = [...html.matchAll(/<span\b[^>]*\bdata-config-key\s*=\s*["']topbarSlogan["'][^>]*>[\s\S]*?<\/span\s*>/gi)];
    if (matches.length !== 1) {
      throw new Error('Expected exactly one span marked data-config-key="topbarSlogan" in site/index.html; found ' + matches.length + ".");
    }
    return matches[0];
  }

  function decodeHtmlText(value) {
    const parsed = new DOMParser().parseFromString(value, "text/html");
    return parsed.body.textContent ?? "";
  }

  function readSlogan(html) {
    const match = findSloganMatch(html);
    const tagEnd = match[0].indexOf(">");
    const closeStart = match[0].toLowerCase().lastIndexOf("</span");
    return decodeHtmlText(match[0].slice(tagEnd + 1, closeStart));
  }

  function escapeHtmlText(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Replace only the text inside the matching span, preserving every other
  // source byte, including whitespace, comments, attributes and formatting.
  function replaceSlogan(html, newSlogan) {
    const match = findSloganMatch(html);
    const matchedElement = match[0];
    const tagEnd = matchedElement.indexOf(">");
    const closeStart = matchedElement.toLowerCase().lastIndexOf("</span");
    const updatedElement =
      matchedElement.slice(0, tagEnd + 1) +
      escapeHtmlText(newSlogan) +
      matchedElement.slice(closeStart);
    return html.slice(0, match.index) + updatedElement +
      html.slice(match.index + matchedElement.length);
  }

  async function selectWebsiteFolder() {
    if (!("showDirectoryPicker" in window)) {
      browserNotice.replaceChildren();
      const strong = document.createElement("strong");
      strong.textContent = "Unsupported browser";
      const paragraph = document.createElement("p");
      paragraph.textContent = "Open this page in a current version of Chrome or Edge to grant access to a local project folder.";
      browserNotice.append(strong, paragraph);
      setStatus("This browser does not support local folder access.", "error");
      return;
    }

    try {
      const selectedRoot = await window.showDirectoryPicker({ mode: "readwrite" });
      const selectedSite = await selectedRoot.getDirectoryHandle("site");
      const selectedFile = await selectedSite.getFileHandle("index.html");
      const loadedHtml = await (await selectedFile.getFile()).text();
      const slogan = readSlogan(loadedHtml);

      siteDirectoryHandle = selectedSite;
      fileHandle = selectedFile;
      originalHtml = loadedHtml;
      sloganInput.disabled = false;
      saveButton.disabled = false;
      sloganInput.value = slogan;
      currentSlogan.textContent = slogan || "(empty slogan)";
      setConnected(selectedRoot.name, "Connected to site/index.html");
      setStatus("Website file loaded. No changes have been made.", "success");
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Folder selection cancelled. No changes were made.");
        return;
      }
      siteDirectoryHandle = null;
      fileHandle = null;
      originalHtml = "";
      sloganInput.disabled = true;
      saveButton.disabled = true;
      connection.classList.remove("connected");
      connectionLabel.textContent = "No website selected";
      connectionSub.textContent = "Select the repository root folder";
      connectButton.textContent = "Select website folder";
      setStatus(error?.message || "Could not open the selected website folder.", "error");
    }
  }

  function downloadBackup(content) {
    // Back up to Downloads rather than the site's publish directory, so a
    // backup file is not accidentally included in the public deployment.
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lux-omni-index-backup-" +
      new Date().toISOString().replace(/[:.]/g, "-") + ".html";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function saveSlogan() {
    if (!fileHandle || !siteDirectoryHandle) {
      setStatus("Select your website folder first.", "error");
      return;
    }

    const newSlogan = sloganInput.value;
    if (newSlogan.length > 180) {
      setStatus("Slogan is too long (maximum 180 characters).", "error");
      return;
    }

    saveButton.disabled = true;
    setStatus("Checking file and creating backup…");

    try {
      const latestHtml = await (await fileHandle.getFile()).text();
      if (latestHtml !== originalHtml) {
        throw new Error("The HTML file changed since you loaded it. Re-select the folder to reload and review it before saving.");
      }

      // Save a copy to the browser's Downloads instead of the public site folder.
      downloadBackup(latestHtml);

      const updatedHtml = replaceSlogan(latestHtml, newSlogan);
      const writable = await fileHandle.createWritable();
      await writable.write(updatedHtml);
      await writable.close();

      originalHtml = updatedHtml;
      currentSlogan.textContent = newSlogan || "(empty slogan)";
      setStatus("Saved to site/index.html. A backup download was requested; Git can now detect the change.", "success");
    } catch (error) {
      setStatus(error?.message || "Could not save the slogan.", "error");
    } finally {
      saveButton.disabled = false;
    }
  }

  connectButton.addEventListener("click", selectWebsiteFolder);
  saveButton.addEventListener("click", saveSlogan);
  sloganInput.addEventListener("input", () => {
    if (sloganInput.value === currentSlogan.textContent) {
      setStatus("No unsaved change.");
    } else {
      setStatus("Unsaved change — click Save to update your website file.");
    }
  });
})();