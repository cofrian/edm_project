import { ReactNode } from "react";

export function Card({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && <h3 className="font-display text-xl font-semibold text-slate-950">{title}</h3>}
      {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
      <div className={title ? "mt-6" : ""}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const map: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-slate-900 text-white",
  };
  return <span className={`badge ${map[color]}`}>{children}</span>;
}
