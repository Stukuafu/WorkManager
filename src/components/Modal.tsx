import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  title: string;
  titleId: string;
  onClose(): void;
  children: ReactNode;
}

/** Accessible modal: focuses the first field, closes on Esc or backdrop click. */
export function Modal({ title, titleId, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
    <div
      className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-card bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="mb-4 text-xl">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-ink placeholder:text-brand-gray/60 focus:border-brand-red";
