"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import About from "./About";
import { RobotOnBox, SmallRobot } from "./Robot";

const QUERY_REWRITER = "Query_rewriter";
const DOCUMENT_RETRIEVER = "Document_retriever";
const CHUNK_RETRIEVER = "Chunk_retriever";
const GENERATOR = "Generator";

const TOP_K = 10;

/** doc_id e.g. "2005.11401v4" → https://arxiv.org/pdf/2005.11401 */
function arxivPdfUrl(docId: string): string {
  const base = docId.replace(/v\d+$/i, "");
  return `https://arxiv.org/pdf/${base}`;
}

type DocWithScore = { doc_id: string; rerank_score: number };
type ContextChunk = { content: string; doc_id: string; title?: string };
type Paper = { id: string; title: string };
type Turn = {
  query: string;
  status?: string;
  answer?: string;
  papers?: Paper[];
  error?: string;
};

/** Call Supabase Edge Function via Next.js API proxy (avoids CORS / "Failed to fetch"). */
async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ functionName: name, body }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg =
      (data && typeof data === "object" && "error" in data ? (data as { error: string }).error : null) ??
      res.statusText ??
      "Request failed";
    return { ok: false, error: `${errMsg} (${res.status})` };
  }
  return { ok: true, data: data as T };
}

function AskBox({
  id,
  placeholder,
  loading,
  onAsk,
}: {
  id: string;
  placeholder: string;
  loading: boolean;
  onAsk: (query: string) => void;
}) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;
    setInput("");
    onAsk(query);
  }

  return (
    <form className="box" onSubmit={handleSubmit}>
      <label htmlFor={id} className="sr-only">
        Your question about RAG
      </label>
      <input
        id={id}
        autoComplete="off"
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit" aria-label="Ask" disabled={loading || !input.trim()}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 15V3M4 8l5-5 5 5" />
        </svg>
      </button>
    </form>
  );
}

export default function ChatUI() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const lastTurnRef = useRef<HTMLElement>(null);
  const turnCount = turns.length;

  useEffect(() => {
    if (turnCount > 0) lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [turnCount]);

  async function ask(query: string) {
    if (loading) return;
    setLoading(true);
    setTurns((prev) => [...prev, { query, status: "Rewriting the query…" }]);

    const update = (patch: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn, i) => (i === prev.length - 1 ? { ...turn, ...patch } : turn)));
    const fail = (error: string) => update({ status: undefined, error });

    try {
      // Query rewriter → retrieval-optimized query (falls back to the raw query if it fails)
      const rewriteRes = await invokeFunction<{ query: string }>(QUERY_REWRITER, { query });
      const searchQuery = (rewriteRes.ok && rewriteRes.data.query) || query;

      // 1️⃣ Document retriever → doc_ids + rerank scores
      update({ status: "Retrieving documents…" });
      const docRes = await invokeFunction<DocWithScore[]>(DOCUMENT_RETRIEVER, { query: searchQuery });
      if (!docRes.ok) return fail(docRes.error);

      const docs = docRes.data ?? [];
      if (docs.length === 0) {
        update({ status: undefined, answer: "No relevant documents were retrieved for your query." });
        return;
      }

      // Transform document retriever output → chunk retriever input: { doc_id, rerank_score } → { doc_id, document_score }
      update({ status: `Retrieving chunks from ${docs.length} ${docs.length === 1 ? "document" : "documents"}…` });
      const docsForChunkRetriever = docs.map((d) => ({ doc_id: d.doc_id, document_score: d.rerank_score }));

      // 2️⃣ Chunk retriever → context (chunks)
      const chunkRes = await invokeFunction<{ context: ContextChunk[]; query: string }>(CHUNK_RETRIEVER, {
        docs: docsForChunkRetriever,
        query: searchQuery,
        top_k: TOP_K,
      });
      if (!chunkRes.ok) return fail(chunkRes.error);

      const context = chunkRes.data.context ?? [];
      const titles = new Map(context.map((c) => [c.doc_id, c.title ?? ""]));
      const papers = [...titles].map(([id, title]) => ({ id, title: title || id }));

      // 3️⃣ Generator → answer
      update({ status: "Generating the answer…" });
      const genRes = await invokeFunction<{ answer: string }>(GENERATOR, { context, query });
      if (!genRes.ok) return fail(genRes.error);

      update({ status: undefined, answer: genRes.data?.answer ?? "No answer generated.", papers });
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    if (loading) return;
    setTurns([]);
    window.scrollTo(0, 0);
  }

  function focusQuestionBox() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("first-question")?.focus({ preventScroll: true });
  }

  if (turns.length === 0) {
    return (
      <>
        <main className="hero">
          <h1 className="rise d1">Ask any question about RAG</h1>
          <div className="seat rise d2">
            <RobotOnBox />
            <AskBox id="first-question" placeholder="Ask a question..." loading={loading} onAsk={ask} />
          </div>
          <p className="lede rise d3">
            So far it has 3,083 research papers from arXiv. The goal is to make it easy for engineers to find literature-backed answers to specific design choices.
          </p>
        </main>

        <About onStart={focusQuestionBox} />
      </>
    );
  }

  return (
    <div className="chat">
      <button type="button" className="home" aria-label="Back to home" title="Back to home" onClick={startOver} disabled={loading}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 9H3M8 4 3 9l5 5" />
        </svg>
      </button>

      <div className="thread" aria-live="polite">
        {turns.map((turn, i) => (
          <article className="turn" key={i} ref={i === turns.length - 1 ? lastTurnRef : undefined}>
            <h2 className="q">{turn.query}</h2>
            {turn.status && (
              <div className="who working">
                <SmallRobot />
                <span>{turn.status}</span>
              </div>
            )}
            {turn.error && <p className="err">Something went wrong: {turn.error}</p>}
            {turn.answer && (
              <div className="answer">
                <ReactMarkdown>{turn.answer}</ReactMarkdown>
              </div>
            )}
            {turn.papers && turn.papers.length > 0 && (
              <div className="srcs">
                <h3>
                  Retrieved from {turn.papers.length} {turn.papers.length === 1 ? "paper" : "papers"}
                </h3>
                <ul>
                  {turn.papers.map((paper) => (
                    <li key={paper.id}>
                      <a href={arxivPdfUrl(paper.id)} target="_blank" rel="noopener noreferrer">
                        {paper.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="dock">
        <AskBox id="next-question" placeholder="Ask a question..." loading={loading} onAsk={ask} />
      </div>
    </div>
  );
}
