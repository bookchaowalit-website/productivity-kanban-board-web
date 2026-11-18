"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppFoot, AppTop, PlusIcon, type Tone } from "@/components/app-shell";
import { COLUMNS, STORAGE_KEY, addCard, cardsIn, columnLabel, deleteCard, moveCardTo, nextColumn, parseCards, restoreCard, serializeCards, updateCard, type Card, type ColumnId } from "@/lib/kanban";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

const store = createLocalStore(STORAGE_KEY, parseCards, serializeCards);
const TONE: Record<ColumnId, Tone> = { todo: "grey", doing: "amber", done: "green" };
const EMPTY: Record<ColumnId, string> = { todo: "Nothing to do. Press New card to add one.", doing: "Nothing in progress. Start a card from To do.", done: "Nothing done yet." };
// Below this width the board shows one column at a time, picked with the segmented control.
const NARROW = "(max-width: 899px)";
type RemovedEntry = { card: Card; beforeId: string | null };
type RemovedBatch = { items: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (items: RemovedEntry[]) => (items.length === 1 ? `Removed “${items[0].card.title}”` : `Removed ${items.length} cards`);

// randomUUID only exists in secure contexts (HTTPS/localhost) and newer browsers.
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
);
const Chevron = ({ back }: { back?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} /></svg>
);

