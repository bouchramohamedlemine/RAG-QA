import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const edgeSecret = process.env.EDGE_FUNCTION_SECRET ?? "";

/** Visitors are identified by a scrambled version of their IP address, so the address itself is never stored. */
export function visitorId(req: NextRequest): string {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(`${ip}:${edgeSecret}`).digest("hex").slice(0, 8);
}

export function callEdgeFunction(name: string, body: unknown) {
  return fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      "x-edge-secret": edgeSecret,
    },
    body: JSON.stringify(body),
  });
}
