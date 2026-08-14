// Small shared UI helpers — replaces sonner (toast) and Radix Dialog/Tabs.

function ensureToastRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {string} message
 * @param {{type?: "success"|"error"|"info", action?: {label: string, onClick: () => void}}} [opts]
 */
function toast(message, opts = {}) {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  el.className = `toast${opts.type === "error" ? " toast-error" : ""}`;

  const text = document.createElement("span");
  text.className = "flex-1";
  text.textContent = message;
  el.appendChild(text);

  if (opts.action) {
    const btn = document.createElement("button");
    btn.textContent = opts.action.label;
    btn.className = "underline font-medium shrink-0";
    btn.addEventListener("click", () => {
      opts.action.onClick();
      el.remove();
    });
    el.appendChild(btn);
  }

  root.appendChild(el);
  setTimeout(() => el.remove(), opts.action ? 8000 : 4000);
}

toast.success = (message) => toast(message, { type: "success" });
toast.error = (message, opts) => toast(message, { ...opts, type: "error" });

/** Opens a native <dialog> element (by id or reference), matching Radix Dialog behavior closely enough. */
function openDialog(dialogOrId) {
  const dialog = typeof dialogOrId === "string" ? document.getElementById(dialogOrId) : dialogOrId;
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(dialogOrId) {
  const dialog = typeof dialogOrId === "string" ? document.getElementById(dialogOrId) : dialogOrId;
  if (dialog && dialog.open) dialog.close();
}

// Close a <dialog> when the user clicks its backdrop (native <dialog> only closes on Escape by default).
document.addEventListener("click", (e) => {
  if (e.target.tagName === "DIALOG" && e.target.open) {
    const rect = e.target.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) e.target.close();
  }
});

/**
 * Wires up a simple tab group: buttons with [data-tab-trigger] toggle sibling
 * elements with [data-tab-content] that share the same value, inside `root`.
 */
function initTabs(root, { onChange } = {}) {
  const triggers = root.querySelectorAll("[data-tab-trigger]");
  const contents = root.querySelectorAll("[data-tab-content]");

  function activate(value) {
    triggers.forEach((t) => {
      const active = t.dataset.tabTrigger === value;
      t.setAttribute("aria-selected", String(active));
      t.classList.toggle("tab-active", active);
    });
    contents.forEach((c) => {
      c.classList.toggle("hidden", c.dataset.tabContent !== value);
    });
    if (onChange) onChange(value);
  }

  triggers.forEach((t) => {
    t.addEventListener("click", () => {
      if (t.disabled) return;
      activate(t.dataset.tabTrigger);
    });
  });

  return { activate };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
