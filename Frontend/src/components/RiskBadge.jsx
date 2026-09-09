export default function RiskBadge({ level, score }) {
  const normalized = String(level || "").toUpperCase();
  const label = normalized === "CRITICAL" || normalized === "CRITICAL_HIGH"
    ? "Critical"
    : normalized.charAt(0) + normalized.slice(1).toLowerCase();

  return (
    <span className={`risk-badge risk-${normalized.toLowerCase()}`}>
      <span className="risk-dot" />
      {score != null ? `${Number(score).toFixed(0)} · ` : ""}{label}
    </span>
  );
}
