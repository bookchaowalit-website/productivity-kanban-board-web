# Board — design

Since 2026-11-14 this app uses the shared App shell (`APP-SHELL.md`) as a board: three columns
(To do, Doing, Done) of cards with in-place title and note, buttons that move a card one column
(named after the destination), and remove with undo. Below 900px one column shows at a time,
picked with a segmented switch that carries each column's count. The earlier "prompt book" theme
below is kept for history.

---

# Prompt Book — Design direction

## Product surface

Kanban Board is a local three-column work board. Cards can be edited, annotated, moved between On deck, In rehearsal, and Cleared, added, or struck. State stays in localStorage on this origin.

## Visual world

- **Seed:** \`afda447a\`, assigned direction index \`3\` (\`operate\`)
- **World:** a stage manager's prompt book: columns are production lines, cards are pinned cue slips, movement is called with Back or Advance, and an empty column is an open line.
- **Palette:** stage charcoal \`#211c1e\`, paper slip \`#fcf8ed\`, signal red \`#c94b3b\`, warm cue gold \`#d39a55\`, and desaturated blue \`#8eabb2\`.
- **Typography:** Archivo supplies compact operational display; Space Mono makes counts, cue labels, and actions feel like a running order.
- **Composition:** the board is a dark stage with three open columns and paper slips. The only lifted surfaces are the slips themselves, using soft depth rather than generic rounded cards.
- **Interaction:** edit a cue in place, add it to a line, advance/back it, or strike it. Column names communicate a staged workflow without pretending to be a team system.
- **Responsive:** columns stack into the running order on narrow screens; actions remain text-labeled and the slip remains readable.

