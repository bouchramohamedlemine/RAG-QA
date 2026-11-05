import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

// Initialize Supabase
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
});

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { docs, query, top_k } = await req.json();

    if (!docs || !query) {
      return new Response(JSON.stringify({ error: "Missing docs or query" }), { status: 400 });
    }

    // Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      dimensions: 512
    });
    const query_embedding = embeddingResponse.data[0].embedding;

    // Call Supabase function to get top chunks
    const { data, error } = await supabase.rpc("get_top_chunks", {
      docs: docs,
      query_embedding,
      top_k: top_k ?? 10
    });

    if (error) {
      console.error("RPC Error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Look up paper titles so the answer can say which paper each finding came from
    const usedDocIds = [...new Set(data.map((chunk: any) => chunk.doc_id))];
    const { data: papers, error: titleError } = await supabase
      .from("documents")
      .select("doc_id, title")
      .in("doc_id", usedDocIds);

    if (titleError) {
      console.error("Title lookup error:", titleError);
    }

    const titles = new Map((papers ?? []).map((p: any) => [p.doc_id, p.title]));

    // Keep each chunk's paper so the answer can reference the papers actually used
    const context = data.map((chunk: any) => ({
      content: chunk.content,
      doc_id: chunk.doc_id,
      title: titles.get(chunk.doc_id) ?? ""
    }));

    return new Response(
      JSON.stringify({
        context,
        query
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
