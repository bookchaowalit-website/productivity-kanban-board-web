import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  INITIAL_CARDS,
  addCard,
  cardsIn,
  deleteCard,
  moveCard,
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
