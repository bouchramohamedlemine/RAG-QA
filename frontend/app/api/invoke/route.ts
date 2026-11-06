import { NextRequest, NextResponse } from "next/server";
import { callEdgeFunction, visitorId } from "../edge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const MAX_QUERY_LENGTH = 500;
const MAX_CONTEXT_CHUNKS = 10;
const MAX_CHUNK_LENGTH = 6000;
const MAX_DOCS = 60;

// How OpenAI and Cohere report that a usage or spending limit was reached
const LIMIT_ERROR = /\b429\b|quota|rate.?limit|insufficient|exceeded|trial/i;

/** Only the four pipeline functions can be called, with inputs the size the site really sends. */
function isValidRequest(functionName: string, body: Record<string, unknown>): boolean {
  if (typeof body.query !== "string" || !body.query.trim() || body.query.length > MAX_QUERY_LENGTH) return false;
  switch (functionName) {
    case "Query_rewriter":
    case "Document_retriever":
      return true;
    case "Chunk_retriever":
      return Array.isArray(body.docs) && body.docs.length <= MAX_DOCS && typeof body.top_k === "number" && body.top_k <= MAX_CONTEXT_CHUNKS;
    case "Generator":
      return (
        Array.isArray(body.context) &&
        body.context.length <= MAX_CONTEXT_CHUNKS &&
        body.context.every((chunk) => typeof chunk?.content === "string" && chunk.content.length <= MAX_CHUNK_LENGTH && String(chunk?.title ?? "").length <= MAX_QUERY_LENGTH)
      );
    default:
      return false;
  }
}

/** Logging must never break the answer, so its failures are only printed. */
async function logEvent(visitor: string, kind: string, detail?: string) {
  try {
    const res = await callEdgeFunction("Log_event", { visitor, kind, detail });
    if (!res.ok) console.error("[api/invoke] Log_event failed:", res.status);
  } catch (err) {
    console.error("[api/invoke] Log_event failed:", err);
  }
}

/** What a successful call means in the log. Retrieval steps in between aren't logged. */
function successKind(functionName: string, data: unknown): string | null {
  if (functionName === "Query_rewriter") return (data as { on_topic?: boolean } | null)?.on_topic === false ? "off_topic" : "question";
  if (functionName === "Document_retriever") return Array.isArray(data) && data.length === 0 ? "no_documents" : null;
  if (functionName === "Generator") return "answered";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { functionName, body } = (await req.json()) as {
      functionName?: string;
      body?: Record<string, unknown>;
    };

    if (!functionName || !body) {
      return NextResponse.json(
        { error: "Missing functionName or body" },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    if (!isValidRequest(functionName, body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const visitor = visitorId(req);
    const res = await callEdgeFunction(functionName, body);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const detail = `${functionName}: ${String((data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : null) ?? res.statusText)}`;
      if (LIMIT_ERROR.test(detail)) {
        await logEvent(visitor, "limit_hit", detail);
        return NextResponse.json({ error: "A usage limit was reached", code: "limit" }, { status: 503 });
      }
      await logEvent(visitor, "error", detail);
      return NextResponse.json(
        { error: (data && typeof data === "object" && "error" in data ? (data as { error: string }).error : null) ?? res.statusText ?? "Request failed", status: res.status },
        { status: res.status }
      );
    }

    const kind = successKind(functionName, data);
    if (kind) await logEvent(visitor, kind);

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
