import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, storeTheme, THEME_OPTIONS, type ThemePreference } from "../lib/theme";

/** Light, dark or follow-the-system. The choice is remembered in this browser. */
export function ThemeSelect() {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  return (
    <select
      aria-label="Theme"
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemePreference)}
      className="rounded-md border border-line bg-card px-2 py-2 text-sm font-bold text-ink hover:border-brand-gray"
    >
      {THEME_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
