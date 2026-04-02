import { formatWitaDateTime } from "../lib/time";
import type { Report } from "../types/report";

const inputClassName = "field-input";

export function HistoryView(props: {
  loading: boolean;
  historyName: string;
  setHistoryName: (value: string) => void;
  historyDate: string;
  setHistoryDate: (value: string) => void;
  historyResults: Report[];
  onHandleLoadEdit: (report: Report) => Promise<void>;
  onHandleExport: (report: Report) => Promise<void>;
  onHandlePrint: (report: Report) => Promise<void>;
  today: string;
  paperFormat: "a4" | "f4" | "legal" | "letter";
  setPaperFormat: (format: "a4" | "f4" | "legal" | "letter") => void;
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
    onHandlePrint,
    today,
    paperFormat,
    setPaperFormat,
  } = props;

  return (
    <section className="space-y-4">
      <div className="panel-glass rounded-[28px] p-5">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <input value={historyName} onChange={(event) => setHistoryName(event.target.value.toUpperCase())} placeholder="FILTER NAMA" className={inputClassName} />
          <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={inputClassName} />
          <select
            value={paperFormat}
            onChange={(e) => setPaperFormat(e.target.value as "a4" | "f4" | "legal" | "letter")}
            className={inputClassName}
          >
            <option value="a4">PDF: A4</option>
            <option value="f4">PDF: F4</option>
            <option value="legal">PDF: Legal</option>
            <option value="letter">PDF: Letter</option>
          </select>
          <div className="surface-muted rounded-2xl p-4 text-sm text-[var(--text-muted)]">{loading ? "Memuat..." : `Menampilkan ${historyResults.length} laporan.`}</div>
        </div>
      </div>
      {historyResults.map((report) => (
        <article key={report.id} className="surface-card rounded-[24px] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-bold">{report.nama}</h3>
              <p className="mt-1 text-sm text-ink/65">{report.tanggal} | {report.activities.length} aktivitas | diperbarui {formatWitaDateTime(report.updatedAt)}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink/80">{report.activities.slice(0, 3).map((activity) => <li key={`${report.id}-${activity.no}`}>{activity.no}. {activity.description} ({activity.startTime} - {activity.endTime} WITA)</li>)}</ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.reportDate === today ? <button type="button" onClick={() => void onHandleLoadEdit(report)} className="btn-secondary px-4 py-2 text-sm">Edit</button> : null}
              <button type="button" onClick={() => void onHandleExport(report)} className="btn-secondary hidden px-4 py-2 text-sm">Download PDF</button>
              <button type="button" onClick={() => void onHandlePrint(report)} className="btn-secondary px-4 py-2 text-sm">Print</button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
