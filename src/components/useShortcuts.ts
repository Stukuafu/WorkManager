import { useEffect } from "react";

interface Shortcuts {
  onNewItem(): void;
  onSearch(): void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** Global shortcuts: "c" creates an item, "/" jumps to search. Ignored while typing or in a dialog. */
export function useShortcuts({ onNewItem, onSearch }: Shortcuts, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target) || document.querySelector('[role="dialog"]')) return;
      if (event.key === "c") {
        event.preventDefault();
        onNewItem();
      } else if (event.key === "/") {
        event.preventDefault();
        onSearch();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, onNewItem, onSearch]);
}
