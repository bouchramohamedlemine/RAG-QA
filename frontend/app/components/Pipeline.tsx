// The pipeline, in the style of the original diagram: a wide layout for larger screens and a tall one for phones.

const DESCRIPTION =
  "A user query goes to the document retriever. Semantic and lexical search each return their top k documents, which are fused with RRF and reranked, and relative thresholding selects m documents. The chunk retriever combines each chunk's similarity score with its document score, the top n chunks go to the generator, and the generator writes the answer.";

function Text({ x, y, lines, gap, className }: { x: number; y: number; lines: string[]; gap: number; className: string }) {
  const top = y - ((lines.length - 1) * gap) / 2;
  return (
    <text textAnchor="middle" className={className}>
      {lines.map((line, i) => (
        <tspan key={line} x={x} y={top + i * gap} dy="0.35em">
          {line}
        </tspan>
      ))}
    </text>
  );
}

type BoxProps = { x: number; y: number; w: number; h: number; lines: string[]; gap: number; radius: number; shaded?: boolean };

function Box({ x, y, w, h, lines, gap, radius, shaded }: BoxProps) {
  return (
    <>
      <rect className={shaded ? "shape shaded" : "shape"} x={x} y={y} width={w} height={h} rx={radius} />
      <Text x={x + w / 2} y={y + h / 2} lines={lines} gap={gap} className="name" />
    </>
  );
}

function Multiply({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const d = r * 0.707;
  return (
    <>
      <circle className="shape" cx={cx} cy={cy} r={r} />
      <path className="shape" d={`M${cx - d} ${cy - d} L${cx + d} ${cy + d} M${cx + d} ${cy - d} L${cx - d} ${cy + d}`} />
    </>
  );
}

function Flows({ id, size, paths }: { id: string; size: number; paths: string[] }) {
  return (
    <>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth={size} markerHeight={size} orient="auto">
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
  const box = { gap: 32, radius: 16 };
  const label = { gap: 28, className: "label" };
  return (
    <svg className="wide" viewBox="0 0 1360 462" role="img" aria-label={DESCRIPTION}>
      <Flows
        id="head-wide"
        size={24}
        paths={[
          "M152 100 H232",
          "M392 50 H606 Q620 50 620 64 V74",
          "M392 150 H606 Q620 150 620 136 V126",
          "M676 100 H810",
          "M960 100 H1200",
          "M1279 160 V300",
          "M1200 308 H894 Q880 308 880 322 V336",
          "M1200 412 H894 Q880 412 880 398 V384",
          "M856 360 H620",
          "M470 360 H320",
        ]}
      />

      <Box x={2} y={40} w={150} h={120} lines={["User query"]} {...box} />
      <Box x={232} y={40} w={160} h={120} lines={["Document", "Retriever"]} shaded {...box} />
      <ellipse className="shape" cx={620} cy={100} rx={56} ry={26} />
      <Text x={620} y={100} lines={["RRF"]} gap={32} className="name" />
      <Box x={810} y={40} w={150} h={120} lines={["Rerank"]} {...box} />
      <Box x={1200} y={40} w={158} h={120} lines={["Selected m", "docs"]} {...box} />
      <Box x={1200} y={300} w={158} h={120} lines={["Chunk", "Retriever"]} shaded {...box} />
      <Multiply cx={880} cy={360} r={24} />
      <Box x={470} y={300} w={150} h={120} lines={["Generator"]} shaded {...box} />
      <Box x={170} y={300} w={150} h={120} lines={["Answer"]} {...box} />

      <Text x={499} y={50} lines={["Semantic search"]} {...label} />
      <Text x={499} y={150} lines={["lexical search"]} {...label} />
      <Text x={499} y={100} lines={["Top k docs"]} {...label} />
      <Text x={1080} y={78} lines={["relative thresholding"]} {...label} />
      <Text x={1045} y={308} lines={["Chunk similarity score"]} {...label} />
      <Text x={1045} y={412} lines={["document score"]} {...label} />
      <Text x={738} y={338} lines={["select top n chunks"]} {...label} />
    </svg>
  );
}

function Tall() {
  const box = { gap: 17, radius: 9 };
  const label = { gap: 15, className: "label" };
  return (
    <svg className="tall" viewBox="0 0 342 876" role="img" aria-label={DESCRIPTION}>
      <Flows
        id="head-tall"
        size={13}
        paths={[
          "M171 45 V76",
          "M110 124 V196 Q110 206 120 206 H137",
          "M232 124 V196 Q232 206 222 206 H205",
          "M171 224 V284",
          "M171 328 V398",
          "M171 442 V512",
          "M110 560 V632 Q110 642 120 642 H151",
          "M232 560 V632 Q232 642 222 642 H191",
          "M171 662 V726",
          "M171 770 V830",
        ]}
      />

      <Box x={106} y={1} w={130} h={44} lines={["User query"]} {...box} />
      <Box x={86} y={76} w={170} h={48} lines={["Document Retriever"]} shaded {...box} />
      <ellipse className="shape" cx={171} cy={206} rx={34} ry={18} />
      <Text x={171} y={206} lines={["RRF"]} gap={17} className="name" />
      <Box x={106} y={284} w={130} h={44} lines={["Rerank"]} {...box} />
      <Box x={96} y={398} w={150} h={44} lines={["Selected m docs"]} {...box} />
      <Box x={86} y={512} w={170} h={48} lines={["Chunk Retriever"]} shaded {...box} />
      <Multiply cx={171} cy={642} r={20} />
      <Box x={106} y={726} w={130} h={44} lines={["Generator"]} shaded {...box} />
      <Box x={106} y={830} w={130} h={44} lines={["Answer"]} {...box} />

      <Text x={110} y={146} lines={["Semantic search"]} {...label} />
      <Text x={232} y={146} lines={["lexical search"]} {...label} />
      <Text x={171} y={176} lines={["Top k docs"]} {...label} />
      <Text x={171} y={363} lines={["relative thresholding"]} {...label} />
      <Text x={110} y={596} lines={["Chunk similarity", "score"]} {...label} />
      <Text x={232} y={596} lines={["document score"]} {...label} />
      <Text x={171} y={694} lines={["select top n chunks"]} {...label} />
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
