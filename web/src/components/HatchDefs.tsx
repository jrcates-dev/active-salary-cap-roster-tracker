/**
 * SVG pattern definitions for the "inactive" hatch. Render once per SVG and fill
 * inactive shapes with `url(#hatch-<team>)`, or use the neutral `#hatch`.
 */
export function hatchId(team?: string) {
  return team ? `hatch-${team}` : "hatch";
}

export function HatchDefs({ teams }: { teams?: { team: string; color: string }[] }) {
  const entries = teams ?? [];
  return (
    <defs>
      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="currentColor" fillOpacity="0.15" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
      </pattern>
      {entries.map(({ team, color }) => (
        <pattern
          key={team}
          id={hatchId(team)}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill={color} fillOpacity="0.2" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2" strokeOpacity="0.55" />
        </pattern>
      ))}
    </defs>
  );
}
