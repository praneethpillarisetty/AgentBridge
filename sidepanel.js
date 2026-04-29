const button = document.getElementById("get-page-data");
const result = document.getElementById("result");

button?.addEventListener("click", () => {
  result.textContent = "Loading...";

  chrome.runtime.sendMessage({ type: "get_current_page" }, (response) => {
    if (chrome.runtime.lastError) {
      result.textContent = JSON.stringify({ error: chrome.runtime.lastError.message }, null, 2);
      return;
    }

    result.textContent = JSON.stringify(response, null, 2);
  });
});
