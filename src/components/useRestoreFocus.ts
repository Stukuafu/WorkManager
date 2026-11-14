import { useEffect, useRef } from "react";

/** Remember what had focus when a dialog opened and give it back when the dialog closes. */
export function useRestoreFocus(): void {
  const previous = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    const element = previous.current;
    return () => {
      if (element instanceof HTMLElement && element.isConnected) element.focus();
    };
  }, []);
}
