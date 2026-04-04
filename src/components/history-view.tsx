import { formatWitaDateTime } from "../lib/time";
import type { Report } from "../types/report";
import { SearchFilterInput } from "./search-filter-input";

const inputClassName = "field-input";
const NEW_REPORT_WINDOW_MS = 5 * 60 * 1000;

function isRecentlyCreated(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() <= NEW_REPORT_WINDOW_MS;
}

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
  onHandleDeleteReport: (report: Report) => Promise<void>;
  excelExportingReportId: string | null;
  today: string;
  canUseAnyReportDate: boolean;
  canManageReports: boolean;
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
    onHandleDeleteReport,
    excelExportingReportId,
    today,
    canUseAnyReportDate,
    canManageReports,
    paperFormat,
    setPaperFormat,
  } = props;

  return (
    <section className="space-y-4">
      <div className="panel-glass rounded-[28px] p-5">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <SearchFilterInput
            value={historyName}
            onChange={setHistoryName}
            placeholder="FILTER NAMA"
          />
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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{report.nama}</h3>
                {isRecentlyCreated(report.createdAt) ? (
                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--info)]">
                    Baru ditambahkan
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{report.tanggal} | {report.activities.length} aktivitas | diperbarui {formatWitaDateTime(report.updatedAt)}</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-primary)]">{report.activities.slice(0, 3).map((activity) => <li key={`${report.id}-${activity.no}`}>{activity.no}. {activity.description} ({activity.startTime} - {activity.endTime} WITA)</li>)}</ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.reportDate === today || canUseAnyReportDate ? (
                <button
                  type="button"
                  onClick={() => void onHandleLoadEdit(report)}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onHandleExport(report)}
                disabled={excelExportingReportId === report.id}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                {excelExportingReportId === report.id
                  ? "Menyiapkan Excel..."
                  : "Download Excel"}
              </button>
              <button type="button" onClick={() => void onHandlePrint(report)} className="btn-secondary px-4 py-2 text-sm">Print</button>
              {canManageReports ? (
                <button
                  type="button"
                  onClick={() => void onHandleDeleteReport(report)}
                  className="btn-danger px-4 py-2 text-sm"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