export default function Home() {
  const cards = useLocalStore(store);
  const setCards = store.set;
  const [shown, setShown] = useState<ColumnId>("todo");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<{ title: string; notes: string; column: ColumnId }>({ title: "", notes: "", column: "todo" });
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [moved, setMoved] = useState<{ id: string; column: ColumnId } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const wasComposing = useRef(false);
  const done = cardsIn(cards, "done").length;

  useEffect(() => {
    if (composing) titleRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // The toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);
  // A moved card's buttons leave with it: follow the card on a wide board; on a phone, where its new column is
  // hidden, focus that column's switch instead.
  useEffect(() => {
    if (!moved) return;
    const narrow = typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches;
    document.getElementById(narrow ? `show-${moved.column}` : `card-${moved.id}`)?.focus();
  }, [moved]);

  function closeComposer() {
    setComposing(false);
    setDraft({ title: "", notes: "", column: "todo" });
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const id = createId();
    const notes = draft.notes.trim();
    // Build on the store's latest value: another tab may have saved since this render.
    setCards((current) => {
      const next = addCard(current, draft.column, draft.title, () => id);
      return notes ? updateCard(next, id, { notes }) : next;
    });
    setShown(draft.column);
    setAnnouncement(`Added “${draft.title.trim()}” to ${columnLabel(draft.column)}.`);
    closeComposer();
  }
  function move(card: Card, to: ColumnId) {
    // The button names its destination, so the card goes there, even if another tab moved it since
    // this render (no extra step on to the next column). The title comes from the latest value.
    const latest = store.getSnapshot().find((entry) => entry.id === card.id);
    if (!latest) return;
    setCards((current) => moveCardTo(current, card.id, to));
    setAnnouncement(`Moved “${latest.title}” to ${columnLabel(to)}.`);
    setMoved({ id: card.id, column: to });
  }
  function remove(card: Card, viaKeyboard: boolean) {
    // Read the store, not this render: another tab may have edited the card since, and Undo
    // must bring back that latest version in its latest place.
    const current = store.getSnapshot();
    const index = current.findIndex((entry) => entry.id === card.id);
    // Already deleted in another tab: nothing to remove, and no Undo that would bring it back.
    if (index === -1) return;
    setCards(deleteCard(current, card.id));
    // Join the batch of removals still inside the Undo window.
    const items = [...(removedRef.current?.items ?? []), { card: current[index], beforeId: current[index + 1]?.id ?? null }];
    setRemoved({ items, viaKeyboard });
    setAnnouncement(`${removedLabel(items)}. Undo is available for a few seconds.`);
  }
  function closeToast() {
    setRemoved(null);
    setToastFocused(false);
    (newRef.current ?? titleRef.current)?.focus();
  }
  function undo() {
    const items = removedRef.current?.items;
    if (!items?.length) return;
    // Latest removal first, so each card goes back before the card that followed it at the time.
    setCards((current) => items.reduceRight((list, { card, beforeId }) => restoreCard(list, card, beforeId), current));
    setAnnouncement(items.length === 1 ? `Restored “${items[0].card.title}”.` : `Restored ${items.length} cards.`);
    closeToast();
  }

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Board" tagline="To do, doing, done" />

      <main id="main" className="as-board-page">
        <div className="as-head">
          <div>
            <h1>Board</h1>
            <p>{`${cards.length} ${cards.length === 1 ? "card" : "cards"} · ${done} done`}</p>
          </div>
          <div className="as-tools">
            {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />New card</button>}
          </div>
        </div>

        {composing ? (
          <form className="as-composer" onSubmit={add} aria-label="New card">
            <label className="as-field">Title
              <input ref={titleRef} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What needs doing?" autoComplete="off" />
            </label>
            <label className="as-field">Note
              <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Optional detail" />
            </label>
            <div className="as-composer-foot">
              <div className="as-segmented-wrap">
                <span id="column-label">Column</span>
                <div className="as-segmented" role="group" aria-labelledby="column-label">
                  {COLUMNS.map((column) => (
                    <button key={column.id} type="button" aria-pressed={draft.column === column.id} onClick={() => setDraft({ ...draft, column: column.id })}>{column.label}</button>
                  ))}
                </div>
              </div>
              <div className="as-composer-actions">
                <button type="button" className="as-plain" onClick={closeComposer}>Cancel</button>
                <button type="submit" className="as-button" disabled={!draft.title.trim()}>Add</button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="as-segmented as-board-switch" role="group" aria-label="Show column">
          {COLUMNS.map((column) => (
            <button key={column.id} id={`show-${column.id}`} type="button" aria-pressed={shown === column.id} onClick={() => setShown(column.id)}>
              {column.label} <span className="as-count">{cardsIn(cards, column.id).length}</span>
            </button>
          ))}
        </div>

        <div className="as-board" data-show={shown}>
          {COLUMNS.map((column) => {
            const list = cardsIn(cards, column.id);
            const back = nextColumn(column.id, -1);
            const forward = nextColumn(column.id, 1);
            return (
              <section className="as-column" data-col={column.id} key={column.id} aria-labelledby={`col-${column.id}`}>
                <h2 id={`col-${column.id}`}><span><span className="as-dot" data-tone={TONE[column.id]} aria-hidden="true" />{column.label}</span><span className="as-count">{list.length}</span></h2>
                {list.length ? (
                  <ul className="as-cards">
                    {list.map((card, index) => (
                      <li className="as-card" id={`card-${card.id}`} key={card.id} tabIndex={-1} aria-label={card.title}>
                        <div className="as-card-body">
                          <input className="as-card-title" aria-label={`Title of card ${index + 1} in ${column.label}`} value={card.title} onChange={(event) => setCards((current) => updateCard(current, card.id, { title: event.target.value }))} onBlur={() => setCards((current) => (current.find((entry) => entry.id === card.id)?.title.trim() === "" ? updateCard(current, card.id, { title: "Untitled" }) : current))} />
                          <textarea className="as-card-note" aria-label={`Note for ${card.title}`} rows={1} placeholder="Add a note" value={card.notes} onChange={(event) => setCards((current) => updateCard(current, card.id, { notes: event.target.value }))} />
                        </div>
                        <div className="as-card-actions">
                          {back ? <button type="button" className="as-plain" aria-label={`Move ${card.title} back to ${columnLabel(back)}`} onClick={() => move(card, back)}><Chevron back />{columnLabel(back)}</button> : null}
                          {forward ? <button type="button" className="as-plain" aria-label={`Move ${card.title} to ${columnLabel(forward)}`} onClick={() => move(card, forward)}>{columnLabel(forward)}<Chevron /></button> : null}
                          <button type="button" className="as-plain as-icon" aria-label={`Remove ${card.title}`} onClick={(event) => remove(card, event.detail === 0)}><XIcon /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="as-column-empty">{EMPTY[column.id]}</p>}
              </section>
            );
          })}
        </div>

        <p className="as-note">Saved in this browser only. No account, no sync, no collaborators.</p>
      </main>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.items)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.items.length === 1 ? "Undo remove" : `Undo remove of ${removed.items.length} cards`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/productivity-kanban-board-web" />
    </div>
  );
}
