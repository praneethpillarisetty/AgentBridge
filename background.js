console.log("AgentBridge background running");

const STORAGE_KEYS = {
  approvalRequest: "approval_request",
  approvalResponse: "approval_response",
};

const TOOL_NAMES = {
  fillField: "fill_field",
};

function getActiveTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        reject(new Error("No active tab found."));
        return;
      }

      resolve(activeTab.id);
    });
  });
}

function sendToActiveTab(payload) {
  return new Promise(async (resolve, reject) => {
    let tabId;

    try {
      tabId = await getActiveTabId();
    } catch (error) {
      reject(error);
      return;
    }

    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response || null);
    });
  });
}

function clearApprovalStorage() {
  return chrome.storage.local.remove([STORAGE_KEYS.approvalRequest, STORAGE_KEYS.approvalResponse]);
}

function waitForApproval(requestId) {
  return new Promise((resolve) => {
    const listener = (changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes[STORAGE_KEYS.approvalResponse]?.newValue) return;

      const approval = changes[STORAGE_KEYS.approvalResponse].newValue;
      if (approval.requestId !== requestId) return;

      chrome.storage.onChanged.removeListener(listener);
      resolve(approval);
    };

    chrome.storage.onChanged.addListener(listener);
  });
}

async function requestApproval(toolRequest) {
  const requestId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await clearApprovalStorage();
  await chrome.storage.local.set({
    [STORAGE_KEYS.approvalRequest]: {
      requestId,
      ...toolRequest,
      createdAt: Date.now(),
    },
  });

  const response = await waitForApproval(requestId);
  await clearApprovalStorage();
  return response;
}

async function handleGetCurrentPage(sendResponse) {
  try {
    const response = await sendToActiveTab({ type: "get_current_page" });
    sendResponse({ data: response || null });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleGetForms(sendResponse) {
  try {
    const response = await sendToActiveTab({ type: "get_forms" });
    sendResponse({ data: response || [] });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleFillField(selector, value, sendResponse) {
  try {
    const approval = await requestApproval({
      toolName: TOOL_NAMES.fillField,
      selector: selector || "",
      value: value || "",
    });

    if (!approval.approved) {
      sendResponse({ denied: true, reason: "User denied action." });
      return;
    }

    const response = await sendToActiveTab({
      type: "fill_field",
      selector,
      value,
    });

    sendResponse({ data: response || null });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return;

  if (message.type === "get_current_page") {
    handleGetCurrentPage(sendResponse);
    return true;
  }

  if (message.type === "get_forms") {
    handleGetForms(sendResponse);
    return true;
  }

  if (message.type === "fill_field") {
    handleFillField(message.selector, message.value, sendResponse);
    return true;
  }
});
