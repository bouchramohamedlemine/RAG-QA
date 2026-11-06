import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Called once a day by a Vercel cron job (see vercel.json). Supabase's free plan
 * pauses a project after about a week without activity, which would stop the site answering.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/documents?select=doc_id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
