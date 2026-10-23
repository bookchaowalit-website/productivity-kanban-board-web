import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the three fixed columns, the sample cards and the local-only notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Move the work when the scene is ready.");
    for (const label of ["On deck", "In rehearsal", "Cleared"]) expect(html).toContain(label);
    expect(html).toContain("Write README");
    expect(html).toContain("Fix flagships");
    expect(html).toContain("move a cue with Back or Advance");
    expect(html).toContain("No collaborators, sync, or shared production state is implied.");
  });
});
