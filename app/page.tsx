"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ColumnId = "todo" | "doing" | "done";
type Card = { id: string; title: string; notes: string; column: ColumnId };

const COLS: { id: ColumnId; label: string; cue: string }[] = [
  { id: "todo", label: "On deck", cue: "not called" },
  { id: "doing", label: "In rehearsal", cue: "in motion" },
  { id: "done", label: "Cleared", cue: "ready to strike" },
];

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        // Hydrate the browser-only prompt book after the server-rendered seed.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(saved) as T);
      }
    } catch {
      // The seeded prompt book remains available when storage is unavailable.
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (ready) localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, ready]);

  return [value, setValue] as const;
}

function makeId() {
  return crypto.randomUUID();
}

export default function Home() {
  const [cards, setCards] = useLocalStorage<Card[]>("kanban-board-v2", [
    { id: "1", title: "Write README", notes: "Keep the limitation visible.", column: "todo" },
    { id: "2", title: "Ship utility batch", notes: "Client-side tools.", column: "doing" },
    { id: "3", title: "Fix flagships", notes: "Done earlier.", column: "done" },
  ]);
  const [drafts, setDrafts] = useState<Record<ColumnId, string>>({ todo: "", doing: "", done: "" });
  const cleared = useMemo(() => cards.filter((card) => card.column === "done").length, [cards]);

  const move = (id: string, direction: -1 | 1) => {
    setCards((current) => current.map((card) => {
      if (card.id !== id) return card;
      const index = COLS.findIndex((column) => column.id === card.column);
      return COLS[index + direction] ? { ...card, column: COLS[index + direction].id } : card;
    }));
  };

  const add = (column: ColumnId) => {
    const title = drafts[column].trim();
    if (!title) return;
    setCards((current) => [...current, { id: makeId(), title, notes: "", column }]);
    setDrafts((current) => ({ ...current, [column]: "" }));
  };

  return (
    <main className="prompt-book">
      <span className="contract-mark" dangerouslySetInnerHTML={{ __html: "<!-- THESIS: work is a stage manager prompt book; FINISH: cue columns, local movement, readable empty state -->" }} />
      <div className="prompt-shell">
        <header className="prompt-topbar">
          <Link href="/" className="prompt-wordmark">PROMPT BOOK / LOCAL</Link>
          <span>stage manager&apos;s desk · {cards.length} cues</span>
        </header>

        <section className="prompt-intro">
          <div>
            <p className="prompt-overline">keep the next cue visible</p>
            <h1>Move the work when the scene is ready.</h1>
          </div>
          <div className="prompt-summary"><strong>{String(cleared).padStart(2, "0")}</strong><span>cues cleared<br />on this desk</span></div>
        </section>

        <section className="board" aria-labelledby="board-heading">
          <header className="board-heading">
            <div><span className="board-index">01</span><h2 id="board-heading">The running order</h2></div>
            <p>Local only · move a cue with Back or Advance</p>
          </header>
          <div className="cue-grid">
            {COLS.map((column) => {
              const list = cards.filter((card) => card.column === column.id);
              return (
                <section className={"cue-column " + column.id} key={column.id} aria-labelledby={column.id + "-heading"}>
                  <header className="cue-column-heading"><div><h3 id={column.id + "-heading"}>{column.label}</h3><span>{column.cue}</span></div><b>{String(list.length).padStart(2, "0")}</b></header>
                  <div className="cue-list">
                    {list.map((card) => (
                      <article className="cue-slip" key={card.id}>
                        <span className="cue-pin" aria-hidden="true" />
                        <label><span className="sr-only">Cue title</span><input value={card.title} onChange={(event) => setCards((current) => current.map((item) => item.id === card.id ? { ...item, title: event.target.value } : item))} /></label>
                        <label><span className="sr-only">Cue note</span><textarea rows={2} placeholder="Cue note" value={card.notes} onChange={(event) => setCards((current) => current.map((item) => item.id === card.id ? { ...item, notes: event.target.value } : item))} /></label>
                        <div className="cue-actions">
                          <button type="button" onClick={() => move(card.id, -1)} disabled={column.id === "todo"}>Back</button>
                          <button type="button" onClick={() => move(card.id, 1)} disabled={column.id === "done"}>Advance</button>
                          <button type="button" className="delete-cue" onClick={() => setCards((current) => current.filter((item) => item.id !== card.id))}>Strike</button>
                        </div>
                      </article>
                    ))}
                    {list.length === 0 && <p className="column-empty">No cue on this line yet.</p>}
                  </div>
                  <div className="add-cue"><input aria-label={"New cue for " + column.label} placeholder="New cue" value={drafts[column.id]} onChange={(event) => setDrafts((current) => ({ ...current, [column.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") add(column.id); }} /><button type="button" onClick={() => add(column.id)}>Call cue</button></div>
                </section>
              );
            })}
          </div>
        </section>

        <footer className="prompt-footer">A cue can move across this browser&apos;s local prompt book. No collaborators, sync, or shared production state is implied.</footer>
      </div>
    </main>
  );
}
