// Global keyboard shortcuts must not fire while the user is typing, inside a
// modal, during IME composition, or on auto-repeat. Keeping this in one helper
// prevents each shortcut from growing its own partial guard.
const MODAL_SELECTOR = [
  ".modal-backdrop",
  ".batch-import-overlay",
  ".detail-overlay",
  ".legacy-import-overlay",
  ".cropper-overlay",
  ".image-viewer",
  ".appearance-section-modal-backdrop",
  "[data-modal-layer]",
].join(",");

export function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function hasOpenModal(root = typeof document !== "undefined" ? document : null) {
  return !!root?.querySelector?.(MODAL_SELECTOR);
}

export function shouldHandleGlobalShortcut(event, { modalOpen = false } = {}) {
  if (!event || event.defaultPrevented || event.repeat) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  if (modalOpen || isTypingTarget(event.target)) return false;
  return true;
}
