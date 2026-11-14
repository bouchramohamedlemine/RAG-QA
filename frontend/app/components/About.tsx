import type { ReactNode } from "react";
import Pipeline from "./Pipeline";

// The README's formulas, written as MathML so browsers draw them without an extra library.
const RRF_FORMULA = `<math display="block"><mtext>RRF</mtext><mo stretchy="false">(</mo><mi>d</mi><mo stretchy="false">)</mo><mo>=</mo><munder><mo>∑</mo><mrow><mi>r</mi><mo>∈</mo><mo>{</mo><mtext>semantic, lexical</mtext><mo>}</mo></mrow></munder><mfrac><mn>1</mn><mrow><mi>k</mi><mo>+</mo><msub><mtext>rank</mtext><mi>r</mi></msub><mo stretchy="false">(</mo><mi>d</mi><mo stretchy="false">)</mo></mrow></mfrac></math>`;

const THRESHOLD_FORMULA = `<math display="block"><mi>d</mi><mo>.</mo><mtext>rerank_score</mtext><mo>≥</mo><munder><mo>max</mo><mtext>docs</mtext></munder><mtext>rerank_score</mtext><mo>−</mo><mi mathvariant="normal">Δ</mi></math><p>and</p><math display="block"><mi>d</mi><mo>.</mo><mtext>rerank_score</mtext><mo>≥</mo><mtext>MIN_SCORE</mtext></math>`;

const CHUNK_FORMULA = `<math display="block"><mtext>chunk_score</mtext><mo>=</mo><msub><mtext>rerank_score</mtext><mi>d</mi></msub><mo>×</mo><mtext>sim</mtext><mo stretchy="false">(</mo><mi>c</mi><mo>,</mo><mi>q</mi><mo stretchy="false">)</mo></math>`;

function Formula({ math, children }: { math: string; children?: ReactNode }) {
  return (
    <figure className="formula">
      <div dangerouslySetInnerHTML={{ __html: math }} />
      {children && <figcaption>{children}</figcaption>}
    </figure>
  );
}

function Stage({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li>
      <span className="num">{number}</span>
      <div className="stage">
        <h3>{title}</h3>
        {children}
      </div>
    </li>
  );
}

