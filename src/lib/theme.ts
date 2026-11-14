export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "work-manager:theme";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System theme" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Anything other than an explicit light or dark choice means "follow the system". */
export function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function readStoredTheme(): ThemePreference {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function storeTheme(theme: ThemePreference): void {
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A theme choice is a convenience; carry on without saving it.
  }
}

/** Light and dark set data-theme on <html>; "system" removes it so the media query decides. */
export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
