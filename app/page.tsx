import type { Metadata } from "next";
import Board from "./board";

// Canonical lives on the board page only, so no other route (not-found, redirects) inherits it.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <Board />;
}
