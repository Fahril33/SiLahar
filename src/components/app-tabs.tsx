import type { View } from "../hooks/use-report-dashboard";

export function AppTabs({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-1">
      {[
        ["entry", "Laporan"],
        ["history", "Histori"],
        ["status", "Status"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key as View)}
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            view === key
              ? "bg-[var(--primary)] text-[var(--primary-contrast)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
