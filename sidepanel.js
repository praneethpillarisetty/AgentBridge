const ui = {
  getPageDataButton: document.getElementById("get-page-data"),
  getFormsButton: document.getElementById("get-forms"),
  testFillFieldButton: document.getElementById("test-fill-field"),
  approveButton: document.getElementById("approve-action"),
  denyButton: document.getElementById("deny-action"),
  result: document.getElementById("result"),
  approvalRequest: document.getElementById("approval-request"),
};

const STORAGE_KEYS = {
  approvalRequest: "approval_request",
  approvalResponse: "approval_response",
};

function setResult(value) {
  ui.result.textContent = JSON.stringify(value, null, 2);
}

function setApprovalRequestDisplay(request) {
  if (!request) {
    ui.approvalRequest.textContent = "No pending request.";
    ui.approveButton.disabled = true;
    ui.denyButton.disabled = true;
    return;
  }

  const summary = {
    toolName: request.toolName || "",
    selector: request.selector || "",
    value: request.value || "",
  };

  ui.approvalRequest.textContent = JSON.stringify(summary, null, 2);
  ui.approveButton.disabled = false;
  ui.denyButton.disabled = false;
}

function sendMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response);
    });
  });
}

async function respondToApproval(approved) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.approvalRequest);
  const request = data[STORAGE_KEYS.approvalRequest];
  if (!request) {
    setResult({ error: "No pending approval request." });
    return;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.approvalResponse]: {
      requestId: request.requestId,
      approved,
      respondedAt: Date.now(),
    },
  });
}

function bindEvents() {
  ui.getPageDataButton?.addEventListener("click", async () => {
    setResult("Loading...");
    const response = await sendMessage({ type: "get_current_page" });
    setResult(response);
  });

  ui.getFormsButton?.addEventListener("click", async () => {
    setResult("Loading forms...");
    const response = await sendMessage({ type: "get_forms" });
    setResult(response);
  });

  ui.testFillFieldButton?.addEventListener("click", async () => {
    setResult("Requesting fill approval...");
    const response = await sendMessage({
      type: "fill_field",
      selector: "input[type='text'], textarea",
      value: "AgentBridge test value",
    });
    setResult(response);
  });

  ui.approveButton?.addEventListener("click", async () => {
    await respondToApproval(true);
  });

  ui.denyButton?.addEventListener("click", async () => {
    await respondToApproval(false);
  });
}

function initApprovalWatcher() {
  chrome.storage.local.get(STORAGE_KEYS.approvalRequest).then((data) => {
    setApprovalRequestDisplay(data[STORAGE_KEYS.approvalRequest]);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[STORAGE_KEYS.approvalRequest]) {
      setApprovalRequestDisplay(changes[STORAGE_KEYS.approvalRequest].newValue || null);
    }
  });
}

bindEvents();
initApprovalWatcher();
