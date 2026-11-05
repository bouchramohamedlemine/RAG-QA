// Supabase Edge runtime types
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

// ---------------- CLIENTS ----------------
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!
});

// ---------------- CONFIG ----------------
const K1 = 25;        // semantic retrieval
const K2 = 25;        // lexical retrieval
const RRF_K = 60;     // standard RRF constant
const DELTA = 0.3;    // threshold relative to max rerank score
const MIN_SCORE = 0.01;  // optional tiny absolute cutoff for nonsense queries

// ---------------- SERVER ----------------
Deno.serve(async (req: Request) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { query } = await req.json();

    // Embed query
    const embedRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query
    });
    const queryEmbedding = embedRes.data[0].embedding;

    // Semantic search
    const { data: semanticDocs, error: semErr } =
      await supabase.rpc("semantic_search", {
        query_embedding: queryEmbedding,
        k1: K1
      });
    if (semErr) throw semErr;

    // Lexical search
    const { data: lexicalDocs, error: lexErr } =
      await supabase.rpc("lexical_search", {
        query,
        k2: K2
      });
    if (lexErr) throw lexErr;

    // RRF fusion
    const rrfMap = new Map<string, any>();
    (semanticDocs ?? []).forEach((d, idx) => {
      const rank = idx + 1;
      const score = 1 / (RRF_K + rank);
      if (!rrfMap.has(d.id)) {
        rrfMap.set(d.id, { id: d.id, document_summary: d.document_summary, rrf_score: 0 });
      }
      rrfMap.get(d.id).rrf_score += score;
    });

    (lexicalDocs ?? []).forEach((d, idx) => {
      const rank = idx + 1;
      const score = 1 / (RRF_K + rank);
      if (!rrfMap.has(d.id)) {
        rrfMap.set(d.id, { id: d.id, document_summary: d.document_summary, rrf_score: 0 });
      }
      rrfMap.get(d.id).rrf_score += score;
    });

    const rrfDocs = Array.from(rrfMap.values()).sort((a, b) => b.rrf_score - a.rrf_score);

    if (rrfDocs.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    // Cohere REST rerank
    const resp = await fetch("https://api.cohere.ai/rerank", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("COHERE_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "rerank-english-v3.0",
        query,
        documents: rrfDocs.map(d => d.document_summary),
        top_n: rrfDocs.length // rerank all candidates
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cohere rerank failed: ${resp.status} ${text}`);
    }

    const rerankRes = await resp.json();

    // Thresholding based on relative rerank score
    const rerankedDocs = rerankRes.results.map((r: any) => ({
      doc_id: rrfDocs[r.index].id,
      rerank_score: r.relevance_score
    }));


    const maxScore = Math.max(...rerankedDocs.map(d => d.rerank_score));
    const finalDocs = rerankedDocs.filter(
      d => d.rerank_score >= maxScore - DELTA && d.rerank_score >= MIN_SCORE
    );

    return new Response(JSON.stringify(finalDocs), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("EDGE ERROR:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
