import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const promptSans = Archivo({ variable: "--font-prompt-sans", subsets: ["latin"] });
const promptMono = Space_Mono({ variable: "--font-prompt-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Prompt Book — Local kanban board",
  description: "Move local work cues across a focused three-column prompt book.",
  metadataBase: new URL("https://kanban-board.bookchaowalit.com"),
  alternates: { canonical: "https://kanban-board.bookchaowalit.com" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={promptSans.variable + " " + promptMono.variable}><body><Analytics /><SpeedInsights />{children}</body></html>;
}

