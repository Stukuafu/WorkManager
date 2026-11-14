const PROJECT_KEY_PATTERN = /^[A-Z]{2,5}$/;

/** Trim and upper-case user input for a project key. */
export function normalizeProjectKey(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidProjectKey(key: string): boolean {
  return PROJECT_KEY_PATTERN.test(key);
}

/** Human-readable item key, e.g. "WM-12". */
export function formatItemKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** Parse "WM-12" into its parts, or null if it is not a valid item key. */
export function parseItemKey(value: string): { projectKey: string; number: number } | null {
  const match = /^([A-Z]{2,5})-([1-9]\d*)$/.exec(value.trim().toUpperCase());
  if (!match) return null;
  return { projectKey: match[1], number: Number(match[2]) };
}

/**
 * Suggest a project key from a project name.
 * Multi-word names use initials ("Work Manager" -> "WM");
 * single words use the first letters ("Billing" -> "BILL").
 * Returns "" if the name has no usable letters.
 */
export function suggestProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4);
  return words.map((w) => w[0]).join("").slice(0, 5);
}
