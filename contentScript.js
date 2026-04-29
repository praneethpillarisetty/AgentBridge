console.log("AgentBridge loaded");

const BLOCKED_FILL_KEYWORDS = ["card", "cvv", "otp", "ssn"];

function extractLabel(field) {
  const ariaLabel = field.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  if (field.id) {
    const labelNode = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    if (labelNode?.innerText) return labelNode.innerText.trim();
  }

  const wrappedLabel = field.closest("label");
  if (wrappedLabel?.innerText) return wrappedLabel.innerText.trim();

  return "";
}

function serializeField(field) {
  const tag = field.tagName.toLowerCase();
  const inputType = (field.getAttribute("type") || "text").toLowerCase();
  return {
    label: extractLabel(field),
    type: tag === "input" ? inputType : tag,
    id: field.id || "",
    name: field.getAttribute("name") || "",
    placeholder: field.getAttribute("placeholder") || "",
  };
}

function getForms() {
  const fields = Array.from(document.querySelectorAll("input, textarea, select"));
  return fields.map(serializeField);
}

function isBlockedField(element) {
  const type = (element.getAttribute("type") || "").toLowerCase();
  const id = (element.id || "").toLowerCase();
  const name = (element.getAttribute("name") || "").toLowerCase();
  const placeholder = (element.getAttribute("placeholder") || "").toLowerCase();

  if (type === "password") return true;

  return BLOCKED_FILL_KEYWORDS.some((keyword) =>
    [type, id, name, placeholder].some((source) => source.includes(keyword)),
  );
}

function fillField(selector, value) {
  if (!selector) {
    return { ok: false, error: "Missing selector." };
  }

  const element = document.querySelector(selector);
  if (!element) {
    return { ok: false, error: "Element not found." };
  }

  const tag = element.tagName.toLowerCase();
  if (!["input", "textarea", "select"].includes(tag)) {
    return { ok: false, error: "Target is not a fillable form field." };
  }

  if (isBlockedField(element)) {
    return { ok: false, error: "Blocked sensitive field." };
  }

  element.focus();
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  return { ok: true, selector };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get_current_page") {
    const selection = window.getSelection ? window.getSelection().toString() : "";
    const bodyText = (document.body?.innerText || "").slice(0, 10000);

    sendResponse({
      title: document.title || "",
      url: window.location.href || "",
      selectedText: selection,
      bodyText,
    });
    return;
  }

  if (message?.type === "get_forms") {
    sendResponse(getForms());
    return;
  }

  if (message?.type === "fill_field") {
    sendResponse(fillField(message.selector, message.value || ""));
  }
});
