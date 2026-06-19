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
      <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">
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
  const longValue = typeof value === "string" && value.length > 10;
  const valueSize = longValue ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl";

  return (
    <div className="card card-interactive min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-slate-500">{label}</p>
        {icon && <span className="rounded-full bg-slate-100 p-2 text-slate-400">{icon}</span>}
      </div>
      <p className={`mt-5 break-words font-display leading-[0.95] tracking-[-0.045em] ${valueSize} font-semibold ${toneMap[tone]}`}>
        {value}
        {unit && (
          <span className="ml-1 align-baseline text-base font-semibold tracking-normal text-slate-400">{unit}</span>
        )}
      </p>
      {hint && <p className="mt-4 max-w-full text-sm leading-6 text-slate-400">{hint}</p>}
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
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
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
    <div className={`rounded-2xl p-5 text-sm shadow-card ${map[tone]}`}>
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
