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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
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
    default: "text-slate-900",
    brand: "text-brand-700",
    teal: "text-teal-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="card card-interactive">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-slate-300">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold sm:text-3xl ${toneMap[tone]}`}>
        {value}
        {unit && (
          <span className="ml-1 text-base font-medium text-slate-400">{unit}</span>
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
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
            <p className="font-semibold text-slate-900">{s.title}</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">{s.description}</p>
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
    brand: "border-brand-200 bg-brand-50 text-brand-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
  };
  return (
    <div className={`rounded-2xl border p-4 text-sm ${map[tone]}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="text-slate-700">{children}</div>
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
      <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
