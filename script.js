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

  const TARGET_ATTRIBUTE = "data-config-key";
  const TARGET_VALUE = "topbarSlogan";

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

  function readSlogan(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const elements = parsed.querySelectorAll(
      "[" + TARGET_ATTRIBUTE + '="' + TARGET_VALUE + '"]'
    );
    if (elements.length !== 1) {
      throw new Error(
        'Expected exactly one element marked data-config-key="topbarSlogan" in site/index.html; found ' +
        elements.length + "."
      );
    }
    return elements[0].textContent ?? "";
  }

  // Edit only the text inside the uniquely marked element. User input is set
  // as a text node, never interpreted as HTML.
  function replaceSlogan(html, newSlogan) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const elements = parsed.querySelectorAll(
      "[" + TARGET_ATTRIBUTE + '="' + TARGET_VALUE + '"]'
    );
    if (elements.length !== 1) {
      throw new Error(
        "Expected exactly one slogan element; found " + elements.length + ". No file was changed."
      );
    }
    const element = elements[0];
    while (element.firstChild) element.removeChild(element.firstChild);
    element.appendChild(parsed.createTextNode(newSlogan));
    return "<!doctype html>\n" + parsed.documentElement.outerHTML;
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

      // Store handles only after the chosen folder passes validation.
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
      // Any intervening edit requires a reload to prevent overwriting changes.
      if (latestHtml !== originalHtml) {
        throw new Error("The HTML file changed since you loaded it. Re-select the folder to reload and review it before saving.");
      }

      const backupName = "index.html.backup-" +
        new Date().toISOString().replace(/[:.]/g, "-");
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