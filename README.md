# Work Manager

A "Jira-lite" tool to enter and track work items through to completion. Proof of concept: single user, no backend (data is stored in the browser). See [PLAN.md](PLAN.md) for scope, data model and milestones.

## Develop

```bash
npm install
npm run dev     # start the dev server
npm test        # run unit tests
npm run build   # type-check and build
```

## Features

- Projects with a short key; items are numbered `KEY-1`, `KEY-2`, ... and keys are never reused
- Fixed workflow: To Do, In Progress, In Review, Done
- List view with search (including note text), filters and sortable columns (click a header; click again to reverse), and a drag-and-drop board (mouse, touch and keyboard)
- Detail panel with status history, dates and time to complete
- Stories with tasks: add new tasks to a story, or pick an existing task or bug to link to it, with a progress bar, parent chips, and a filter by story
- Notes on each item (add, edit, delete), with note counts on the list and board
- Backup: export and import all data as JSON, including notes (data lives in this browser only). Backups from earlier versions still import
- Shortcuts: `C` new item, `/` search
- Styled with the Ricoh brand palette, shape language and Arial fallback typography (no logo)

## Deploy

Pushes to `main` run lint, tests and build, then publish to GitHub Pages via `.github/workflows/deploy.yml`.
In the repository settings, set **Pages > Source** to **GitHub Actions** once.

## Status

- [x] Milestone 1: foundation (Vite + React + TS, brand theme, data model, storage layer, tests)
- [x] Milestone 2: projects (create with a key, switch between projects, last project remembered)
- [x] Milestone 3: items and list view (create, edit, delete, search and filters, read-only board preview)
- [x] Milestone 4: board (drag and drop between and within columns, keyboard accessible)
- [x] Milestone 5: detail panel (side panel editing, status history, dates, time to complete)
- [x] Milestone 6: polish and deploy (JSON backup, shortcuts, accessibility pass, GitHub Pages workflow)
