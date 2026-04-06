import { useEffect, useState } from "react";

type StatusRow = {
  name: string;
  done: boolean;
  report: { activities: Array<unknown> } | null;
};

const inputClassName = "field-input";

function ReloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-rotate-cw-icon lucide-rotate-cw"
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function StatusBadge({ done }: { done: boolean }) {
  const [statusLabel, setStatusLabel] = useState(done);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (done === statusLabel) {
      return;
    }

    setIsTransitioning(true);
    const timeoutId = window.setTimeout(() => {
      setStatusLabel(done);
      setIsTransitioning(false);
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [done, statusLabel]);

  return (
    <span
      className={`status-pill ${
        statusLabel ? "status-pill-success" : "status-pill-danger"
      } ${isTransitioning ? "status-pill-transitioning" : ""}`}
    >
      {isTransitioning ? <span className="status-pill-spinner" /> : null}
      <span>{statusLabel ? "Sudah isi" : "Belum isi"}</span>
    </span>
  );
}

export function StatusView(props: {
  historyDate: string;
  setHistoryDate: (value: string) => void;
  statusRows: StatusRow[];
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const { historyDate, setHistoryDate, statusRows, loading, onReload } = props;

  return (
    <section className="panel-glass rounded-[28px] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={`${inputClassName} max-w-xs`} />
          <button
            type="button"
            onClick={() => void onReload()}
            disabled={loading}
            className="btn-secondary h-[52px] w-[52px] shrink-0 p-0 disabled:opacity-60"
            aria-label="Muat ulang data status"
            title="Muat ulang data status"
          >
            {loading ? <SpinnerIcon /> : <ReloadIcon />}
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{loading ? "Memuat data pengguna..." : `Menampilkan ${statusRows.length} nama yang pernah tercatat mengisi laporan.`}</p>
      </div>
      <div className="mt-4 grid gap-3">
        {statusRows.map((row) => (
          <div key={row.name} className="surface-card flex items-center justify-between rounded-[22px] px-4 py-4">
            <div>
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {historyDate}
                {row.report ? ` | ${row.report.activities.length} aktivitas` : ""}
              </p>
            </div>
            <StatusBadge done={row.done} />
          </div>
        ))}
      </div>
    </section>
  );
}
