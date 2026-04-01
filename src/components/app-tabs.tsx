import type { View } from "../hooks/use-report-dashboard";

export function AppTabs({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-3">
      {[
        ["entry", "Isi Laporan"],
        ["history", "Histori"],
        ["status", "Status Pengisian"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key as View)}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
            view === key ? "bg-lagoon text-white" : "glass border border-white/60 text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
