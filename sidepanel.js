const pageDataEl = document.getElementById("pageData");
const wfStatusEl = document.getElementById("wfStatus");
const wfNameEl = document.getElementById("wfName");
const wfJsonEl = document.getElementById("wfJson");

let latestTabId = null;
let latestData = null;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function readPage() {
  const tab = await getActiveTab();
  latestTabId = tab?.id ?? null;
  const res = await chrome.runtime.sendMessage({ type: "GET_PAGE_DATA" });
  if (!res?.ok) {
    pageDataEl.textContent = `Error: ${res?.error || "Unknown"}`;
    return;
  }
  latestData = res.data;
  pageDataEl.textContent = JSON.stringify(latestData, null, 2);
}

async function saveWorkflow() {
  const name = wfNameEl.value.trim();
  if (!name) return (wfStatusEl.textContent = "Workflow name required.");
  let steps;
  try {
    steps = JSON.parse(wfJsonEl.value || "[]");
    if (!Array.isArray(steps)) throw new Error("Workflow JSON must be an array.");
  } catch (e) {
    return (wfStatusEl.textContent = `Invalid JSON: ${e.message}`);
  }
  const key = `workflow:${name}`;
  await chrome.storage.local.set({ [key]: steps });
  wfStatusEl.textContent = `Saved ${name}`;
}

async function loadWorkflow() {
  const name = wfNameEl.value.trim();
  if (!name) return (wfStatusEl.textContent = "Workflow name required.");
  const key = `workflow:${name}`;
  const data = await chrome.storage.local.get(key);
  wfJsonEl.value = JSON.stringify(data[key] || [], null, 2);
  wfStatusEl.textContent = `Loaded ${name}`;
}

async function runWorkflow() {
  if (!latestTabId) await readPage();
  let steps;
  try { steps = JSON.parse(wfJsonEl.value || "[]"); } catch { return (wfStatusEl.textContent = "Invalid workflow JSON."); }

  for (const step of steps) {
    const field = String(step.field || "");
    const value = String(step.value ?? "");
    const approved = confirm(`Approve fill?\nField: ${field}\nValue: ${value}`);
    if (!approved) {
      wfStatusEl.textContent = `Skipped ${field} (not approved).`;
      continue;
    }

    const res = await chrome.runtime.sendMessage({ type: "REQUEST_FILL", tabId: latestTabId, field, value });
    if (!res?.ok) {
      wfStatusEl.textContent = `Failed ${field}: ${res?.error || "Unknown"}`;
      return;
    }
  }
  wfStatusEl.textContent = "Workflow run complete.";
}

document.getElementById("refresh").addEventListener("click", readPage);
document.getElementById("saveWf").addEventListener("click", saveWorkflow);
document.getElementById("loadWf").addEventListener("click", loadWorkflow);
document.getElementById("runWf").addEventListener("click", runWorkflow);

readPage();
