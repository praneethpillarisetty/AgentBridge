console.log("AgentBridge loaded");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "get_current_page") return;

  const selection = window.getSelection ? window.getSelection().toString() : "";
  const bodyText = (document.body?.innerText || "").slice(0, 10000);

  sendResponse({
    title: document.title || "",
    url: window.location.href || "",
    selectedText: selection,
    bodyText,
  });
});
