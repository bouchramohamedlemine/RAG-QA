// The pipeline, drawn for the page: a wide layout for larger screens and a tall one for phones.

const DESCRIPTION =
  "A user query goes to the document retriever. Semantic and lexical search are fused with RRF, the top k documents are reranked, and relative thresholding selects m documents. The chunk retriever combines each chunk's similarity score with its document score, the top n chunks go to the generator, and the generator writes the answer.";

function Text({ x, y, lines, className, anchor = "middle" }: { x: number; y: number; lines: string[]; className: string; anchor?: "middle" | "start" }) {
  const top = y - ((lines.length - 1) * 15.5) / 2;
  return (
    <text textAnchor={anchor} className={className}>
      {lines.map((line, i) => (
        <tspan key={line} x={x} y={top + i * 15.5} dy="0.35em">
          {line}
        </tspan>
      ))}
    </text>
  );
}

function Part({ x, y, w, h, lines }: { x: number; y: number; w: number; h: number; lines: string[] }) {
  return (
    <>
      <rect className="part" x={x} y={y} width={w} height={h} rx={10} />
      <Text x={x + w / 2} y={y + h / 2} lines={lines} className="part-name" />
    </>
  );
}

function Flows({ id, paths }: { id: string; paths: string[] }) {
  return (
    <>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M1 1 9 5 1 9z" className="head" />
        </marker>
      </defs>
      {paths.map((d) => (
        <path key={d} className="flow" d={d} markerEnd={`url(#${id})`} />
      ))}
    </>
  );
}

function Wide() {
  return (
    <svg className="wide" viewBox="0 0 752 262" role="img" aria-label={DESCRIPTION}>
      <Flows
        id="head-wide"
        paths={[
          "M62 60 H108",
          "M206 50 C244 14 296 14 328 50",
          "M206 70 C244 106 296 106 328 70",
          "M364 60 H446",
          "M506 60 H636",
          "M672 84 V174",
          "M624 190 C586 154 510 154 472 190",
          "M624 210 C586 246 510 246 472 210",
          "M444 200 H268",
          "M170 200 H94",
        ]}
      />

      <Text x={30} y={60} lines={["User", "query"]} className="step" />
      <Part x={110} y={36} w={96} h={48} lines={["Document", "Retriever"]} />
      <Text x={268} y={12} lines={["Semantic search"]} className="tag" />
      <Text x={268} y={108} lines={["Lexical search"]} className="tag" />
      <Text x={345} y={60} lines={["RRF"]} className="step" />
      <Text x={405} y={46} lines={["Top k docs"]} className="tag" />
      <Text x={476} y={60} lines={["Rerank"]} className="step" />
      <Text x={570} y={38} lines={["Relative", "thresholding"]} className="tag" />
      <Text x={672} y={60} lines={["Selected", "m docs"]} className="step" />
      <Part x={624} y={176} w={96} h={48} lines={["Chunk", "Retriever"]} />
      <Text x={548} y={152} lines={["Chunk similarity score"]} className="tag" />
      <Text x={548} y={250} lines={["Document score"]} className="tag" />
      <Text x={458} y={200} lines={["×"]} className="times" />
      <Text x={357} y={186} lines={["Select top n chunks"]} className="tag" />
      <Part x={170} y={176} w={96} h={48} lines={["Generator"]} />
      <Text x={62} y={200} lines={["Answer"]} className="step" />
    </svg>
  );
}

function Tall() {
  return (
    <svg className="tall" viewBox="0 0 342 746" role="img" aria-label={DESCRIPTION}>
      <Flows
        id="head-tall"
        paths={[
          "M171 28 V62",
          "M110 106 C40 135 60 190 146 200",
          "M232 106 C302 135 282 190 196 200",
          "M171 220 V266",
          "M171 298 V344",
          "M171 376 V420",
          "M110 464 C40 493 60 548 152 558",
          "M232 464 C302 493 282 548 190 558",
          "M171 578 V626",
          "M171 670 V716",
        ]}
      />

      <Text x={171} y={14} lines={["User query"]} className="step" />
      <Part x={86} y={64} w={170} h={42} lines={["Document Retriever"]} />
      <Text x={118} y={155} lines={["Semantic", "search"]} className="tag" />
      <Text x={224} y={155} lines={["Lexical", "search"]} className="tag" />
      <Text x={171} y={204} lines={["RRF"]} className="step" />
      <Text x={183} y={243} lines={["Top k docs"]} className="tag" anchor="start" />
      <Text x={171} y={282} lines={["Rerank"]} className="step" />
      <Text x={183} y={321} lines={["Relative thresholding"]} className="tag" anchor="start" />
      <Text x={171} y={360} lines={["Selected m docs"]} className="step" />
      <Part x={86} y={422} w={170} h={42} lines={["Chunk Retriever"]} />
      <Text x={122} y={510} lines={["Chunk", "similarity", "score"]} className="tag" />
      <Text x={224} y={510} lines={["Document", "score"]} className="tag" />
      <Text x={171} y={562} lines={["×"]} className="times" />
      <Text x={183} y={602} lines={["Select top n chunks"]} className="tag" anchor="start" />
      <Part x={106} y={628} w={130} h={42} lines={["Generator"]} />
      <Text x={171} y={732} lines={["Answer"]} className="step" />
    </svg>
  );
}

export default function Pipeline() {
  return (
    <figure className="pipeline">
      <Wide />
      <Tall />
    </figure>
  );
}
