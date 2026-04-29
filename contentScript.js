const MAX_TEXT = 6000;
const SENSITIVE_RE = /(pass(word)?|otp|one\s*time|credit|card|cvv|cvc|ssn|social\s*security|iban|routing|bank|payment|upi|pin)/i;

function getVisibleText() {
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  let out = "";
  let node;
  while ((node = walker.nextNode())) {
    const txt = node.nodeValue?.trim();
    if (!txt) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    out += txt + " ";
    if (out.length >= MAX_TEXT) break;
  }
  return out.slice(0, MAX_TEXT);
}

function detectForms() {
  return [...document.forms].map((form, i) => {
    const fields = [...form.querySelectorAll("input, textarea, select")].map((el, j) => {
      const key = [el.name, el.id, el.getAttribute("aria-label"), el.type].filter(Boolean).join(" ");
      return {
        key: key || `field_${i}_${j}`,
        tag: el.tagName.toLowerCase(),
        type: (el.type || "").toLowerCase(),
        blocked: SENSITIVE_RE.test(key)
      };
    });
    return { index: i, fields };
  });
}

function findFillTarget(fieldKey) {
  const all = [...document.querySelectorAll("input, textarea, select")];
  return all.find((el) => {
    const key = [el.name, el.id, el.getAttribute("aria-label"), el.type].filter(Boolean).join(" ");
    return key === fieldKey;
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "COLLECT_PAGE_DATA") {
    sendResponse({
      title: document.title,
      url: location.href,
      selectedText: (window.getSelection()?.toString() || "").trim().slice(0, 2000),
      visibleText: getVisibleText(),
      forms: detectForms()
    });
  }

  if (msg?.type === "FILL_FIELD") {
    const { field, value } = msg;
    if (SENSITIVE_RE.test(field)) return sendResponse({ ok: false, error: "Blocked sensitive field." });

    const target = findFillTarget(field);
    if (!target) return sendResponse({ ok: false, error: "Field not found." });

    target.focus();
    target.value = value ?? "";
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    sendResponse({ ok: true });
  }
});
