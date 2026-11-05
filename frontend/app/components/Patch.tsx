import { useId } from "react";

const BODY =
  "M62 26 C90 16 134 16 160 24 C174 30 178 44 178 66 L178 122 C178 146 168 158 146 160 C118 164 92 164 72 160 C52 158 44 146 44 124 L44 64 C44 42 48 30 62 26 Z";

const seam = {
  fill: "none",
  stroke: "var(--thread)",
  strokeWidth: 2.2,
  strokeDasharray: "6 5",
  strokeLinecap: "round",
} as const;

function ButtonEye({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="var(--ink)" />
      <circle cx={x} cy={y} r={r - 3} fill="none" stroke="var(--sheet)" strokeOpacity={0.35} strokeWidth={1.2} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (
        <circle key={`${a}${b}`} cx={x + a * r * 0.25} cy={y + b * r * 0.25} r={1.6} fill="var(--sheet)" />
      ))}
    </>
  );
}

/** Patch: a rag doll sewn from pieces of paper. The patches are the chunks; the seams are the stitching. */
function PatchArt({ moving }: { moving: boolean }) {
  const clipId = `patch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <>
      <g stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round">
        <path d="M50 94 C32 98 22 114 26 127 C30 138 43 136 50 124 Z" fill="var(--denim)" />
        <path d="M186 88 L207 49" fill="none" strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={207} cy={49} r={2.4} fill="var(--sheet)" strokeWidth={1.8} />
        <path d="M172 108 C188 104 198 94 199 83 C200 72 188 67 180 74 C174 80 171 84 171 84 Z" fill="var(--mustard)" />
      </g>
      <clipPath id={clipId}>
        <path d={BODY} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x={40} y={10} width={145} height={160} fill="var(--sheet)" />
        <path d="M40 114 L108 108 L113 170 H40 Z" fill="var(--denim)" />
        <path d="M108 108 L184 116 V170 H113 Z" fill="var(--mustard)" />
        <path d="M142 10 H184 V56 L147 50 Z" fill="var(--mist)" />
        <path d="M56 126 H94M56 135 H98M58 144 H90" stroke="var(--sheet)" strokeOpacity={0.7} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M124 128 H164M124 137 H160M126 146 H152" stroke="var(--ink)" strokeOpacity={0.28} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M44 114 L108 108 L113 164" {...seam} />
        <path d="M108 108 L180 116" {...seam} />
        <path d="M142 20 L147 50 L180 56" {...seam} />
      </g>
      <path d={BODY} fill="none" stroke="var(--ink)" strokeWidth={3} />
      <path d="M108 20 C103 8 116 3 119 12" fill="none" stroke="var(--thread)" strokeWidth={2.2} strokeLinecap="round" />
      <g className={moving ? "eyes" : undefined}>
        <ButtonEye x={88} y={70} r={13} />
        <ButtonEye x={134} y={70} r={11} />
      </g>
      <path d="M97 94 Q110 106 124 94" fill="none" stroke="var(--thread)" strokeWidth={2.6} strokeLinecap="round" strokeDasharray="4 4" />
    </>
  );
}

/** Patch sitting on the question box; the thread from the needle runs into the box's stitching. */
export function PatchOnBox() {
  return (
    <svg className="doll" viewBox="0 0 220 170" role="img" aria-label="A rag doll holding a needle">
      <path
        className="thread-in"
        pathLength={1}
        d="M207 49 C240 36 252 112 232 165"
        fill="none"
        stroke="var(--thread)"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <g className="sway">
        <PatchArt moving />
      </g>
    </svg>
  );
}

export function SmallPatch() {
  return (
    <svg viewBox="0 0 220 170" aria-hidden="true">
      <PatchArt moving={false} />
    </svg>
  );
}
