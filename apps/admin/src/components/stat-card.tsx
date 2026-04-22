type Props = {
  label: string;
  value: number | string;
  hint: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <article className="panel stat-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}
