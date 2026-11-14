import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
});

const INSTRUCTIONS = `
You read a user's message for an assistant that only knows research papers on Retrieval-Augmented Generation (RAG). Do two things and return JSON: {"on_topic": true or false, "query": "..."}.

You may also get the conversation so far: up to 3 earlier questions (already rewritten as search queries) and their answers. Use it like this:
- If the new message is a follow-up that only makes sense with the earlier questions (for example "in which fields?", "what about legal?", "tell me more", or words like "these", "it", "that"), judge it and rewrite it by what it means in the conversation.
- A follow-up to a question about RAG is on topic, even when it names other fields such as healthcare, finance or law.
- If the new message starts a new subject, ignore the conversation.
- Only name things the user or the earlier questions named. Never add your own examples, such as fields, methods or datasets: the papers should supply them.
- Greetings, thanks, small talk and unrelated questions are still off topic, whatever came before.

1. Decide on_topic. Wrongly rejecting a real question is much worse than letting an unrelated one through, so only use false when the message is clearly unrelated.
- false: only greetings, thanks, small talk, questions about the assistant, and subjects clearly outside computing, such as cooking, sport, history, or general life questions.
- true: everything else, including anything about AI, machine learning, language models, hallucinations, search, information retrieval, databases, data, indexing, ranking, text processing, evaluation metrics, or any technical term or method name you do not recognise.

2. Rewrite the message into a search query for the papers. If on_topic is false, return the message unchanged.
- Keep the meaning of the question. Do not answer it and do not add claims or new topics.
- Every paper in the collection is already about RAG. If the question is about something specific, like a method or a design choice, leave RAG out of the query so it focuses on that specific thing. Only mention RAG if RAG itself is the subject, and then write it as "Retrieval-Augmented Generation (RAG)".
- Never change or replace a method or system name, even if it looks misspelled or unfamiliar (for example HyDE, BM25, ColBERT, GraphRAG). Do not expand these names either.
- Fix spelling mistakes in ordinary words only.
- Use the terms research papers would use. For a question like "what is X", ask for the definition of X.
- The query is one sentence, and it must make sense on its own, without the conversation: name the things a follow-up refers to.

Examples:
what is rag -> {"on_topic": true, "query": "What is the definition of Retrieval-Augmented Generation (RAG)?"}
hyde vs dense retrievl? -> {"on_topic": true, "query": "Comparison of HyDE and dense retrieval"}
compare bm25 and dense retrieval for rag -> {"on_topic": true, "query": "Comparison of BM25 and dense retrieval performance"}
should i rerank in rag -> {"on_topic": true, "query": "Does reranking improve retrieval quality?"}
what is faiss -> {"on_topic": true, "query": "What is the definition of FAISS?"}
what is a graph database -> {"on_topic": true, "query": "What is the definition of a graph database?"}
why does my model make things up -> {"on_topic": true, "query": "Why do language models generate unsupported claims?"}
hi -> {"on_topic": false, "query": "hi"}
what is the capital of France -> {"on_topic": false, "query": "what is the capital of France"}

Examples with a conversation:
Earlier question: "What is the definition of Retrieval-Augmented Generation (RAG)?"
New message: "in which fields? healthcare, finance, legal?" -> {"on_topic": true, "query": "Applications of Retrieval-Augmented Generation (RAG) in healthcare, finance and law"}
Earlier question: "What is the definition of Retrieval-Augmented Generation (RAG)?"
New message: "in which fields?" -> {"on_topic": true, "query": "Applications of Retrieval-Augmented Generation (RAG) in various fields"}
Earlier question: "Comparison of HyDE and dense retrieval"
New message: "which one is faster?" -> {"on_topic": true, "query": "Retrieval latency of HyDE compared with dense retrieval"}
Earlier question: "Does reranking improve retrieval quality?"
New message: "thanks!" -> {"on_topic": false, "query": "thanks!"}
`;

const MAX_HISTORY = 3;
const MAX_ANSWER_LENGTH = 1000;

type Turn = { question: string; answer: string };

/** The new message alone, or with the conversation before it when there is one. */
function userMessage(query: string, history: Turn[]): string {
  if (history.length === 0) return query;
  const turns = history
    .map((t, i) => `Earlier question ${i + 1}: ${t.question}\nAnswer ${i + 1}: ${t.answer.slice(0, MAX_ANSWER_LENGTH)}`)
    .join("\n\n");
  return `Conversation so far (oldest first):\n${turns}\n\nNew message: ${query}`;
}

serve(async (req) => {
  try {
    if (req.headers.get("x-edge-secret") !== Deno.env.get("EDGE_FUNCTION_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { query, history } = await req.json();
    const turns: Turn[] = (Array.isArray(history) ? history : [])
      .filter((t) => typeof t?.question === "string" && typeof t?.answer === "string")
      .slice(-MAX_HISTORY);

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: userMessage(query, turns) }
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message?.content ?? "{}");

    return new Response(JSON.stringify({ on_topic: result.on_topic !== false, query: result.query || query }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
