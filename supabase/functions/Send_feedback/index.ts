import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const FROM = "RAG Q&A <forms@bouchra.tech>";
const TO = "contact@bouchra.tech";

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { visitor, name, message, email } = await req.json();

    if (!visitor || !name || !message || !email) {
      return new Response(JSON.stringify({ error: "Missing visitor, name, email or message" }), { status: 400 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_WORK_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: "New feedback",
        text: `${message}\n\nFrom: ${name} <${email}>\nVisitor: ${visitor}`,
      }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);

    return new Response(JSON.stringify({ sent: true }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
