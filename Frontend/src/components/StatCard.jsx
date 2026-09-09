export default function StatCard({ label, value, detail, icon: Icon, tone = "" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon">{Icon && <Icon size={19} />}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}
