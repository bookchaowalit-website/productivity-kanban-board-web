// Kanban board ("prompt book") data and pure logic, shared by the page and the MCP route.
// Three fixed columns; cards move one column at a time with Back / Advance.

export type ColumnId = "todo" | "doing" | "done";
export type Card = { id: string; title: string; notes: string; column: ColumnId };

export const STORAGE_KEY = "kanban-board-v2";

export const COLUMNS: { id: ColumnId; label: string; cue: string }[] = [
  { id: "todo", label: "On deck", cue: "not called" },
  { id: "doing", label: "In rehearsal", cue: "in motion" },
  { id: "done", label: "Cleared", cue: "ready to strike" },
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
