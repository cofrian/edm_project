import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="animate-fade-in-up">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
              {description}
            </p>
          )}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "default" | "brand" | "teal" | "amber" | "red";
  icon?: ReactNode;
}) {
  const toneMap = {
    default: "text-white",
    brand: "text-cyan-400",
    teal: "text-teal-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };
  return (
    <div className="card card-interactive">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        {icon && <span className="text-slate-600">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold sm:text-3xl ${toneMap[tone]}`}>
        {value}
        {unit && (
          <span className="ml-1 text-base font-medium text-slate-500">{unit}</span>
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Steps({
  steps,
}: {
  steps: { title: string; description: string; icon?: ReactNode }[];
}) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={i} className="card relative">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
              {s.icon ?? i + 1}
            </span>
            <p className="font-semibold text-white">{s.title}</p>
          </div>
          <p className="mt-3 text-sm text-slate-400">{s.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function Callout({
  tone = "brand",
  title,
  children,
}: {
  tone?: "brand" | "amber" | "teal";
  title?: string;
  children: ReactNode;
}) {
  const map = {
    brand: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    teal: "border-teal-500/25 bg-teal-500/10 text-teal-100",
  };
  return (
    <div className={`rounded-2xl border p-4 text-sm ${map[tone]}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="text-slate-300">{children}</div>
    </div>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    </div>
  );
}
