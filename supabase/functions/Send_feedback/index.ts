import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FROM = "RAG Q&A feedback <forms@bouchra.tech>";
const TO = "contact@bouchra.tech";
const MAX_PER_DAY = 5;

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { visitor, message, email } = await req.json();

    if (!visitor || !message) {
      return new Response(JSON.stringify({ error: "Missing visitor or message" }), { status: 400 });
    }

    // One visitor can't flood the inbox
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count, error: countError } = await supabase
      .from("usage_log")
      .select("id", { count: "exact", head: true })
      .eq("visitor", visitor)
      .eq("kind", "feedback")
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_PER_DAY) {
      return new Response(JSON.stringify({ error: "Too much feedback today" }), { status: 429 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_WORK_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        ...(email ? { reply_to: email } : {}),
        subject: "RAG Q&A feedback",
        text: `${message}\n\nFrom: ${email || "no email given"}\nVisitor: ${visitor}`,
      }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);

    const { error } = await supabase.from("usage_log").insert({
      visitor,
      kind: "feedback",
      question: String(message).slice(0, 500),
      detail: email || null,
    });
    if (error) console.error("Could not log feedback:", error);

    return new Response(JSON.stringify({ sent: true }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
