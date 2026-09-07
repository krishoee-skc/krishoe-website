/**
 * A small circular progress meter — a share drawn as a ring rather than said as
 * a number, so a percentage is a glance instead of a read. Pure SVG, no client
 * code, safe in server components; the centred label stays exact.
 *
 * The ring fills clockwise from the top in the shop's green, on a faint track,
 * with the percent (or any label) centred. Values are clamped to 0–100.
 */
export default function ProgressRing({
  percent,
  size = 64,
  stroke = 6,
  label,
  tone = "good",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  /** Centre text; defaults to the rounded percent. */
  label?: string;
  tone?: "good" | "gold" | "warn";
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  const COLOR: Record<string, string> = {
    good: "#1f7a5a",
    gold: "#b98b2e",
    warn: "#c07d1e",
  };
  const color = COLOR[tone] ?? COLOR.good;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label ?? `${Math.round(clamped)} percent`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-brand-green-line"
        opacity={0.5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-brand-green-ink font-display font-black"
        style={{ fontSize: size * 0.28 }}
      >
        {label ?? `${Math.round(clamped)}%`}
      </text>
    </svg>
  );
}
