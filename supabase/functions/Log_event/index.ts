import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ALERT_FROM = "RAG Q&A alerts <forms@bouchra.tech>";
const ALERT_TO = "contact@bouchra.tech";
const KEEP_DAYS = 30;

/** Emails her the first time a limit is hit each day, with what happened and who used it most. */
async function sendLimitAlert(detail: string) {
  const { data: claimed } = await supabase
    .from("usage_alerts")
    .upsert({}, { onConflict: "day", ignoreDuplicates: true })
    .select();
  if (!claimed || claimed.length === 0) return "already sent today";

  const since = new Date(new Date().toISOString().slice(0, 10)).toISOString();
  const { data: rows } = await supabase
    .from("usage_log")
    .select("visitor, kind")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const messages = (rows ?? []).filter((r) => r.kind === "question" || r.kind === "off_topic");
  const counts = new Map<string, number>();
  for (const r of messages) counts.set(r.visitor, (counts.get(r.visitor) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];

  const text = [
    "RAG Q&A hit a limit, so visitors are now seeing the \"try again later\" message.",
    "",
    `What happened: ${detail}`,
    `Today so far: ${messages.length} messages from ${counts.size} visitors.`,
    top ? `Most active: visitor ${top[0]}, ${top[1]} messages.` : "",
    "",
    "Totals: Supabase > Table Editor > usage_by_day. Details: usage_log.",
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_WORK_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: ALERT_FROM,
      to: [ALERT_TO],
      subject: "RAG Q&A hit a limit",
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  return "sent";
}

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { visitor, kind, detail } = await req.json();

    if (!visitor || !kind) {
      return new Response(JSON.stringify({ error: "Missing visitor or kind" }), { status: 400 });
    }

    const { error } = await supabase.from("usage_log").insert({
      visitor,
      kind,
      detail: detail ? String(detail).slice(0, 500) : null,
    });
    if (error) throw error;

    // Keep the table small: now and then, remove anything older than 30 days
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
      await supabase.from("usage_log").delete().lt("created_at", cutoff);
      await supabase.from("usage_alerts").delete().lt("sent_at", cutoff);
    }

    const alert = kind === "limit_hit" ? await sendLimitAlert(String(detail ?? "A limit was reached")) : "none";

    return new Response(JSON.stringify({ logged: true, alert }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
