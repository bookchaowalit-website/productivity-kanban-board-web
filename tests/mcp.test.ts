import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { COLUMNS, INITIAL_CARDS } from "@/lib/kanban";

function rpc(body: unknown) {
  return POST(new Request("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body) }));
}

describe("MCP route", () => {
  it("echoes the JSON-RPC request id, including 0", async () => {
    expect((await (await rpc({ jsonrpc: "2.0", id: 7, method: "tools/list" })).json()).id).toBe(7);
    expect((await (await rpc({ jsonrpc: "2.0", id: 0, method: "initialize" })).json()).id).toBe(0);
  });

  it("lists only the tools it really implements", async () => {
    const { result } = await (await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })).json();
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(["get_sample_board", "summarize_board"]);
  });

  it("get_sample_board returns the fixed columns and the sample cards the page starts with", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_sample_board" } });
    const { result } = await res.json();
    expect(result.columns).toEqual(COLUMNS);
    expect(result.cards).toEqual(INITIAL_CARDS);
  });

  it("summarize_board counts the cards it is given per column and ignores malformed ones", async () => {
    const cards = [
      { id: "a", title: "A", notes: "", column: "todo" },
      { id: "b", title: "B", notes: "", column: "done" },
      { id: "c", title: "C", notes: "", column: "done" },
      { id: "d", title: "D", notes: "", column: "nowhere" },
    ];
    const res = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "summarize_board", arguments: { cards } } });
    const { result } = await res.json();
    expect(result).toEqual({ counts: { todo: 1, doing: 0, done: 2 }, total: 3 });
  });

  it("summarize_board rejects a non-array cards argument", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "summarize_board", arguments: {} } });
    const body = await res.json();
    expect(body.error.code).toBe(-32602);
    expect(body.id).toBe(4);
  });

  it("rejects an unknown tool instead of pretending to call it", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_data" } });
    expect((await res.json()).error.code).toBe(-32602);
  });

  it("rejects an unknown method and bad JSON", async () => {
    expect((await (await rpc({ jsonrpc: "2.0", id: 6, method: "nope" })).json()).error.code).toBe(-32601);
    const bad = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
    const body = await bad.json();
    expect(body.error.code).toBe(-32700);
    expect(body.id).toBeNull();
  });
});
