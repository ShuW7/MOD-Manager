import React from "react";
import ReactDOM from "react-dom";

// Shared dialog layer: one Esc stack, one focus trap and one busy-close policy
// for every modal surface. Components with custom markup can use the hook
// directly; the <Modal> wrapper covers the common backdrop/content shape.
const layers = [];
let nextLayerId = 1;

function focusableElements(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0);
}

export function useDialogLayer({
  open,
  onClose,
  closeDisabled = false,
  containerRef,
  initialFocusRef,
  restoreFocus = true,
}) {
  const idRef = React.useRef(null);
  if (idRef.current === null) idRef.current = nextLayerId++;
  const onCloseRef = React.useRef(onClose);
  const closeDisabledRef = React.useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  React.useEffect(() => {
    if (!open) return undefined;
    const entry = {
      id: idRef.current,
      close: (event) => {
        if (!closeDisabledRef.current) onCloseRef.current?.(event);
      },
    };
    layers.push(entry);
    return () => {
      const index = layers.findIndex((layer) => layer.id === entry.id);
      if (index >= 0) layers.splice(index, 1);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const container = containerRef?.current;
      const preferred =
        initialFocusRef?.current ||
        container?.querySelector("[autofocus]") ||
        focusableElements(container)[0] ||
        container;
      initialFocusRef?.current?.focus?.();
      if (initialFocusRef?.current) return;
      if (preferred === container) container?.setAttribute?.("tabindex", "-1");
      preferred?.focus?.({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (
        restoreFocus &&
        previous instanceof HTMLElement &&
        previous.isConnected
      ) {
        previous.focus?.({ preventScroll: true });
      }
    };
  }, [open, containerRef, initialFocusRef, restoreFocus]);

  React.useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      const top = layers[layers.length - 1];
      if (!top || top.id !== idRef.current) return;
      if (event.key === "Escape") {
        if (closeDisabledRef.current) return;
        event.preventDefault();
        top.close(event);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusableElements(containerRef?.current);
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (!containerRef?.current?.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, containerRef]);
}

export function Modal({
  open,
  onClose,
  closeDisabled = false,
  overlayClassName = "modal-backdrop",
  contentClassName = "modal-content",
  contentStyle,
  initialFocusRef,
  restoreFocus = true,
  labelledBy,
  ariaLabel,
  children,
  ...rest
}) {
  const containerRef = React.useRef(null);
  useDialogLayer({
    open,
    onClose,
    closeDisabled,
    containerRef,
    initialFocusRef,
    restoreFocus,
  });
  if (!open) return null;
  return ReactDOM.createPortal(
    <div
      className={overlayClassName}
      data-modal-layer="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose?.();
      }}
    >
      <div
        ref={containerRef}
        className={contentClassName}
        style={contentStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        {...rest}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
