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

  const TARGET_FILE = ["site", "index.html"];
  const TARGET_ATTRIBUTE = "data-config-key";
  const TARGET_VALUE = "topbarSlogan";

  let rootHandle = null;
  let siteDirectoryHandle = null;
  let fileHandle = null;
  let originalHtml = "";
  let currentFileName = "";

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

  function escapeSelector(value) {
    if (window.CSS && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function readSlogan(html) {
    const documentCopy = new DOMParser().parseFromString(html, "text/html");
    const element = documentCopy.querySelector(
      "[" + TARGET_ATTRIBUTE + '="' + escapeSelector(TARGET_VALUE) + '"]'
    );
    if (!element) {
      throw new Error(
        'Could not find the element marked data-config-key="topbarSlogan" in site/index.html.'
      );
    }
    return element.textContent ?? "";
  }

  function replaceSlogan(html, newSlogan) {
    const documentCopy = new DOMParser().parseFromString(html, "text/html");
    const elements = documentCopy.querySelectorAll(
      "[" + TARGET_ATTRIBUTE + '="' + escapeSelector(TARGET_VALUE) + '"]'
    );
    if (elements.length !== 1) {
      throw new Error(
        "Expected exactly one topbar slogan element, but found " + elements.length + ". No file was changed."
      );
    }

    elements[0].textContent = newSlogan;
    const serialized = "<!doctype html>\n" + documentCopy.documentElement.outerHTML;
    return serialized;
  }

  async function getFile(directory, filename, options) {
    return directory.getFileHandle(filename, options);
  }

  async function selectWebsiteFolder() {
    if (!("showDirectoryPicker" in window)) {
      browserNotice.innerHTML =
        "<strong>Unsupported browser</strong><p>Open this page in a current version of Chrome or Edge to grant access to a local project folder.</p>";
      setStatus("This browser does not support local folder access.", "error");
      return;
    }

    try {
      rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      siteDirectoryHandle = await rootHandle.getDirectoryHandle("site");
      fileHandle = await getFile(siteDirectoryHandle, "index.html");
      const file = await fileHandle.getFile();
      originalHtml = await file.text();
      currentFileName = file.name;

      const slogan = readSlogan(originalHtml);
      sloganInput.disabled = false;
      saveButton.disabled = false;
      sloganInput.value = slogan;
      currentSlogan.textContent = slogan || "(empty slogan)";
      setConnected(rootHandle.name, "Connected to site/index.html");
      setStatus("Website file loaded. No changes have been made.", "success");
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Folder selection cancelled. No changes were made.");
        return;
      }
      rootHandle = null;
      siteDirectoryHandle = null;
      fileHandle = null;
      sloganInput.disabled = true;
      saveButton.disabled = true;
      setStatus(error?.message || "Could not open the selected website folder.", "error");
      connection.classList.remove("connected");
      connectionLabel.textContent = "No website selected";
      connectionSub.textContent = "Select the repository root folder";
      connectButton.textContent = "Select website folder";
    }
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
      // Re-read immediately before writing to avoid overwriting unrelated edits.
      const latestFile = await fileHandle.getFile();
      const latestHtml = await latestFile.text();
      const latestSlogan = readSlogan(latestHtml);
      const originalSlogan = readSlogan(originalHtml);

      if (latestHtml !== originalHtml && latestSlogan !== originalSlogan) {
        throw new Error("The file changed since you loaded it. Re-select the folder to review the latest version before saving.");
      }

      // Store a timestamped backup beside the source file, inside the site's own
      // directory. It is deliberately not saved over the original file.
      const backupName = "index.html.backup-" + new Date()
        .toISOString().replace(/[:.]/g, "-");
      const backupHandle = await siteDirectoryHandle.getFileHandle(backupName, { create: true });
      const backupWritable = await backupHandle.createWritable();
      await backupWritable.write(latestHtml);
      await backupWritable.close();

      const updatedHtml = replaceSlogan(latestHtml, newSlogan);
      const writable = await fileHandle.createWritable();
      await writable.write(updatedHtml);
      await writable.close();

      originalHtml = updatedHtml;
      currentSlogan.textContent = newSlogan || "(empty slogan)";
      setStatus("Saved to site/index.html. Git can now detect the change.", "success");
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