import { type ReactNode, useEffect, useRef } from "react";

interface DrawerProps {
  title: string;
  titleId: string;
  onClose(): void;
  children: ReactNode;
}

/** Right-hand side panel. Focuses the first field, closes on Esc, close button or backdrop click. */
export function Drawer({ title, titleId, onClose, children }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-10 bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="drawer-enter absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md px-2 py-1 text-xl leading-none text-brand-gray hover:bg-surface"
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