export default function About({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="story" id="pipeline">
        <h2>Pipeline</h2>
        <p className="sub">
          We use a two-stage hierarchical retrieval with document gating.
        </p>
        <Pipeline />
      </section>

      <section className="story">
        <h2>Stages</h2>
        <ol className="steps">
          <Stage number={1} title="Preprocessing">
            <p>I iterated on this stage so documents are processed and stored for effective downstream retrieval.</p>
            <h4>Data modeling and section processing</h4>
            <ul className="points">
              <li>Documents and chunks are <strong>Pydantic</strong> data structures, with rich metadata per chunk for retrieval.</li>
              <li>Sections are extracted, then <strong>GPT</strong> writes a section-level summary of the key concepts and domain terms.</li>
              <li><strong>GPT</strong> then writes a document-level summary from the section summaries, with the title and abstract added. This is used for document-level filtering before chunk retrieval.</li>
            </ul>
            <h4>Chunking and embedding</h4>
            <ul className="points">
              <li>Sentence-level chunking per section, since papers already structure ideas by section.</li>
              <li>Chunks (512 dimensions) and document summaries (1536 dimensions) are embedded with <strong>OpenAI&apos;s small embedding model</strong>.</li>
            </ul>
          </Stage>

          <Stage number={2} title="Query Rewriting">
            <p>Raw user queries should not go directly to the retriever. In one call, the language model filters the message and rewrites it into a search query, resolving follow-ups.</p>
            <ul className="points">
              <li><strong>Conversation history:</strong> the browser keeps each question that got a real answer from the papers (off-topic messages and errors are not kept), and sends the last 3 questions and answers with every new message (past answers cut to 1,000 characters). Both the filtering and the rewriting below use them.</li>
              <li><strong>History-aware topic filtering:</strong> messages that are not about RAG are filtered out, without searching the papers. The message is judged together with the history, so after a RAG question, &ldquo;in which fields?&rdquo; counts as a follow-up, while &ldquo;hi&rdquo; is still filtered out.</li>
              <li><strong>Rewriting:</strong> the language model rewrites the message into one standalone, retrieval-optimized query: a follow-up is made to make sense on its own, in the terms papers use, e.g. &ldquo;in which fields?&rdquo; → &ldquo;Applications of Retrieval-Augmented Generation in healthcare, finance and law&rdquo;. Retrieval searches with this query, the final answer is written for it, and it, not the original message, is what gets saved in the history, so each saved question makes sense even after the earlier ones leave the last 3.</li>
            </ul>
            <p className="refs">
              <a href="https://aclanthology.org/D19-1605/" target="_blank" rel="noopener noreferrer">CANARD</a> defined rewriting follow-ups into standalone questions,{" "}
              <a href="https://arxiv.org/abs/2010.04898" target="_blank" rel="noopener noreferrer">QReCC</a> applied it to search and answer,{" "}
              and <a href="https://arxiv.org/abs/2303.06573" target="_blank" rel="noopener noreferrer">LLM4CS</a> showed an LLM can do it from a prompt.
            </p>
          </Stage>

          <Stage number={3} title="Document Retrieval">
            <p>This is the most important stage: mistakes here can lead to selecting irrelevant chunks later.</p>
            <h4>Hybrid retrieval</h4>
            <p>I use hybrid retrieval (semantic + keyword search). Keyword matching captures domain terms, and semantic search handles synonyms and paraphrases.</p>
            <ul className="points">
              <li>BM25 was difficult to integrate on Supabase, so lexical retrieval uses PostgreSQL full-text search with a GIN index over a tsvector representation. This provides token-based matching over document summaries.</li>
              <li>To make semantic search fast, I use an IVFFLAT ANN index with 5 inverted lists, so distances are only computed within the most relevant cluster at query time.</li>
            </ul>
            <h4>Reciprocal Rank Fusion</h4>
            <p>The semantic and lexical rankings are fused with RRF. For each document d:</p>
            <Formula math={RRF_FORMULA}>
              k = 60, and rank<sub>r</sub>(d) is d&apos;s 1-based rank in ranking r.
            </Formula>
            <p>Documents ranking well in both lists get a higher score. The reason for using a fused score is to make this scalable, so documents with a low RRF can be filtered out as the corpus grows. For now I still pass the top 25 from each search to the next stage, so RRF only merges the two lists.</p>
            <h4>Reranking and relative threshold</h4>
            <p>The documents are then reranked with Cohere&apos;s rerank-english-v3.0 and selected using a relative threshold, so the number of documents returned adapts to the query. A document d is kept if:</p>
            <Formula math={THRESHOLD_FORMULA} />
            <p>The goal is to return as many papers as actually contain the answer (e.g. 10, 2 or 0). In practice, queries with low reranker scores are filtered by the minimum score, but the threshold filters less when the top score is close to 1.0.</p>
          </Stage>

          <Stage number={4} title="Chunk Retrieval">
            <p>The selected documents and their rerank scores are passed from the previous stage. Each chunk is scored as:</p>
            <Formula math={CHUNK_FORMULA}>
              d is the parent document, c is the chunk, and sim(c, q) is the chunk–query semantic similarity.
            </Formula>
            <p>Chunk relevance is modulated by document relevance. The top 10 chunks are selected for answer generation.</p>
          </Stage>

          <Stage number={5} title="Answer Generation">
            <p>The top 10 chunks are passed as context to the language model (gpt-4o-mini), which is good at explaining concepts, comparing methods and providing evidence. It is instructed to name the paper behind each finding.</p>
            <p>If a question cannot be answered from the documents, the model says so instead of using its own knowledge.</p>
          </Stage>
        </ol>
      </section>

      <div className="go">
        <button type="button" className="cta" onClick={onStart}>
          Ask a question
        </button>
      </div>

      <footer>
        <span>
          Built by{" "}
          <a href="https://bouchra.tech" target="_blank" rel="noopener noreferrer">
            Bouchra Mohamed Lemine
          </a>
        </span>
        <span>Thank you to arXiv for use of its open access interoperability.</span>
      </footer>
    </>
  );
}
