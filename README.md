# Kanban Board

A browser-only kanban board styled as a stage manager's "prompt book": three fixed columns (On deck, In
rehearsal, Cleared). Add a card to any column, edit its title and note, move it one column with Back or Advance,
or delete it ("Strike"). Cards stay in this browser's localStorage; a fresh browser starts with three sample cards.

Live: https://kanban-board.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No drag and drop, no custom or extra columns, no keyboard shortcuts, no multiple boards.
- No account, collaborators, sync or attachments.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: board logic, storage store, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/kanban.ts`: the fixed columns, sample cards, `parseCards` (validates stored data, falls back to the sample
  board on corrupt storage) and the card actions used by the page.
- `lib/local-store.ts`: a small localStorage store read with `useSyncExternalStore` (no setState in an effect).
  This repository owns its copy.
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint with `get_sample_board` and `summarize_board`.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
