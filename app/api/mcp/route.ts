import { NextResponse } from "next/server";
import { COLUMNS, INITIAL_CARDS, sanitizeCards, summarize } from "@/lib/kanban";

// Stateless JSON-RPC MCP endpoint. Cards live in the visitor's browser (localStorage), so the server cannot
// read them: it serves the fixed columns with the sample cards and counts cards the caller sends.

type RpcRequest = { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const TOOLS = [
  { name: "get_sample_board", description: "The three fixed columns and the sample cards a new browser starts with", inputSchema: { type: "object", properties: {} } },
  {
    name: "summarize_board",
    description: "Count the given cards per column (todo, doing, done); malformed cards are skipped",
    inputSchema: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, notes: { type: "string" }, column: { type: "string", enum: ["todo", "doing", "done"] } } },
        },
      },
      required: ["cards"],
    },
  },
];

class RpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function callTool(name: string | undefined, args: Record<string, unknown> = {}) {
  switch (name) {
    case "get_sample_board":
      return { columns: COLUMNS, cards: INITIAL_CARDS };
    case "summarize_board": {
      if (!Array.isArray(args.cards)) throw new RpcError(-32602, "cards must be an array");
      const cards = sanitizeCards(args.cards);
      return { counts: summarize(cards), total: cards.length };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
  }
}

export async function POST(request: Request) {
  let id: RpcRequest["id"] = null;
  try {
    const body = (await request.json()) as RpcRequest;
    id = body.id ?? null;
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "Kanban Board", version: "1.0.0" },
        };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = callTool(body.params?.name, body.params?.arguments);
        break;
      default:
        throw new RpcError(-32601, `Unknown method: ${String(body.method)}`);
    }
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    const code = error instanceof RpcError ? error.code : -32700;
    const message = error instanceof RpcError ? error.message : "Parse error";
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
  }
}
