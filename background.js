console.log("AgentBridge background running");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "get_current_page") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) {
      sendResponse({ error: "No active tab found." });
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, { type: "get_current_page" }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ data: response || null });
    });
  });

  return true;
});
