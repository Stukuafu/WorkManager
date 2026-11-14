# Work Manager: Project Plan

A "Jira-lite" tool to enter and track work items through to completion.
Status: **proof of concept**, single user, no backend.

## 1. Scope decisions

| Question | Decision |
|---|---|
| Users | Just one (no auth, no assignee field) |
| Workflow | Fixed: `To Do → In Progress → In Review → Done` |
| Item keys | Yes, in v1: per-project key, e.g. `WM-12` |
| Storage | Browser storage behind a repository interface (backend can be swapped in later) |
| Branching | Work directly on `main` |
| Look and feel | Modern, reactive UI following the Ricoh brand guidelines (see section 5) |

## 2. Tech stack

- **React + TypeScript + Vite** (static build, no server)
- **State:** Zustand (small, simple) or React context + reducer
- **Storage:** `localStorage` behind a `Repository` interface (`IndexedDB` is a later option)
- **Styling:** Tailwind CSS with design tokens for the brand palette (section 5)
- **Drag and drop:** `dnd-kit`
- **Testing:** Vitest + React Testing Library for the data layer and key components
- **Deploy:** GitHub Pages (static)

## 3. Data model

All entities have a string `id` (UUID), `createdAt` and `updatedAt` (ISO timestamps) so a real backend can replace local storage later.

```ts
type Status = "todo" | "in_progress" | "in_review" | "done";
type Priority = "low" | "medium" | "high" | "critical";
type ItemType = "task" | "bug" | "story";

interface Project {
  id: string;
  key: string;          // 2-5 uppercase letters, unique, e.g. "WM"
  name: string;
  nextNumber: number;   // counter for item keys; never reused, even after delete
  createdAt: string;
  updatedAt: string;
}

interface WorkItem {
  id: string;
  projectId: string;
  number: number;       // key = `${project.key}-${number}`
  title: string;
  description: string;
  type: ItemType;
  status: Status;
  priority: Priority;
  labels: string[];
  dueDate?: string;
  order: number;        // position within a board column
  createdAt: string;
  updatedAt: string;
  completedAt?: string; // set when status becomes "done", cleared if reopened
}

interface StatusChange {  // lightweight history log (milestone 5)
  id: string;
  itemId: string;
  from: Status | null;
  to: Status;
  at: string;
}
```

Rules:
- Item keys are permanent. Deleting `WM-3` never frees the number.
- A project key cannot be changed once it has items.
- Any status can move to any other (no transition rules in the PoC).

## 4. Architecture notes

- `src/domain/` holds pure types and logic (key generation, status rules). No React imports.
- `src/storage/` has a `Repository` interface and a `LocalStorageRepository` implementation. The UI only talks to the interface.
- `src/store/` holds app state, hydrated from the repository on load and written back on change.
- `src/components/` and `src/views/` hold the UI. Views: Board, List, Item detail panel, Project switcher.
- Include a schema `version` in the stored data, with a migration hook for future changes.
- JSON export/import is a built-in safeguard, since data lives in one browser.

## 5. Look and feel (Ricoh brand guidelines v6.0)

Source: *RICOH Brand Communication Guidelines*, Version 6.0, December 2024 (internal use only).

**Colour tokens**

| Token | Value | Use |
|---|---|---|
| `brand-red` | `#CF122E` (sRGB 207/18/46) | Primary actions, active states, key accents |
| `brand-gray` | `#64666A` (sRGB 100/102/106) | Body text, secondary UI |
| `white` | `#FFFFFF` | Backgrounds, cards |
| Secondary: pink | `#FF9AA8` (255/154/168) | Status/priority/label accents |
| Secondary: yellow | `#FFC13D` (255/193/61) | Status/priority/label accents |
| Secondary: green | `#96C120` (150/193/32) | Status/priority/label accents |
| Secondary: teal | `#00A9C5` (0/169/197) | Status/priority/label accents |
| Secondary: blue | `#5EA8E6` (94/168/230) | Status/priority/label accents |

