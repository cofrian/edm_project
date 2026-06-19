export function MetricCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="card">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-5 font-display text-5xl font-semibold leading-none tracking-[-0.045em] text-slate-950">
        {value}
        {unit && <span className="ml-1 align-baseline text-base font-semibold tracking-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-4 text-sm leading-6 text-slate-400">{hint}</p>}
    </div>
  );
}
