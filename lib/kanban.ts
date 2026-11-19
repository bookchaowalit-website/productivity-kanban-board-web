// Kanban board data and pure logic, shared by the page and the MCP route.
// Three fixed columns (To do, Doing, Done); a card moves one column at a time.

export type ColumnId = "todo" | "doing" | "done";
export type Card = { id: string; title: string; notes: string; column: ColumnId };

export const STORAGE_KEY = "kanban-board-v2";

// `cue` is not shown in the page, but the MCP tool get_sample_board has always returned it, so it stays.
export const COLUMNS: { id: ColumnId; label: string; cue: string }[] = [
  { id: "todo", label: "To do", cue: "not called" },
  { id: "doing", label: "Doing", cue: "in motion" },
  { id: "done", label: "Done", cue: "ready to strike" },
];

export const INITIAL_CARDS: Card[] = [
  { id: "1", title: "Write README", notes: "Keep the limitation visible.", column: "todo" },
  { id: "2", title: "Ship utility batch", notes: "Client-side tools.", column: "doing" },
  { id: "3", title: "Fix flagships", notes: "Done earlier.", column: "done" },
];

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id));

function toCard(value: unknown): Card | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, title, notes, column } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof title !== "string" || typeof notes !== "string") return null;
  if (typeof column !== "string" || !COLUMN_IDS.has(column)) return null;
  return { id, title, notes, column: column as ColumnId };
}

/** Keep only well-formed cards in a known column from untrusted data. */
export function sanitizeCards(data: unknown[]): Card[] {
  return data.map(toCard).filter((c): c is Card => c !== null);
}

/** Parse what the page stored. Missing or corrupt data falls back to the sample board. */
export function parseCards(raw: string | null): Card[] {
  if (raw === null) return INITIAL_CARDS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return INITIAL_CARDS;
  }
  return Array.isArray(data) ? sanitizeCards(data) : INITIAL_CARDS;
}

export function serializeCards(cards: Card[]): string {
  return JSON.stringify(cards);
}

export function cardsIn(cards: Card[], column: ColumnId): Card[] {
  return cards.filter((c) => c.column === column);
}

export function summarize(cards: Card[]): Record<ColumnId, number> {
  return { todo: cardsIn(cards, "todo").length, doing: cardsIn(cards, "doing").length, done: cardsIn(cards, "done").length };
}

export function moveCard(cards: Card[], id: string, direction: -1 | 1): Card[] {
  return cards.map((card) => {
    if (card.id !== id) return card;
    const target = COLUMNS[COLUMNS.findIndex((c) => c.id === card.column) + direction];
    return target ? { ...card, column: target.id } : card;
  });
}

/** Put a card in a named column (a no-op when it is already there or the card is gone). */
export function moveCardTo(cards: Card[], id: string, column: ColumnId): Card[] {
  return cards.some((card) => card.id === id && card.column !== column)
    ? cards.map((card) => (card.id === id ? { ...card, column } : card))
    : cards;
}

export function addCard(cards: Card[], column: ColumnId, title: string, makeId: () => string): Card[] {
  const name = title.trim();
  if (!name) return cards;
  return [...cards, { id: makeId(), title: name, notes: "", column }];
}

export function updateCard(cards: Card[], id: string, change: Partial<Pick<Card, "title" | "notes">>): Card[] {
  return cards.map((c) => (c.id === id ? { ...c, ...change } : c));
}

export function deleteCard(cards: Card[], id: string): Card[] {
  return cards.filter((c) => c.id !== id);
}

export function columnLabel(column: ColumnId): string {
  return COLUMNS.find((c) => c.id === column)!.label;
}

/** The column a card lands in when moved one step, or null at either end. */
export function nextColumn(column: ColumnId, direction: -1 | 1): ColumnId | null {
  return COLUMNS[COLUMNS.findIndex((c) => c.id === column) + direction]?.id ?? null;
}

/**
 * Put a removed card back in its own column, never twice. `beforeId` / `afterId` are its old next and previous cards
 * in that column and `index` its old place in the column, so the order of other columns never matters. Before the old
 * next card if it is still in the column; else right after the old previous one (so cards added since stay after it);
 * else at its old place in the column; else at the end of the column. When the column is empty, `at` (its old place in
 * the whole list) keeps the saved order stable; column order is the same either way.
 */
export function restoreCard(cards: Card[], card: Card, beforeId: string | null, afterId: string | null = null, index?: number, at?: number): Card[] {
  if (cards.some((c) => c.id === card.id)) return cards;
  const inColumn = (id: string | null) => (id ? cards.findIndex((c) => c.id === id && c.column === card.column) : -1);
  const before = inColumn(beforeId);
  const after = before < 0 ? inColumn(afterId) : -1;
  let position: number;
  if (before >= 0) position = before;
  else if (after >= 0) position = after + 1;
  else {
    const slots = cards.flatMap((c, i) => (c.column === card.column ? [i] : []));
    const slot = index === undefined ? slots.length : Math.min(Math.max(index, 0), slots.length);
    if (slot < slots.length) position = slots[slot];
    else if (slots.length) position = slots[slots.length - 1] + 1;
    else position = at === undefined ? cards.length : Math.min(Math.max(at, 0), cards.length);
  }
  return [...cards.slice(0, position), card, ...cards.slice(position)];
}

/** Where a card sits in its own column: the next and previous cards there and its place, for restoreCard. */
export function columnPlace(cards: Card[], id: string): { beforeId: string | null; afterId: string | null; index: number; at: number } | null {
  const card = cards.find((c) => c.id === id);
  if (!card) return null;
  const column = cardsIn(cards, card.column);
  const index = column.findIndex((c) => c.id === id);
  return { beforeId: column[index + 1]?.id ?? null, afterId: column[index - 1]?.id ?? null, index, at: cards.indexOf(card) };
}

/**
 * Swap a card with its neighbour in the same column (-1 = up, 1 = down). Cards in other columns keep their places.
 * A card already at the top or bottom of its column, a missing card, or one no longer in `column`, changes nothing
 * (same array back).
 */
export function reorderCard(cards: Card[], id: string, direction: -1 | 1, column?: ColumnId): Card[] {
  const from = cards.findIndex((card) => card.id === id);
  // `column` is the column the button was pressed in: if another tab moved the card on, reorder nothing.
  if (from === -1 || (column !== undefined && cards[from].column !== column)) return cards;
  let to = from + direction;
  while (to >= 0 && to < cards.length && cards[to].column !== cards[from].column) to += direction;
  if (to < 0 || to >= cards.length) return cards;
  const next = [...cards];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
