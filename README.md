# Work Manager

A "Jira-lite" tool to enter and track work items through to completion. Proof of concept: single user, no backend (data is stored in the browser). See [PLAN.md](PLAN.md) for scope, data model and milestones.

## Develop

```bash
npm install
npm run dev     # start the dev server
npm test        # run unit tests
npm run build   # type-check and build
```

## Status

- [x] Milestone 1: foundation (Vite + React + TS, brand theme, data model, storage layer, tests)
- [x] Milestone 2: projects (create with a key, switch between projects, last project remembered)
- [x] Milestone 3: items and list view (create, edit, delete, search and filters, read-only board preview)
- [x] Milestone 4: board (drag and drop between and within columns, keyboard accessible)
- [x] Milestone 5: detail panel (side panel editing, status history, dates, time to complete)
- [ ] Milestone 6: polish and deploy
