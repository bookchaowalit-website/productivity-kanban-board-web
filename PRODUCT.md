# Kanban Board — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `kanban-board`, evidence Prototype) on 2026-10-23.

## What it is

A client-only kanban board with three fixed columns, styled as a stage manager's prompt book. Cards live in this
browser's localStorage (key `kanban-board-v2`).

## Who it is for

A portfolio visitor, or one person in one browser, who wants a small to-do / doing / done board.

## What works today

1. Add a card to any of the three columns (blank titles are ignored).
2. Edit a card's title and note in place.
3. Move a card one column back or forward with the Back / Advance buttons (disabled at the first and last column).
4. Delete a card ("Strike"). The header counts cards; the summary counts cleared cards.
5. Changes persist across reloads in this browser. Corrupt or foreign data in the storage key no longer crashes the
   board: it falls back to the sample cards and drops malformed cards or unknown columns.
6. `/api/mcp` answers JSON-RPC with `get_sample_board` and `summarize_board` (counts cards the caller sends per
   column). The server cannot see a visitor's cards, which stay in the browser.
7. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No drag and drop (no DnD library), no custom or extra columns, no keyboard shortcuts, no multiple boards
  (claims removed from the portfolio card in the 2026-10 review).
- No account, collaborators, sync, attachments or export. Clearing site data removes everything.
- No product analytics beyond Vercel Analytics.

## Live URL and deploy state

- Live: https://kanban-board.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-kanban-board-frontend` is deployed only by CLI. The last production deploy is the
  CVE patch (2026-10-23 12:21 +07, commit 5dda756, Next 16.4.2). Its Git link names the old repository
  (`bookchaowalit/bookchaowalit-kanban-board-frontend`), so a push to `main` does not deploy: the live site lags
  `main` (no Sentry, old template MCP route) until the owner reconnects Vercel Git to this repository (owner action D9).
- `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project (Sentry project `productivity-kanban-board-web`, org
  `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
