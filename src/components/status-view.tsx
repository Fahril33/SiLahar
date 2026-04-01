type StatusRow = {
  name: string;
  done: boolean;
  report: { activities: Array<unknown> } | null;
};

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-lagoon";

export function StatusView(props: {
  historyDate: string;
  setHistoryDate: (value: string) => void;
  statusRows: StatusRow[];
  loading: boolean;
}) {
  const { historyDate, setHistoryDate, statusRows, loading } = props;

  return (
    <section className="glass rounded-[28px] border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white/90 to-teal-50/70 p-5 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={`${inputClassName} max-w-xs`} />
        <p className="text-sm text-ink/60">{loading ? "Memuat data pengguna..." : `Menampilkan ${statusRows.length} nama yang pernah tercatat mengisi laporan.`}</p>
      </div>
      <div className="mt-4 grid gap-3">
        {statusRows.map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-[22px] border border-emerald-100 bg-white/92 px-4 py-4 shadow-sm">
            <div>
              <p className="font-semibold uppercase">{row.name}</p>
              <p className="text-sm text-ink/60">
                {historyDate}
                {row.report ? ` | ${row.report.activities.length} aktivitas` : ""}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${row.done ? "bg-lagoon/10 text-lagoon" : "bg-coral/10 text-coral"}`}>
              {row.done ? "Sudah isi" : "Belum isi"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
