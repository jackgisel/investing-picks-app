/**
 * One value per fiscal year as columns. Server-rendered SVG: no client code,
 * and the numbers sit in the markup, so they are readable by crawlers and
 * screen readers as well as on screen.
 */
export function YearBars({
  title,
  points,
  format,
  color,
}: {
  title: string;
  points: { label: string; value: number }[];
  format: (v: number) => string;
  color: string;
}) {
  const shown = points.filter((p) => Number.isFinite(p.value) && p.value > 0).slice(-6);
  if (shown.length === 0) return null;
  const max = Math.max(...shown.map((p) => p.value));
  const W = 100 * shown.length;
  const H = 180;
  const top = 26;
  const bottom = 24;
  const barW = 56;

  return (
    <figure className="data-card">
      <figcaption className="mb-3 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-text-dim">
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}: ${shown.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}
      >
        {shown.map((p, i) => {
          const h = ((H - top - bottom) * p.value) / max;
          const x = i * 100 + (100 - barW) / 2;
          const y = H - bottom - h;
          const last = i === shown.length - 1;
          return (
            <g key={p.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={color}
                opacity={last ? 1 : 0.45}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-text font-mono"
                fontSize={15}
                fontWeight={last ? 600 : 400}
              >
                {format(p.value)}
              </text>
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                className="fill-text-dim font-mono"
                fontSize={14}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
