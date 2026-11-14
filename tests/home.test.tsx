import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the three columns, the sample cards, their move buttons and the local-only note", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("<h1>Board</h1>");
    for (const label of ["To do", "Doing", "Done"]) expect(html).toContain(label);
    expect(html).toContain("Write README");
    expect(html).toContain("Fix flagships");
    expect(html).toContain("3 cards · 1 done");
    expect(html).toContain('aria-label="Move Write README to Doing"');
    expect(html).toContain('aria-label="Move Ship utility batch back to To do"');
    expect(html).toContain("Saved in this browser only");
  });
});
