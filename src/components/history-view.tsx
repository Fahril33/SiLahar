import { formatWitaDateTime } from "../lib/time";
import type { Report } from "../types/report";
import { SearchFilterInput } from "./search-filter-input";

const inputClassName = "field-input";
const NEW_REPORT_WINDOW_MS = 5 * 60 * 1000;

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
  editLoadingReportId: string | null;
  today: string;
  canUseAnyReportDate: boolean;
  canManageReports: boolean;
  paperFormat: "a4" | "f4" | "legal" | "letter";
  setPaperFormat: (format: "a4" | "f4" | "legal" | "letter") => void;
  onReload: () => Promise<void>;
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
    editLoadingReportId,
    today,
    canUseAnyReportDate,
    canManageReports,
    paperFormat,
    setPaperFormat,
    onReload,
  } = props;

  return (
    <section className="space-y-4">
      <div className="panel-glass rounded-[28px] p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
          <SearchFilterInput
            value={historyName}
            onChange={setHistoryName}
            placeholder="FILTER NAMA"
          />
          <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={inputClassName} />
          <div className="flex items-center gap-3">
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
            <button
              type="button"
              onClick={() => void onReload()}
              disabled={loading}
              className="btn-secondary h-[52px] w-[52px] shrink-0 p-0 disabled:opacity-60"
              aria-label="Muat ulang data histori"
              title="Muat ulang data histori"
            >
              {loading ? <SpinnerIcon /> : <ReloadIcon />}
            </button>
          </div>
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
                  disabled={editLoadingReportId === report.id}
                  className="btn-secondary min-w-[88px] px-4 py-2 text-sm disabled:opacity-60"
                >
                  {editLoadingReportId === report.id ? <SpinnerIcon /> : "Edit"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onHandleExport(report)}
                disabled={excelExportingReportId === report.id}
                className="btn-secondary min-w-[132px] px-4 py-2 text-sm disabled:opacity-60"
              >
                {excelExportingReportId === report.id ? (
                  <SpinnerIcon />
                ) : (
                  "Download Excel"
                )}
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
