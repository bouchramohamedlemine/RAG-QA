/** A robot that is just a round face with glasses and two hands, reading a research paper. */
function RobotArt({ moving }: { moving: boolean }) {
  return (
    <g stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <g className={moving ? "sway" : undefined}>
        <rect x={52} y={36} width={116} height={106} rx={42} fill="var(--sheet)" />

        {/* Glasses. The eyes look down at the paper, and up at you while you type. */}
        <circle cx={86} cy={80} r={21} fill="var(--mist)" />
        <circle cx={134} cy={80} r={21} fill="var(--mist)" />
        <path d="M107 78 Q110 74 113 78 M65 78 H53 M155 78 H167" fill="none" />
        <g className="gaze">
        <g className={moving ? "eyes" : undefined} stroke="none">
          <circle cx={87} cy={86} r={8.5} fill="var(--ink)" />
          <circle cx={135} cy={86} r={8.5} fill="var(--ink)" />
          <circle cx={90} cy={83} r={2.8} fill="var(--sheet)" />
          <circle cx={138} cy={83} r={2.8} fill="var(--sheet)" />
        </g>
        </g>
        <path d="M104 110 Q110 115 116 110" fill="none" strokeWidth={2.6} />
      </g>

      {/* The open paper */}
      <path d="M110 128 C98 120 84 120 70 124 V156 C84 152 98 152 110 160 C122 152 136 152 150 156 V124 C136 120 122 120 110 128 Z" fill="var(--sheet)" strokeWidth={2.8} />
      <path d="M110 128 V160" fill="none" strokeWidth={2.2} />
      <path d="M80 132 C87 130 94 131 101 134 M80 140 C87 138 94 139 101 142 M80 148 C85 146 90 147 95 148 M119 134 C126 131 133 130 140 132 M119 142 C126 139 133 138 140 140 M119 148 C124 147 129 146 134 147" fill="none" stroke="var(--soft)" strokeWidth={1.8} />

      {/* Hands holding it */}
      <ellipse cx={68} cy={142} rx={10} ry={13} fill="var(--denim)" />
      <ellipse cx={152} cy={142} rx={10} ry={13} fill="var(--denim)" />
    </g>
  );
}

/** The robot reading on top of the question box. */
export function RobotOnBox() {
  return (
    <svg className="doll" viewBox="0 30 220 135" role="img" aria-label="A robot face with round glasses, holding an open research paper in two hands and reading it">
      <RobotArt moving />
    </svg>
  );
}

export function SmallRobot() {
  return (
    <svg viewBox="0 30 220 135" aria-hidden="true">
      <RobotArt moving={false} />
    </svg>
  );
}
