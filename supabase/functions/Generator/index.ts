import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
});

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { context, query } = await req.json();

    if (!context || !query) {
      return new Response(JSON.stringify({ error: "Missing context or query" }), { status: 400 });
    }

    // Combine all chunk content into a single text
    const contextText = context
      .map((c: any) => `Paper: ${c.title || "Untitled paper"}\n${c.content}`)
      .join("\n\n");

    // Build prompt
const prompt = `
You are an expert research assistant. Answer the question using only the context below. 
Your goal is to:
1. Provide clear explanations of concepts.
2. Compare different methods when relevant.
3. Support your answer with evidence from the context.

Instructions:
- Answer only from the context. Do not use your own knowledge, even to fill small gaps.
- If the retrieved papers have findings related to the question but no single definitive answer, say so and report what they found, naming each paper. For example: "No paper settles this, but this paper found...".
- If the context only partly answers the question, answer that part and say what the retrieved papers do not cover.
- Only say that the retrieved papers do not answer the question if they contain nothing related to it. In that case, do not answer it yourself.
- Each passage in the context starts with the title of its paper. When you state a finding, name the paper it came from and the setting it was tested in, if the passage gives one (for example, financial questions).
- Do not present a result from one paper as a general rule. Say "this paper found...", not "this method is better".
- If papers disagree, say so.
- Refer to the context as "the retrieved papers". Never use the word "context" in your answer.

Context:
${contextText}

Question:
${query}
`;



    // Call GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a research assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0
    });

    const answer = completion.choices[0].message?.content ?? "No answer generated.";

    return new Response(JSON.stringify({ answer }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
