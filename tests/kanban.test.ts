import { describe, expect, it } from "vitest";
import {
  columnPlace,
  reorderCard,
  COLUMNS,
  columnLabel,
  nextColumn,
  restoreCard,
  INITIAL_CARDS,
  addCard,
  cardsIn,
  deleteCard,
  moveCard,
  moveCardTo,
  parseCards,
  serializeCards,
  summarize,
  updateCard,
  type Card,
} from "@/lib/kanban";

const cards: Card[] = [
  { id: "a", title: "A", notes: "", column: "todo" },
  { id: "b", title: "B", notes: "n", column: "doing" },
  { id: "c", title: "C", notes: "", column: "done" },
];

describe("parseCards", () => {
  it("falls back to the sample board when nothing is stored", () => {
    expect(parseCards(null)).toEqual(INITIAL_CARDS);
  });

  it("round-trips what serializeCards wrote", () => {
    expect(parseCards(serializeCards(cards))).toEqual(cards);
  });

  // Bug: the page did JSON.parse(saved) as Card[] and then cards.filter(...),
  // so corrupt or foreign data in localStorage crashed the board.
  it.each(["{", "null", "7", '{"cards":[]}'])("survives corrupt storage %s", (raw) => {
    expect(parseCards(raw)).toEqual(INITIAL_CARDS);
  });

  it("drops cards with a bad shape or an unknown column", () => {
    const raw = JSON.stringify([cards[0], { ...cards[1], column: "backlog" }, { id: "x", title: 1, notes: "", column: "todo" }]);
    expect(parseCards(raw)).toEqual([cards[0]]);
  });

  it("keeps an emptied board empty", () => {
    expect(parseCards("[]")).toEqual([]);
  });
});

describe("board actions", () => {
  it("advances and moves back one column, and stops at the edges", () => {
    expect(moveCard(cards, "a", 1)[0].column).toBe("doing");
    expect(moveCard(cards, "b", -1)[1].column).toBe("todo");
    expect(moveCard(cards, "a", -1)[0]).toBe(cards[0]);
    expect(moveCard(cards, "c", 1)[2]).toBe(cards[2]);
    expect(moveCardTo(cards, "a", "done")[0].column).toBe("done");
    expect(moveCardTo(cards, "b", "doing")).toBe(cards);
    expect(moveCardTo(cards, "missing", "done")).toBe(cards);
  });

  it("adds a trimmed card to the end of a column and ignores blanks", () => {
    const next = addCard(cards, "doing", "  Rehearse  ", () => "new");
    expect(next.at(-1)).toEqual({ id: "new", title: "Rehearse", notes: "", column: "doing" });
    expect(addCard(cards, "todo", "   ", () => "x")).toBe(cards);
  });

  it("edits title and notes and deletes by id", () => {
    expect(updateCard(cards, "b", { title: "B2" })[1]).toEqual({ ...cards[1], title: "B2" });
    expect(updateCard(cards, "b", { notes: "" })[1].notes).toBe("");
    expect(deleteCard(cards, "b").map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("lists cards per column and counts them in column order", () => {
    expect(cardsIn(cards, "done").map((c) => c.id)).toEqual(["c"]);
    expect(summarize([...cards, { id: "d", title: "D", notes: "", column: "done" }])).toEqual({ todo: 1, doing: 1, done: 2 });
    expect(COLUMNS.map((c) => c.id)).toEqual(["todo", "doing", "done"]);
  });
});

describe("App shell helpers", () => {
  it("columnLabel and nextColumn", () => {
    expect(COLUMNS.map((c) => columnLabel(c.id))).toEqual(["To do", "Doing", "Done"]);
    expect(nextColumn("todo", 1)).toBe("doing");
    expect(nextColumn("doing", -1)).toBe("todo");
    expect(nextColumn("todo", -1)).toBeNull();
    expect(nextColumn("done", 1)).toBeNull();
  });

  // restoreCard works inside the card's own column (neighbours and index are column-local).
  const t = (id: string): Card => ({ id, title: id, notes: "", column: "todo" });
  const d = (id: string): Card => ({ id, title: id, notes: "", column: "doing" });

  it("restoreCard falls back to the old previous card, then the old place in the column, so cards added since stay after it", () => {
    expect(restoreCard([t("a"), t("new")], t("b"), null, "a").map((c) => c.id)).toEqual(["a", "b", "new"]);
    expect(restoreCard([d("x"), t("new")], t("a"), null, null, 0).map((c) => c.id)).toEqual(["x", "a", "new"]);
    expect(restoreCard([t("new")], t("a"), null, "gone", 7).map((c) => c.id)).toEqual(["new", "a"]);
  });

  it("restoreCard ignores neighbours that are now in another column and other columns' order", () => {
    // Old next card "b" moved to Doing: fall back to the old place in To do (top), not before "b".
    expect(restoreCard([d("b"), t("c")], t("a"), "b", null, 0).map((c) => c.id)).toEqual(["b", "a", "c"]);
    // Empty column: the old place in the whole list keeps the saved order stable.
    expect(restoreCard([d("x"), d("y")], t("a"), null, null, 0, 0).map((c) => c.id)).toEqual(["a", "x", "y"]);
    expect(restoreCard([d("x")], t("a"), null, null, 0).map((c) => c.id)).toEqual(["x", "a"]);
  });

  it("restoreCard puts a card back before its neighbour, at the end without one, and never twice", () => {
    expect(restoreCard([t("b")], t("a"), "b").map((c) => c.id)).toEqual(["a", "b"]);
    expect(restoreCard([t("b")], t("a"), null).map((c) => c.id)).toEqual(["b", "a"]);
    expect(restoreCard([t("b")], t("a"), "gone").map((c) => c.id)).toEqual(["b", "a"]);
    expect(restoreCard([t("a"), t("b")], t("a"), "b")).toHaveLength(2);
  });

  it("columnPlace reports column-local neighbours, index and the place in the whole list", () => {
    const list = [t("a"), d("x"), t("b"), t("c")];
    expect(columnPlace(list, "b")).toEqual({ beforeId: "c", afterId: "a", index: 1, at: 2 });
    expect(columnPlace(list, "nope")).toBeNull();
  });

  it("reorderCard does nothing when the card already left the column the button was in", () => {
    const list = [t("a"), d("x"), d("y")];
    expect(reorderCard(list, "y", -1, "todo")).toBe(list);
    expect(reorderCard(list, "y", -1, "doing").map((c) => c.id)).toEqual(["a", "y", "x"]);
  });
});

describe("reorderCard", () => {
  const cards = [
    { id: "a", title: "A", notes: "", column: "todo" as const },
    { id: "x", title: "X", notes: "", column: "doing" as const },
    { id: "b", title: "B", notes: "", column: "todo" as const },
  ];
  it("swaps with the neighbour in the same column, skipping other columns", () => {
    expect(reorderCard(cards, "b", -1).map((c) => c.id)).toEqual(["b", "x", "a"]);
    expect(reorderCard(cards, "a", 1).map((c) => c.id)).toEqual(["b", "x", "a"]);
  });
  it("returns the same array at the ends of a column or for an unknown card", () => {
    expect(reorderCard(cards, "a", -1)).toBe(cards);
    expect(reorderCard(cards, "b", 1)).toBe(cards);
    expect(reorderCard(cards, "x", 1)).toBe(cards);
    expect(reorderCard(cards, "nope", 1)).toBe(cards);
  });
});
