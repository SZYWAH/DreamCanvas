import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const overlayStack: string[] = [];
let bodyLockCount = 0;

const pushOverlay = (id: string) => overlayStack.push(id);
const removeOverlay = (id: string) => {
  const index = overlayStack.lastIndexOf(id);
  if (index >= 0) overlayStack.splice(index, 1);
};
const isTopOverlay = (id: string) => overlayStack.at(-1) === id;

interface OverlayProps {
  title: string;
  eyebrow?: string;
  mode?: "sheet" | "editor" | "dialog";
  onDismiss: () => void;
  children: (close: (action?: () => void) => void) => React.ReactNode;
  className?: string;
}

export function Overlay({ title, eyebrow, mode = "sheet", onDismiss, children, className = "" }: OverlayProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const backdropPointerStarted = useRef(false);
  const backdropPointerEnded = useRef(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const requestClose = (action?: () => void) => {
    if (!isTopOverlay(id)) return;
    action?.();
    window.history.back();
  };

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    pushOverlay(id);
    bodyLockCount += 1;
    document.body.classList.add("modal-open");
    if (window.history.state?.dreamCanvasOverlay !== id) {
      window.history.pushState({ dreamCanvasOverlay: id }, "");
    }

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    window.setTimeout(() => firstFocusable?.focus(), 0);

    const onPopState = () => {
      if (!isTopOverlay(id)) return;
      dismissRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(id)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      removeOverlay(id);
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (!bodyLockCount) document.body.classList.remove("modal-open");
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [id]);

  return (
    <div
      className="overlay-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        backdropPointerStarted.current = event.target === event.currentTarget;
        backdropPointerEnded.current = false;
      }}
      onPointerUp={(event) => {
        backdropPointerEnded.current = event.target === event.currentTarget;
      }}
      onPointerCancel={() => {
        backdropPointerStarted.current = false;
        backdropPointerEnded.current = false;
      }}
      onClick={(event) => {
        const shouldClose = mode !== "editor"
          && backdropPointerStarted.current
          && backdropPointerEnded.current
          && event.target === event.currentTarget;
        backdropPointerStarted.current = false;
        backdropPointerEnded.current = false;
        if (!shouldClose) return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
    >
      <section
        ref={panelRef}
        className={`overlay-panel overlay-${mode} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="overlay-header">
          <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2 id={titleId}>{title}</h2></div>
          <button type="button" className="icon-button" aria-label="关闭" onClick={() => requestClose()}><X size={20} /></button>
        </header>
        {children(requestClose)}
      </section>
    </div>
  );
}
