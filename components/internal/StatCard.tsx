export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="internal-card">
      <div className="internal-label">{label}</div>
      <div className="internal-value">{value}</div>
      {hint ? <div className="internal-hint">{hint}</div> : null}
    </article>
  );
}
