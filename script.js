(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const connectButton = $("#connect-button"), chooseButton = $("#choose-folder-button"), disconnectButton = $("#disconnect-button"), clearButton = $("#clear-local-data-button");
  const connectionStatus = $("#connection-status"), connectionLabel = $("#connection-label"), connectionPath = $("#connection-path");
  const targetPathLabel = $("#target-file-path"), fileState = $("#file-context-state"), browserNotice = $("#browser-notice");
  const form = $("#topbar-form"), fields = $("#topbar-fields"), saveButton = $("#save-button"), saveStatus = $("#save-status"), saveDot = $("#save-dot"), storageLabel = $("#storage-label");
  const inputs = {
    slogan: $("#slogan-input"), newsletterText: $("#newsletter-label-input"), newsletterUrl: $("#newsletter-url-input"),
    emailText: $("#email-text-input"), emailAddress: $("#email-address-input"), aboutText: $("#about-label-input"), aboutUrl: $("#about-url-input")
  };
  const socialInputs = $$("[data-social]");
  const STORAGE_KEY = "luxOmniDeveloperConsole.settings.v1", DB_NAME = "luxOmniDeveloperConsole.handles.v1", DB_STORE = "file-handles", DB_HANDLE_KEY = "blog-root";
  const SLOGAN_MARKER = /<span\b[^>]*\bdata-config-key\s*=\s*["']topbarSlogan["'][^>]*>/i;
  const SOCIALS = ["Facebook", "Instagram", "X", "YouTube", "GitHub"];
  const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", "vendor"]);
  let rememberedRoot = null, rootHandle = null, targetHandle = null, targetPath = "", forceFolderPicker = false;

  function status(message, type = "") {
    saveStatus.textContent = message;
    saveStatus.dataset.state = type || "neutral";
    saveDot.dataset.state = type || "neutral";
  }
  function connection(state, title, detail) {
    connectionStatus.dataset.state = state;
    connectionLabel.textContent = title;
    connectionPath.textContent = detail;
  }
  function readSettings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  }
  function saveSettings(patch) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSettings(), ...patch, updatedAt: new Date().toISOString() }));
      storageLabel.textContent = "Project settings remembered in this browser";
      return true;
    } catch {
      storageLabel.textContent = "Browser storage unavailable";
      return false;
    }
  }
  function updateButtons() {
    const active = Boolean(rootHandle && targetHandle), saved = readSettings();
    connectButton.hidden = active;
    chooseButton.hidden = !(active || saved.projectName);
    disconnectButton.hidden = !active;
    connectButton.textContent = saved.projectName ? "Reconnect project" : "Choose project folder";
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("This browser cannot remember the project folder."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local storage."));
    });
  }
  async function storeRoot(handle) {
    const db = await openDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(handle, DB_HANDLE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Could not remember the selected folder."));
      });
    } finally { db.close(); }
  }
  async function getRoot() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly"), req = tx.objectStore(DB_STORE).get(DB_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("Could not read the remembered folder."));
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not read the remembered folder.")); };
    });
  }
  function decode(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }
  function textEscape(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function attrEscape(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function attr(tag, name) {
    const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"));
    return match ? decode(match[2]) : "";
  }
  function setAttr(tag, name, value) {
    const pattern = new RegExp("(\\b" + name + "\\s*=\\s*)([\"'])([\\s\\S]*?)\\2", "i");
    if (pattern.test(tag)) return tag.replace(pattern, (_all, prefix, quote) => prefix + quote + attrEscape(value) + quote);
    return tag.replace(/\s*\/?>$/, (end) => " " + name + '="' + attrEscape(value) + '"' + end);
  }
  function findAnchor(html, className, ariaLabel = null) {
    for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
      const tag = match[0], classes = attr(tag, "class").split(/\s+/);
      if (!classes.includes(className) || (ariaLabel !== null && attr(tag, "aria-label") !== ariaLabel)) continue;
      const contentStart = match.index + tag.length, closeStart = html.toLowerCase().indexOf("</a", contentStart);
      if (closeStart < 0) continue;
      return { tag, start: match.index, contentStart, closeStart, inner: html.slice(contentStart, closeStart) };
    }
    throw new Error("Could not find Topbar element: " + className + (ariaLabel ? " (" + ariaLabel + ")" : "") + ".");
  }
  function anchorText(anchor) {
    return new DOMParser().parseFromString("<body>" + anchor.inner + "</body>", "text/html").body.textContent.trim();
  }
  function sloganMatch(html) {
    const matches = [...html.matchAll(/<span\b[^>]*\bdata-config-key\s*=\s*["']topbarSlogan["'][^>]*>[\s\S]*?<\/span\s*>/gi)];
    if (matches.length !== 1) throw new Error('Expected exactly one span marked data-config-key="topbarSlogan"; found ' + matches.length + ".");
    return matches[0];
  }
  function getSlogan(html) {
    const m = sloganMatch(html), bodyStart = m[0].indexOf(">") + 1, close = m[0].toLowerCase().lastIndexOf("</span");
    return decode(m[0].slice(bodyStart, close).replace(/<[^>]*>/g, ""));
  }
  function setSlogan(html, value) {
    const m = sloganMatch(html), bodyStart = m[0].indexOf(">") + 1, close = m[0].toLowerCase().lastIndexOf("</span");
    const changed = m[0].slice(0, bodyStart) + textEscape(value) + m[0].slice(close);
    return html.slice(0, m.index) + changed + html.slice(m.index + m[0].length);
  }
  function setAnchor(html, className, values, ariaLabel = null) {
    const a = findAnchor(html, className, ariaLabel);
    let tag = a.tag;
    if (Object.prototype.hasOwnProperty.call(values, "href")) tag = setAttr(tag, "href", values.href);
    const inner = Object.prototype.hasOwnProperty.call(values, "text") ? textEscape(values.text) : a.inner;
    return html.slice(0, a.start) + tag + inner + html.slice(a.closeStart);
  }
  function readTopbar(html) {
    const newsletter = findAnchor(html, "topbar__newsletter"), email = findAnchor(html, "topbar__email"), about = findAnchor(html, "topbar__about");
    const href = attr(email.tag, "href");
    const social = {};
    for (const name of SOCIALS) {
      try { social[name] = attr(findAnchor(html, "topbar__social-link", name).tag, "href"); } catch { social[name] = ""; }
    }
    return {
      slogan: getSlogan(html), newsletterText: anchorText(newsletter), newsletterUrl: attr(newsletter.tag, "href"),
      emailText: anchorText(email), emailAddress: href.toLowerCase().startsWith("mailto:") ? href.slice(7) : anchorText(email),
      aboutText: anchorText(about), aboutUrl: attr(about.tag, "href"), social
    };
  }
  function fillForm(value) {
    inputs.slogan.value = value.slogan;
    inputs.newsletterText.value = value.newsletterText;
    inputs.newsletterUrl.value = value.newsletterUrl;
    inputs.emailText.value = value.emailText;
    inputs.emailAddress.value = value.emailAddress;
    inputs.aboutText.value = value.aboutText;
    inputs.aboutUrl.value = value.aboutUrl;
    for (const input of socialInputs) input.value = value.social[input.dataset.social] || "";
  }
  function webUrl(value, label, required = true) {
    const raw = value.trim();
    if (!raw) { if (required) throw new Error(label + " is required."); return ""; }
    let parsed;
    try { parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : "https://" + raw); }
    catch { throw new Error("Enter a valid URL for " + label + "."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(label + " must use http:// or https://.");
    return parsed.href;
  }
  function emailAddress(value) {
    const address = value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email address.");
    return address;
  }
  function collectForm() {
    const social = {};
    for (const input of socialInputs) social[input.dataset.social] = webUrl(input.value, input.dataset.social, false);
    return {
      slogan: inputs.slogan.value.trim(), newsletterText: inputs.newsletterText.value.trim(),
      newsletterUrl: webUrl(inputs.newsletterUrl.value, "newsletter destination"), emailText: inputs.emailText.value.trim(),
      emailAddress: emailAddress(inputs.emailAddress.value), aboutText: inputs.aboutText.value.trim(),
      aboutUrl: webUrl(inputs.aboutUrl.value, "About destination"), social
    };
  }
  function updateTopbar(html, value) {
    let out = setSlogan(html, value.slogan);
    out = setAnchor(out, "topbar__newsletter", { href: value.newsletterUrl, text: value.newsletterText });
    out = setAnchor(out, "topbar__email", { href: "mailto:" + value.emailAddress, text: value.emailText || value.emailAddress });
    out = setAnchor(out, "topbar__about", { href: value.aboutUrl, text: value.aboutText });
    for (const name of SOCIALS) if (value.social[name]) out = setAnchor(out, "topbar__social-link", { href: value.social[name] }, name);
    return out;
  }
  async function tryTarget(root, path) {
    try {
      const parts = path.split("/");
      let directory = root;
      for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
      const file = await directory.getFileHandle(parts[parts.length - 1]), html = await (await file.getFile()).text();
      if (SLOGAN_MARKER.test(html)) return { handle: file, path, html };
    } catch (error) {
      if (error?.name !== "NotFoundError" && error?.name !== "TypeMismatchError") throw error;
    }
    return null;
  }
  async function searchTarget(directory, path = "", depth = 0) {
    if (depth > 8) return null;
    for await (const [name, handle] of directory.entries()) {
      const relative = path ? path + "/" + name : name;
      if (handle.kind === "directory") {
        if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
        const found = await searchTarget(handle, relative, depth + 1);
        if (found) return found;
      } else if (name.toLowerCase().endsWith(".html")) {
        const html = await (await handle.getFile()).text();
        if (SLOGAN_MARKER.test(html)) return { handle, path: relative, html };
      }
    }
    return null;
  }
  async function findTarget(root) {
    for (const path of ["site/index.html", "index.html"]) {
      const target = await tryTarget(root, path);
      if (target) return target;
    }
    const target = await searchTarget(root);
    if (target) return target;
    throw new Error('Could not find the website HTML file containing data-config-key="topbarSlogan". Choose the project root that contains your Topbar markup.');
  }
  async function loadProject(root, persist = true) {
    const target = await findTarget(root), value = readTopbar(target.html);
    rememberedRoot = root;
    rootHandle = root;
    targetHandle = target.handle;
    targetPath = target.path;
    forceFolderPicker = false;
    fillForm(value);
    fields.disabled = false;
    saveButton.disabled = false;
    targetPathLabel.textContent = targetPath;
    fileState.textContent = "Selected automatically";
    fileState.dataset.state = "connected";
    connection("connected", root.name, "Project folder connected");
    browserNotice.hidden = true;
    saveSettings({ projectName: root.name, relativePath: targetPath, projectDisplayPath: root.name + "/" + targetPath, disconnectRequested: false });
    updateButtons();
    status("Topbar settings loaded from the selected project.", "success");
    if (persist) {
      try { await storeRoot(root); }
      catch { status("Connected for this session, but the browser could not remember the folder handle.", "error"); }
    }
  }
  function showDisconnected(saved, hasHandle = false) {
    rootHandle = null; targetHandle = null; targetPath = "";
    fields.disabled = true; saveButton.disabled = true;
    targetPathLabel.textContent = "Choose a project folder";
    fileState.textContent = "Not connected"; fileState.dataset.state = "disconnected";
    connection("disconnected", saved.projectName || "No project selected",
      saved.projectName ? (saved.disconnectRequested ? "Disconnected · project remembered" : (hasHandle ? "Project remembered · reconnect to edit" : "Choose the project folder to edit")) : "Choose a project folder to begin");
    status(saved.projectName ? "Reconnect the remembered project or choose another folder." : "Choose your project folder to load Topbar settings.");
    updateButtons();
  }
  async function chooseFolder() {
    if (!("showDirectoryPicker" in window)) {
      browserNotice.hidden = false; status("Use a current version of Chrome or Edge to access local project files.", "error"); return;
    }
    try {
      const root = await window.showDirectoryPicker({ mode: "readwrite" });
      await loadProject(root, true);
    } catch (error) {
      if (error?.name === "AbortError") { status("Folder selection cancelled. No files were changed."); return; }
      status(error?.message || "Could not open the selected project folder.", "error");
    }
  }
  async function reconnect() {
    if (rootHandle && targetHandle) return;
    if (!forceFolderPicker && rememberedRoot && typeof rememberedRoot.requestPermission === "function") {
      try {
        if (await rememberedRoot.requestPermission({ mode: "readwrite" }) === "granted") {
          await loadProject(rememberedRoot, false); return;
        }
      } catch { /* Let the user select the folder again below. */ }
      forceFolderPicker = true;
      status("Permission could not be restored. Choose the project folder again.", "error");
      updateButtons(); return;
    }
    await chooseFolder();
  }
  async function disconnect() {
    if (!rootHandle) return;
    saveSettings({ projectName: rootHandle.name, relativePath: targetPath, projectDisplayPath: rootHandle.name + "/" + targetPath, disconnectRequested: true });
    rememberedRoot = rememberedRoot || rootHandle;
    showDisconnected(readSettings(), Boolean(rememberedRoot));
    status("Disconnected. The remembered folder settings are kept in this browser.");
  }
  function deleteDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return resolve();
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not delete the remembered folder handle."));
      request.onblocked = () => reject(new Error("Browser storage is still in use. Close other console tabs and try again."));
    });
  }
  async function clearLocalData() {
    if (!window.confirm("Clear all Developer Console data saved in this browser?\n\nThis removes the remembered project name/path and folder handle. It does not delete or modify website files.")) return;
    clearButton.disabled = true;
    try {
      await deleteDatabase();
      localStorage.removeItem(STORAGE_KEY);
      rememberedRoot = null; rootHandle = null; targetHandle = null; targetPath = ""; forceFolderPicker = false;
      form.reset(); fields.disabled = true; saveButton.disabled = true;
      targetPathLabel.textContent = "Choose a project folder";
      fileState.textContent = "Not connected"; fileState.dataset.state = "disconnected";
      connection("disconnected", "No project selected", "Choose a project folder to begin");
      storageLabel.textContent = "No saved project settings";
      browserNotice.hidden = false;
      status("Local data cleared. Your website files were not changed.", "success");
      updateButtons();
    } catch (error) {
      status(error?.message || "Could not clear saved browser data. Close other console tabs and try again.", "error");
    } finally { clearButton.disabled = false; }
  }
  async function saveTopbar(event) {
    event.preventDefault();
    if (!rootHandle || !targetHandle) { status("Choose or reconnect your project folder before saving.", "error"); return; }
    let value;
    try { value = collectForm(); }
    catch (error) { status(error?.message || "Check the field values and try again.", "error"); return; }
    saveButton.disabled = true;
    status("Saving directly to the selected project file…");
    try {
      const latest = await (await targetHandle.getFile()).text();
      const updated = updateTopbar(latest, value);
      const writable = await targetHandle.createWritable();
      await writable.write(updated);
      await writable.close();
      connection("connected", rootHandle.name, "Project folder connected");
      saveSettings({ projectName: rootHandle.name, relativePath: targetPath, projectDisplayPath: rootHandle.name + "/" + targetPath, disconnectRequested: false });
      status("Saved directly to " + targetPath + ". Open your site preview to see the result.", "success");
    } catch (error) {
      status(error?.message || "Could not save the Topbar settings.", "error");
    } finally { saveButton.disabled = false; }
  }
  async function initialize() {
    const saved = readSettings();
    showDisconnected(saved, false);
    if (!("showDirectoryPicker" in window)) {
      browserNotice.hidden = false; status("Use Chrome or Edge to access a local project folder.", "error"); return;
    }
    try {
      rememberedRoot = await getRoot();
      const latest = readSettings();
      showDisconnected(latest, Boolean(rememberedRoot));
      if (latest.disconnectRequested || !rememberedRoot) return;
      if (await rememberedRoot.queryPermission({ mode: "readwrite" }) === "granted") await loadProject(rememberedRoot, false);
      else {
        connection("permission", latest.projectName || "Project remembered", "Reconnect to restore folder access");
        status("The project folder is remembered. Click Reconnect project to continue editing.");
        updateButtons();
      }
    } catch {
      showDisconnected(readSettings(), false);
      status("The project name is remembered, but the folder handle could not be restored. Choose the folder again.");
    }
  }

  connectButton.addEventListener("click", reconnect);
  chooseButton.addEventListener("click", chooseFolder);
  disconnectButton.addEventListener("click", disconnect);
  clearButton.addEventListener("click", clearLocalData);
  form.addEventListener("submit", saveTopbar);
  initialize();
})();
