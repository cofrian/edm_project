"use client";

export type TabItem = { id: string; label: string; badge?: number };

export function Tabs({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              selected
                ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
