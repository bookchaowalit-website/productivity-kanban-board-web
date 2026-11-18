// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_CARDS, STORAGE_KEY, type Card } from "@/lib/kanban";

// Another tab can save between the moment a click handler runs and the moment the store writes. The board must
// delete from the store's latest value inside one functional update, so that save survives.
const race = vi.hoisted(() => ({ beforeSet: null as null | (() => void) }));
vi.mock("@/lib/local-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/local-store")>();
  return {
    ...actual,
    createLocalStore: ((...args: Parameters<typeof actual.createLocalStore>) => {
      const store = actual.createLocalStore(...args);
      return { ...store, set: (next: Parameters<typeof store.set>[0]) => { race.beforeSet?.(); race.beforeSet = null; store.set(next); } };
    }) as typeof actual.createLocalStore,
  };
});

const { default: Home } = await import("@/app/page");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Card[];

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("remove under a concurrent save", () => {
  it("keeps a card another tab saved just before the delete wrote, and Undo brings back that tab's version", () => {
    const [first] = INITIAL_CARDS;
    const fromOtherTab: Card = { ...first, id: "other-tab", title: "Saved in another tab" };
    race.beforeSet = () => {
      const latest = INITIAL_CARDS.map((card) => (card.id === first.id ? { ...card, notes: "Edited elsewhere" } : card));
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...latest, fromOtherTab]));
    };
    const remove = host.querySelector(`[aria-label="Remove ${first.title}"]`)!;
    act(() => { remove.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); });
    expect(saved().map((card) => card.id)).toEqual([...INITIAL_CARDS.slice(1).map((card) => card.id), "other-tab"]);
    const undo = [...host.querySelectorAll("button")].find((b) => b.textContent === "Undo")!;
    act(() => { undo.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); });
    expect(saved().map((card) => card.id)).toEqual([...INITIAL_CARDS.map((card) => card.id), "other-tab"]);
    expect(saved()[0].notes).toBe("Edited elsewhere");
  });
});