Muted and pastel secondary sets are available for soft backgrounds (e.g. pastel tints for column headers).

**Typography:** The brand typeface is Frutiger (45 Light, 55 Roman, 65 Bold, 75 Black), with **Arial** as the permitted substitute. Frutiger is a licensed font, so the PoC uses a font stack of `Frutiger, Arial, sans-serif` and ships Arial/system fonts until a licence is confirmed. Style: simple, clear, easy to read; light weights for headings, regular for body.

**Shape language:** the "Imagination Balloon", a rounded square with a small rounded square tab at the bottom-right corner. Use it sparingly as a graphic accent (empty states, header motif, item-key chip). Guideline rules to respect: no outline on a coloured balloon, never thicken an outline, and keep colours to the palette above.

**Principles:** red is the lead colour with gray and white as the base, and secondary colours are used as the second or third colour after red. Generous white space and rounded corners throughout.

**Decisions:**
- Applying the brand theming (palette, typography, shape language) to this app is **approved**.
- The Ricoh logo and tagline are protected marks with their own usage rules (protected area, colour, placement). The PoC does **not** include the logo. If it is wanted later, we follow section 3.1-3.3 of the guidelines.

## 6. Modern and reactive UI goals

- Responsive layout (desktop first, usable on tablet/phone)
- Instant optimistic updates, with no loading spinners for local data
- Smooth drag-and-drop with animated card movement and column highlighting
- Keyboard shortcuts: `C` create item, `/` search, `Esc` close panel
- Light theme first (brand palette); dark mode is a later option
- Accessible: visible focus states, sufficient contrast (checked for red/gray on white), ARIA labels on drag handles

## 7. Milestones

Each milestone ends with something you can click through.

1. **Foundation:** Vite + React + TS, Tailwind with brand tokens, the domain types, the `Repository` interface and the localStorage implementation, and unit tests for key generation.
2. **Projects:** create a project with a key, list projects, and a project switcher.
3. **Items and list view:** create, edit, and delete items with generated keys (`WM-1`). List view with search and filters (status, priority, type, label).
4. **Board:** Kanban columns for the four statuses with drag-and-drop between columns and reordering within a column.
5. **Detail panel:** side panel with full editing, status history from `StatusChange`, and `completedAt` tracking.
6. **Polish and deploy:** JSON export/import, empty states, keyboard shortcuts, accessibility pass, and GitHub Pages deployment.

## 7a. Added after the milestones

- **Notes:** free-text notes on each item (add, edit, delete). Stored as `Note { id, itemId, body, createdAt, updatedAt }`. Storage schema is now **version 2**; version 1 data and backups are upgraded automatically (they simply have no notes). Deleting an item deletes its notes.

- **Stories with tasks:** `WorkItem.parentId`. Only stories can have children (tasks or bugs); stories cannot nest; parent and child must share a project. A story's progress is calculated from its tasks (done / total); its own status stays manual. Deleting a story keeps its tasks and unlinks them. A story with tasks cannot be changed to another type. Schema is now **version 3**; versions 1 and 2 upgrade automatically.

- **Search in notes:** the list search also matches note text; rows that matched only through a note are labelled.
- **Saved filters:** named sets of list filters, per project (`SavedFilter`). Saving under an existing name (ignoring case) replaces it; at most 30 per project. A saved label or story that no longer exists is dropped when the filter is applied. Schema is now **version 4**; versions 1-3 upgrade automatically.

## 8. Out of scope for the PoC (possible later)

Sprints and backlog, time tracking and estimates, dashboards and burndown, custom workflows, multi-user accounts and assignees, notifications, attachments, a backend (Supabase or a Node API), and dark mode.

## 9. Risks and open questions

- **Data lives in one browser.** Clearing site data loses it. Mitigated by export/import.
- **Frutiger licensing.** Arial fallback until confirmed.
- **Brand usage.** The guidelines are marked internal use only and the repo is public. Theming is approved; the logo is excluded.
- **Naming.** The app title is **Work Manager** (repo: `WorkManager`).
