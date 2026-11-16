// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { INITIAL_CARDS, STORAGE_KEY } from "@/lib/kanban";

// Mounted tests for the board on the App shell: composer, moving, editing, column switch, remove, undo and focus.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = host) => scope.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const titles = (column: string) => [...host.querySelectorAll<HTMLInputElement>(`[data-col="${column}"] .as-card-title`)].map((i) => i.value);
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const savedOrSeed = () => (localStorage.getItem(STORAGE_KEY) ? saved() : INITIAL_CARDS);
const press = (el: Element, detail = 0) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function narrow(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }));
}

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("composer", () => {
  it("opens focused, keeps Add disabled without a title, adds to the chosen column with its note, and returns focus", () => {
    press(button("New card"));
    expect(document.activeElement).toBe($(".as-composer input"));
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    type($<HTMLInputElement>(".as-composer input")!, "Plan the launch");
    type($<HTMLTextAreaElement>(".as-composer textarea")!, "  Friday  ");
    press(button("Doing", $(".as-composer")!));
    press(button("Add", $(".as-composer")!));
    expect(titles("doing")).toEqual(["Ship utility batch", "Plan the launch"]);
    expect(saved().at(-1)).toMatchObject({ title: "Plan the launch", notes: "Friday", column: "doing" });
    expect($(".as-board")!.getAttribute("data-show")).toBe("doing");
    expect(document.activeElement?.textContent).toContain("New card");
    expect(host.textContent).toContain("4 cards · 1 done");
  });

  it("adding keeps a card another tab saved after this render (no storage event yet)", () => {
    press(button("New card"));
    type($<HTMLInputElement>(".as-composer input")!, "From this tab");
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...savedOrSeed(), { id: "other", title: "From the other tab", notes: "", column: "todo" }]));
    press(button("Add", $(".as-composer")!));
    expect(saved().map((c: { title: string }) => c.title)).toEqual(expect.arrayContaining(["From the other tab", "From this tab"]));
  });

  it("a card without a note stays note-free; Cancel adds nothing", () => {
    press(button("New card"));
    type($<HTMLInputElement>(".as-composer input")!, "Bare card");
    press(button("Add", $(".as-composer")!));
    expect(saved().at(-1)).toMatchObject({ title: "Bare card", notes: "", column: "todo" });
    press(button("New card"));
    type($<HTMLInputElement>(".as-composer input")!, "Never added");
    press(button("Cancel"));
    expect(titles("todo")).not.toContain("Never added");
  });

  it("still adds when crypto.randomUUID is missing (plain HTTP, older browsers)", () => {
    vi.stubGlobal("crypto", {});
    press(button("New card"));
    type($<HTMLInputElement>(".as-composer input")!, "No secure context");
    press(button("Add", $(".as-composer")!));
    expect(saved().at(-1).id).toMatch(/^card-\d+-[a-z0-9]+$/);
  });
});

describe("moving and editing", () => {
  it("moves a card forward and back; on a wide board focus follows the card", () => {
    narrow(false);
    press($('[aria-label="Move Write README to Doing"]')!);
    expect(titles("todo")).toEqual([]);
    expect(titles("doing")).toContain("Write README");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Write README");
    expect(host.textContent).toContain("Nothing to do. Press New card to add one.");
    press($('[aria-label="Move Write README to Done"]')!);
    expect(host.textContent).toContain("3 cards · 2 done");
    press($('[aria-label="Move Write README back to Doing"]')!);
    expect(titles("doing")).toContain("Write README");
  });

  it("on a phone, focus goes to the destination column's switch", () => {
    narrow(true);
    press($('[aria-label="Move Ship utility batch to Done"]')!);
    expect(document.activeElement?.id).toBe("show-done");
    press($("#show-done")!);
    expect($(".as-board")!.getAttribute("data-show")).toBe("done");
    expect($("#show-done")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("edits a title and note in place; a blank title becomes “Untitled”", () => {
    const title = $<HTMLInputElement>('[data-col="todo"] .as-card-title')!;
    type(title, "Write the README");
    type($<HTMLTextAreaElement>('[data-col="todo"] .as-card-note')!, "Short and honest.");
    expect(saved()[0]).toMatchObject({ title: "Write the README", notes: "Short and honest." });
    type(title, " ");
    act(() => { title.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(saved()[0].title).toBe("Untitled");
  });
});

describe("remove and undo", () => {
  it("keyboard removal focuses Undo; Undo restores in place and focuses New card; mouse removal empties a column", () => {
    press($('[aria-label="Remove Write README"]')!, 0);
    expect(titles("todo")).toEqual([]);
    expect(document.activeElement?.textContent).toBe("Undo");
    press(button("Undo"));
    expect(saved().map((c: { id: string }) => c.id)).toEqual(["1", "2", "3"]);
    expect(document.activeElement?.textContent).toContain("New card");
    press($('[aria-label="Remove Fix flagships"]')!, 1);
    expect(host.textContent).toContain("Nothing done yet.");
  });

  it("Undo brings back the version another tab saved after this render, not the stale one", () => {
    const edited = savedOrSeed().map((c: { id: string; title: string }) => (c.title === "Write README" ? { ...c, title: "Write README v2", notes: "from the other tab" } : c));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edited));
    press($('[aria-label="Remove Write README"]')!, 1);
    press(button("Undo"));
    expect(saved().find((c: { id: string }) => c.id === "1")).toMatchObject({ title: "Write README v2", notes: "from the other tab" });
    expect(saved().map((c: { id: string }) => c.id)).toEqual(["1", "2", "3"]);
  });

  it("Escape dismisses; the toast waits while focused and closes six seconds after focus leaves; with the composer open focus goes to it", () => {
    press($('[aria-label="Remove Write README"]')!, 0);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    vi.useFakeTimers();
    press($('[aria-label="Remove Fix flagships"]')!, 0);
    act(() => { vi.advanceTimersByTime(7000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { button("New card").focus(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
    press($('[aria-label="Remove Ship utility batch"]')!, 0);
    press(button("New card"));
    press(button("Undo"));
    expect(document.activeElement).toBe($(".as-composer input"));
  });
});
