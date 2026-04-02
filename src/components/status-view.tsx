type StatusRow = {
  name: string;
  done: boolean;
  report: { activities: Array<unknown> } | null;
};

const inputClassName = "field-input";

export function StatusView(props: {
  historyDate: string;
  setHistoryDate: (value: string) => void;
  statusRows: StatusRow[];
  loading: boolean;
}) {
  const { historyDate, setHistoryDate, statusRows, loading } = props;

  return (
    <section className="panel-glass rounded-[28px] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={`${inputClassName} max-w-xs`} />
        <p className="text-sm text-[var(--text-muted)]">{loading ? "Memuat data pengguna..." : `Menampilkan ${statusRows.length} nama yang pernah tercatat mengisi laporan.`}</p>
      </div>
      <div className="mt-4 grid gap-3">
        {statusRows.map((row) => (
          <div key={row.name} className="surface-card flex items-center justify-between rounded-[22px] px-4 py-4">
            <div>
              <p className="font-semibold uppercase">{row.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {historyDate}
                {row.report ? ` | ${row.report.activities.length} aktivitas` : ""}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${row.done ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"}`}>
              {row.done ? "Sudah isi" : "Belum isi"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
