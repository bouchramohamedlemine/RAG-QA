import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
});

const INSTRUCTIONS = `
You rewrite a user's question into a search query for a collection of research papers on Retrieval-Augmented Generation (RAG).

Instructions:
- Keep the meaning of the question. Do not answer it and do not add claims or new topics.
- Every paper in the collection is already about RAG. If the question is about something specific, like a method or a design choice, leave RAG out of the query so it focuses on that specific thing. Only mention RAG if RAG itself is the subject, and then write it as "Retrieval-Augmented Generation (RAG)".
- Never change or replace a method or system name, even if it looks misspelled or unfamiliar (for example HyDE, BM25, ColBERT, GraphRAG). Do not expand these names either.
- Fix spelling mistakes in ordinary words only.
- Use the terms research papers would use. For a question like "what is X", ask for the definition of X.
- If the question has nothing to do with RAG or information retrieval, return it unchanged. Do not connect it to RAG.
- Return only the query, as one sentence.

Examples:
what is rag -> What is the definition of Retrieval-Augmented Generation (RAG)?
hyde vs dense retrievl? -> Comparison of HyDE and dense retrieval
compare bm25 and dense retrieval for rag -> Comparison of BM25 and dense retrieval performance
should i rerank in rag -> Does reranking improve retrieval quality?
`;

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { query } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: query }
      ],
      temperature: 0,
      max_tokens: 100
    });

    const rewritten = completion.choices[0].message?.content?.trim() || query;

    return new Response(JSON.stringify({ query: rewritten }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
