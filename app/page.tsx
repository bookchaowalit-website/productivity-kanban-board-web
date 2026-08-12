"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Local mini-app · state in this browser
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
        </header>
        {children}
        <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
          Data is stored in localStorage on this origin only. Portfolio demo — not a multi-user product.
        </footer>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 " +
    className;
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
      : variant === "secondary"
        ? "bg-white text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900";
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950";

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, ready]);
  return [value, setValue, ready] as const;
}

function uid() {
  return crypto.randomUUID();
}

type ColumnId = "todo" | "doing" | "done";
type Card = { id: string; title: string; notes: string; column: ColumnId };
const COLS: { id: ColumnId; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

export default function Home() {
  const [cards, setCards] = useLocalStorage<Card[]>("kanban-board-v1", [
    { id: "1", title: "Write README", notes: "Honest limitations", column: "todo" },
    { id: "2", title: "Ship utility batch", notes: "Client-side tools", column: "doing" },
    { id: "3", title: "Fix flagships", notes: "Done earlier", column: "done" },
  ]);
  const [drafts, setDrafts] = useState<Record<ColumnId, string>>({ todo: "", doing: "", done: "" });

  const move = (id: string, dir: -1 | 1) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const idx = COLS.findIndex((col) => col.id === c.column);
        const next = COLS[idx + dir];
        return next ? { ...c, column: next.id } : c;
      })
    );
  };

  const add = (column: ColumnId) => {
    const title = drafts[column].trim();
    if (!title) return;
    setCards((prev) => [...prev, { id: uid(), title, notes: "", column }]);
    setDrafts((d) => ({ ...d, [column]: "" }));
  };

  return (
    <Shell title="Kanban Board" subtitle="Move work across columns. Everything stays in localStorage.">
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((col) => {
          const list = cards.filter((c) => c.column === col.id);
          return (
            <section
              key={col.id}
              className="flex min-h-[28rem] flex-col rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">{col.label}</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-900">{list.length}</span>
              </header>
              <div className="flex-1 space-y-2">
                {list.map((card) => (
                  <article key={card.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <input
                      className="w-full bg-transparent font-medium outline-none"
                      value={card.title}
                      onChange={(e) =>
                        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, title: e.target.value } : c)))
                      }
                    />
                    <textarea
                      className="mt-1 w-full resize-none bg-transparent text-sm text-zinc-600 outline-none dark:text-zinc-400"
                      rows={2}
                      placeholder="Notes"
                      value={card.notes}
                      onChange={(e) =>
                        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, notes: e.target.value } : c)))
                      }
                    />
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button variant="secondary" onClick={() => move(card.id, -1)}>
                        ←
                      </Button>
                      <Button variant="secondary" onClick={() => move(card.id, 1)}>
                        →
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setCards((prev) => prev.filter((c) => c.id !== card.id))}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className={inputClass}
                  placeholder="New card"
                  value={drafts[col.id]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") add(col.id);
                  }}
                />
                <Button onClick={() => add(col.id)}>Add</Button>
              </div>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
