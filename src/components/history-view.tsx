import { formatWitaDateTime } from "../lib/time";
import type { Report } from "../types/report";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-lagoon";

export function HistoryView(props: {
  loading: boolean;
  historyName: string;
  setHistoryName: (value: string) => void;
  historyDate: string;
  setHistoryDate: (value: string) => void;
  historyResults: Report[];
  onHandleLoadEdit: (report: Report) => Promise<void>;
  onHandleExport: (report: Report, format: "excel" | "word") => Promise<void>;
  today: string;
}) {
  const {
    loading,
    historyName,
    setHistoryName,
    historyDate,
    setHistoryDate,
    historyResults,
    onHandleLoadEdit,
    onHandleExport,
    today,
  } = props;

  return (
    <section className="space-y-4">
      <div className="glass rounded-[28px] border border-sky-100/80 bg-gradient-to-br from-sky-50/90 via-white/90 to-cyan-50/70 p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-3">
          <input value={historyName} onChange={(event) => setHistoryName(event.target.value.toUpperCase())} placeholder="FILTER NAMA" className={inputClassName} />
          <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={inputClassName} />
          <div className="rounded-2xl border border-sky-100 bg-white/80 p-4 text-sm text-ink/70">{loading ? "Memuat..." : `Menampilkan ${historyResults.length} laporan.`}</div>
        </div>
      </div>
      {historyResults.map((report) => (
        <article key={report.id} className="glass rounded-[24px] border border-amber-100/80 bg-gradient-to-br from-white/95 to-amber-50/60 p-5 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-bold">{report.nama}</h3>
              <p className="mt-1 text-sm text-ink/65">{report.tanggal} | {report.activities.length} aktivitas | diperbarui {formatWitaDateTime(report.updatedAt)}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink/80">{report.activities.slice(0, 3).map((activity) => <li key={`${report.id}-${activity.no}`}>{activity.no}. {activity.description} ({activity.startTime} - {activity.endTime} WITA)</li>)}</ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.reportDate === today ? <button type="button" onClick={() => void onHandleLoadEdit(report)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Edit</button> : null}
              <button type="button" onClick={() => void onHandleExport(report, "excel")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Download Excel</button>
              <button type="button" onClick={() => void onHandleExport(report, "word")} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Download Word</button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
