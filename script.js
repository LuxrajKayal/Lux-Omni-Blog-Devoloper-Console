(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const connectButton = $("#connect-button");
  const chooseFolderButton = $("#choose-folder-button");
  const disconnectButton = $("#disconnect-button");
  const sloganInput = $("#slogan-input");
  const currentSlogan = $("#current-slogan");
  const saveButton = $("#save-button");
  const saveStatus = $("#save-status");
  const connectionStatus = $("#connection-status");
  const connectionLabel = $("#connection-label");
  const connectionPath = $("#connection-path");
  const browserNotice = $("#browser-notice");
  const storageLabel = $("#storage-label");
  const clearLocalDataButton = $("#clear-local-data-button");

  const STORAGE_KEY = "luxOmniDeveloperConsole.settings.v1";
  const DB_NAME = "luxOmniDeveloperConsole.handles.v1";
  const DB_STORE = "file-handles";
  const DB_HANDLE_KEY = "blog-root";

  let rememberedRootHandle = null;
  let rootHandle = null;
  let siteDirectoryHandle = null;
  let fileHandle = null;
  let originalHtml = "";
  let actualSlogan = "";
  let forceFolderPicker = false;

  function setStatus(message, type = "") {
    saveStatus.textContent = message;
    saveStatus.className = type;
  }

  function setConnection(state, title, path) {
    connectionStatus.dataset.state = state;
    connectionLabel.textContent = title;
    connectionPath.textContent = path;
  }

  function readSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveSettings(patch) {
    try {
      const next = { ...readSettings(), ...patch, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      storageLabel.textContent = "Settings saved in this browser";
      return true;
    } catch {
      storageLabel.textContent = "Browser storage unavailable";
      return false;
    }
  }

  function updateTopbarActions() {
    const connected = Boolean(rootHandle && fileHandle);
    const saved = readSettings();

    disconnectButton.hidden = !connected;
    connectButton.hidden = connected;
    chooseFolderButton.hidden = !(connected || saved.projectName);

    connectButton.textContent = saved.projectName ? "Reconnect project" : "Select project folder";
    chooseFolderButton.textContent = connected || saved.projectName
      ? "Choose another folder"
      : "Select project folder";
  }

  function openHandleDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("This browser cannot remember the folder handle."));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local connection storage."));
    });
  }

  async function storeRootHandle(handle) {
    const db = await openHandleDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).put(handle, DB_HANDLE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not remember the folder handle."));
      transaction.onabort = () => reject(transaction.error || new Error("Folder handle storage was interrupted."));
    }).finally(() => db.close());
  }

  async function getStoredRootHandle() {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).get(DB_HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read the remembered folder handle."));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("Could not read the remembered folder handle."));
      };
    });
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
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Replace only the text inside the marked span, preserving all other source bytes.
  function replaceSlogan(html, newSlogan) {
    const match = findSloganMatch(html);
    const element = match[0];
    const tagEnd = element.indexOf(">");
    const closeStart = element.toLowerCase().lastIndexOf("</span");
    const updatedElement = element.slice(0, tagEnd + 1) +
      escapeHtmlText(newSlogan) + element.slice(closeStart);
    return html.slice(0, match.index) + updatedElement +
      html.slice(match.index + element.length);
  }

  function renderConnected(root, slogan, loadedHtml) {
    rememberedRootHandle = root;
    rootHandle = root;
    originalHtml = loadedHtml;
    actualSlogan = slogan;
    forceFolderPicker = false;
    sloganInput.disabled = false;
    saveButton.disabled = false;
    currentSlogan.textContent = slogan || "(empty slogan)";

    const stored = readSettings();
    const canRestoreDraft = stored.projectName === root.name &&
      typeof stored.draftSlogan === "string" &&
      stored.draftSlogan !== slogan;
    sloganInput.value = canRestoreDraft ? stored.draftSlogan : slogan;

    setConnection("connected", "Connected · " + root.name, "Writable · site/index.html");
    saveSettings({
      projectName: root.name,
      relativePath: "site/index.html",
      projectDisplayPath: root.name + "/site/index.html",
      savedSlogan: slogan,
      draftSlogan: sloganInput.value,
      disconnectRequested: false
    });
    updateTopbarActions();

    if (canRestoreDraft) {
      setStatus("Restored your unsaved slogan draft. Review it before saving.", "");
    } else {
      setStatus("Project connected. No unsaved changes.", "success");
    }
  }

  async function loadProjectFromRoot(root, persistHandle = true) {
    const selectedSite = await root.getDirectoryHandle("site");
    const selectedFile = await selectedSite.getFileHandle("index.html");
    const loadedHtml = await (await selectedFile.getFile()).text();
    const slogan = readSlogan(loadedHtml);

    siteDirectoryHandle = selectedSite;
    fileHandle = selectedFile;
    renderConnected(root, slogan, loadedHtml);

    if (persistHandle) {
      try {
        await storeRootHandle(root);
        setStatus("Connected. This browser has remembered the project handle.", "success");
      } catch {
        setStatus("Connected for this session, but the browser couldn't save the folder handle. You may need to select it again next time.", "");
      }
    }
  }

  function showDisconnectedFromSavedState(saved, hasStoredHandle = false) {
    rootHandle = null;
    siteDirectoryHandle = null;
    fileHandle = null;
    originalHtml = "";
    sloganInput.disabled = true;
    saveButton.disabled = true;

    if (saved.projectName) {
      if (saved.disconnectRequested) {
        setConnection("disconnected", "Disconnected · project remembered",
          saved.projectDisplayPath || saved.projectName + "/site/index.html");
        setStatus("Disconnected. The saved folder handle and settings are kept in this browser. Reconnect or choose another folder.");
      } else {
        setConnection("permission", hasStoredHandle ? "Project remembered · permission needed" : "Project details remembered",
          saved.projectDisplayPath || saved.projectName + "/site/index.html");
        setStatus(hasStoredHandle
          ? "Project details and folder handle are remembered. Reconnect to restore access."
          : "Project details are remembered, but no folder handle is available. Select the project folder again.");
      }
      if (typeof saved.draftSlogan === "string") sloganInput.value = saved.draftSlogan;
    } else {
      setConnection("disconnected", "No project connected", "Select your local blog folder");
      setStatus("Select your project folder to begin.");
    }
    updateTopbarActions();
  }

  async function chooseProjectFolder() {
    if (!("showDirectoryPicker" in window)) {
      browserNotice.hidden = false;
      setStatus("Use a current version of Chrome or Edge for local folder access.", "error");
      return;
    }

    try {
      // Called directly from a button click to preserve browser user activation.
      const root = await window.showDirectoryPicker({ mode: "readwrite" });
      await loadProjectFromRoot(root, true);
      browserNotice.hidden = true;
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Folder selection cancelled. No files were changed.");
        return;
      }
      setStatus(error?.message || "Could not open the selected project folder.", "error");
      if (!rootHandle) {
        const saved = readSettings();
        setConnection("disconnected", saved.projectName ? "Project remembered" : "No project connected",
          saved.projectDisplayPath || "Select your local blog folder");
      }
    }
  }

  async function reconnectProject() {
    if (rootHandle && fileHandle) return;

    if (!forceFolderPicker && rememberedRootHandle &&
        typeof rememberedRootHandle.requestPermission === "function") {
      try {
        // Request permission while the user click still supplies transient activation.
        const permission = await rememberedRootHandle.requestPermission({ mode: "readwrite" });
        if (permission === "granted") {
          await loadProjectFromRoot(rememberedRootHandle, false);
          browserNotice.hidden = true;
          return;
        }
        forceFolderPicker = true;
        setConnection("permission", "Permission not granted", "Choose the project folder to re-authorize access.");
        setStatus("The browser did not restore write permission. Select the folder again to grant access.", "error");
        updateTopbarActions();
        return;
      } catch {
        forceFolderPicker = true;
        setStatus("Could not restore the saved folder permission. Select the project folder again.", "error");
        updateTopbarActions();
        return;
      }
    }

    await chooseProjectFolder();
  }

  async function disconnectProject() {
    if (!rootHandle) return;

    saveSettings({
      projectName: rootHandle.name,
      relativePath: "site/index.html",
      projectDisplayPath: rootHandle.name + "/site/index.html",
      savedSlogan: actualSlogan,
      draftSlogan: sloganInput.value,
      disconnectRequested: true
    });

    // Release only the live references. Keep the IndexedDB handle and local
    // settings so the user can reconnect without selecting the folder again.
    rootHandle = null;
    siteDirectoryHandle = null;
    fileHandle = null;
    originalHtml = "";
    actualSlogan = "";

    const saved = readSettings();
    showDisconnectedFromSavedState(saved, Boolean(rememberedRootHandle));
    setConnection("disconnected", "Disconnected · project remembered",
      saved.projectDisplayPath || saved.projectName + "/site/index.html");
    setStatus("Disconnected. The folder and settings remain remembered. Reconnect or choose another folder.");
    updateTopbarActions();
  }

  function deleteHandleDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        resolve();
        return;
      }
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not delete the remembered folder handle."));
      request.onblocked = () => reject(new Error("Browser storage is still in use. Close other console tabs and try again."));
    });
  }

  async function clearLocalData() {
    const confirmed = window.confirm(
      "Clear all Lux Omni Developer Console data saved in this browser?\n\nThis removes the saved project settings, draft slogan, and remembered folder handle. It does not delete or change any website files. You will need to choose the project folder again."
    );
    if (!confirmed) return;

    clearLocalDataButton.disabled = true;
    setStatus("Clearing this console's saved browser data…");
    try {
      // Delete the directory handle first, then remove this app's settings key.
      await deleteHandleDatabase();
      localStorage.removeItem(STORAGE_KEY);

      rememberedRootHandle = null;
      rootHandle = null;
      siteDirectoryHandle = null;
      fileHandle = null;
      originalHtml = "";
      actualSlogan = "";
      forceFolderPicker = false;

      sloganInput.value = "";
      sloganInput.disabled = true;
      saveButton.disabled = true;
      currentSlogan.textContent = "Not loaded";
      storageLabel.textContent = "No saved settings in this browser";
      browserNotice.hidden = false;

      setConnection("disconnected", "No project connected", "Select your local blog folder");
      setStatus("Local data cleared. Your website files were not changed.", "success");
      updateTopbarActions();
    } catch (error) {
      setStatus(error?.message || "Could not clear all saved browser data. Try closing other console tabs and retrying.", "error");
      storageLabel.textContent = "Could not clear all saved data";
    } finally {
      clearLocalDataButton.disabled = false;
    }
  }

  function downloadBackup(content) {
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lux-omni-index-backup-" +
      new Date().toISOString().replace(/[:.]/g, "-") + ".html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function saveSlogan() {
    if (!fileHandle || !siteDirectoryHandle || !rootHandle) {
      setStatus("Reconnect your project folder before saving.", "error");
      return;
    }

    const newSlogan = sloganInput.value;
    if (newSlogan.length > 180) {
      setStatus("Slogan is too long (maximum 180 characters).", "error");
      return;
    }

    saveButton.disabled = true;
    setStatus("Checking the source file and creating a backup…");

    try {
      const latestHtml = await (await fileHandle.getFile()).text();
      if (latestHtml !== originalHtml) {
        throw new Error("The HTML file changed since it was loaded. Reconnect the project to reload and review the latest file before saving.");
      }

      downloadBackup(latestHtml);
      const updatedHtml = replaceSlogan(latestHtml, newSlogan);
      const writable = await fileHandle.createWritable();
      await writable.write(updatedHtml);
      await writable.close();

      originalHtml = updatedHtml;
      actualSlogan = newSlogan;
      currentSlogan.textContent = newSlogan || "(empty slogan)";
      saveSettings({
        projectName: rootHandle.name,
        relativePath: "site/index.html",
        projectDisplayPath: rootHandle.name + "/site/index.html",
        savedSlogan: newSlogan,
        draftSlogan: newSlogan,
        disconnectRequested: false
      });
      setConnection("connected", "Connected · " + rootHandle.name, "Writable · site/index.html");
      setStatus("Saved to site/index.html. Review the diff in Git or VS Code before committing.", "success");
    } catch (error) {
      setStatus(error?.message || "Could not save the slogan.", "error");
    } finally {
      saveButton.disabled = false;
    }
  }

  function rememberDraft() {
    if (rootHandle) {
      saveSettings({ draftSlogan: sloganInput.value });
    } else {
      saveSettings({ draftSlogan: sloganInput.value });
    }

    if (rootHandle && sloganInput.value !== actualSlogan) {
      setStatus("Unsaved change — click Save changes to update the local file.");
    } else if (rootHandle) {
      setStatus("No unsaved changes.");
    } else {
      setStatus("Draft remembered in this browser. Connect the project to apply it.");
    }
  }

  async function initialize() {
    const saved = readSettings();
    showDisconnectedFromSavedState(saved, false);

    if (!("showDirectoryPicker" in window)) {
      browserNotice.hidden = false;
      setStatus("Use Chrome or Edge for folder access.", "error");
      return;
    }

    try {
      rememberedRootHandle = await getStoredRootHandle();
      const latestSettings = readSettings();
      showDisconnectedFromSavedState(latestSettings, Boolean(rememberedRootHandle));

      // An explicit disconnect is respected even when the browser still has
      // permission. The user must click Reconnect to resume file access.
      if (latestSettings.disconnectRequested) return;
      if (!rememberedRootHandle) return;

      const permission = await rememberedRootHandle.queryPermission({ mode: "readwrite" });
      if (permission === "granted") {
        await loadProjectFromRoot(rememberedRootHandle, false);
        browserNotice.hidden = true;
      } else {
        setConnection("permission", "Project remembered · permission needed",
          latestSettings.projectDisplayPath || latestSettings.projectName + "/site/index.html");
        setStatus("The browser remembers the project. Click Reconnect project to restore write access.");
        updateTopbarActions();
      }
    } catch {
      const latestSettings = readSettings();
      showDisconnectedFromSavedState(latestSettings, false);
      setStatus("Saved project details remain available, but the folder handle could not be restored. Select the folder again.");
    }
  }

  connectButton.addEventListener("click", reconnectProject);
  chooseFolderButton.addEventListener("click", chooseProjectFolder);
  disconnectButton.addEventListener("click", disconnectProject);
  clearLocalDataButton.addEventListener("click", clearLocalData);
  sloganInput.addEventListener("input", rememberDraft);
  saveButton.addEventListener("click", saveSlogan);

  initialize();
})();