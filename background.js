const SENSITIVE_RE = /(pass(word)?|otp|one\s*time|credit|card|cvv|cvc|ssn|social\s*security|iban|routing|bank|payment|upi|pin)/i;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_PAGE_DATA") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return sendResponse({ ok: false, error: "No active tab." });
      chrome.tabs.sendMessage(tab.id, { type: "COLLECT_PAGE_DATA" }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ ok: true, data: res });
      });
    });
    return true;
  }

  if (msg?.type === "REQUEST_FILL") {
    const { tabId, field, value } = msg;
    if (!tabId || !field) return sendResponse({ ok: false, error: "Missing fill target." });
    if (SENSITIVE_RE.test(field)) {
      return sendResponse({ ok: false, error: "Blocked: sensitive field detected." });
    }

    chrome.tabs.sendMessage(tabId, { type: "FILL_FIELD", field, value }, (res) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse(res || { ok: false, error: "Fill failed." });
    });
    return true;
  }
});
