import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../hooks/use-media-query";
import { formatWitaDateTime } from "../lib/time";
import type { LocalReportDraftSummary } from "../types/local-draft";
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

function ChevronDownIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function DownloadIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PrintIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function PencilIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function EyeIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UploadIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M12 3v12" />
      <path d="m17 8-5-5-5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

function TrashIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function isRecentlyCreated(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() <= NEW_REPORT_WINDOW_MS;
}

function getLocalDraftStatusLabel(status: LocalReportDraftSummary["uploadStatus"]) {
  if (status === "queued") return "Antre upload";
  if (status === "uploading") return "Sedang upload";
  if (status === "uploaded") return "Sudah sinkron";
  if (status === "failed") return "Perlu dicek";
  return "Draft lokal";
}

export function HistoryView(props: {
  loading: boolean;
  localDraftsLoading: boolean;
  historyName: string;
  setHistoryName: (value: string) => void;
  historyDate: string;
  setHistoryDate: (value: string) => void;
  historyResults: Report[];
  historyLocalDrafts: LocalReportDraftSummary[];
  showDraftsInHistory: boolean;
  setShowDraftsInHistory: (value: boolean) => void;
  onHandleLoadEdit: (report: Report) => Promise<void>;
  onHandleLoadLocalDraft: (draftId: string) => Promise<void>;
  onHandleQueueLocalDraftUpload: (draftId: string) => Promise<void>;
  onHandleDeleteLocalDraft: (draftId: string) => Promise<void>;
  onHandleExport: (report: Report) => Promise<void>;
  onHandlePrint: (
    report: Report,
    format?: "a4" | "f4" | "legal" | "letter",
  ) => Promise<void>;
  onHandleUnsupportedMobilePrint: () => Promise<void>;
  onHandleDeleteReport: (report: Report) => Promise<void>;
  excelExportingReportId: string | null;
  editLoadingReportId: string | null;
  activeLocalDraftId: string | null;
  localDraftCount: number;
  today: string;
  canUseAnyReportDate: boolean;
  canManageReports: boolean;
  onReload: () => Promise<void>;
}) {
  const {
    loading,
    localDraftsLoading,
    historyName,
    setHistoryName,
    historyDate,
    setHistoryDate,
    historyResults,
    historyLocalDrafts,
    showDraftsInHistory,
    setShowDraftsInHistory,
    onHandleLoadEdit,
    onHandleLoadLocalDraft,
    onHandleQueueLocalDraftUpload,
    onHandleDeleteLocalDraft,
    onHandleExport,
    onHandlePrint,
    onHandleUnsupportedMobilePrint,
    onHandleDeleteReport,
    excelExportingReportId,
    editLoadingReportId,
    activeLocalDraftId,
    localDraftCount,
    today,
    canUseAnyReportDate,
    canManageReports,
    onReload,
  } = props;
  const printFormats: Array<"a4" | "f4" | "legal" | "letter"> = [
    "a4",
    "f4",
    "legal",
    "letter",
  ];
  const [openPrintMenuId, setOpenPrintMenuId] = useState<string | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileOrTablet = useMediaQuery("(max-width: 1023px)");

  useEffect(() => {
    if (!openPrintMenuId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!printMenuRef.current?.contains(event.target as Node)) {
        setOpenPrintMenuId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPrintMenuId(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPrintMenuId]);

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
            <button
              type="button"
              onClick={() => setShowDraftsInHistory(!showDraftsInHistory)}
              className={`h-[52px] rounded-2xl px-4 text-sm font-semibold transition ${
                showDraftsInHistory
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] text-[var(--text-primary)]"
              }`}
            >
              {showDraftsInHistory
                ? `Sembunyikan draft lokal (${localDraftCount})`
                : `Tampilkan draft lokal (${localDraftCount})`}
            </button>
          </div>
          <div className="surface-muted rounded-2xl px-2 text-sm text-[var(--text-muted)] flex items-center gap-2 ">
            <button 
              type="button"
              onClick={() => void onReload()}
              disabled={loading}
              className="h-[24px] w-[24px] shrink-0 p-0 disabled:opacity-60 flex items-center justify-center hover:bg-[var(--primary)] hover:text-white rounded-full"
              aria-label="Muat ulang data histori"
              title="Muat ulang data histori"
            >
              {loading ? <SpinnerIcon /> : <ReloadIcon />}
            </button>
            <p>{loading ? `Menampilkan ${historyResults.length} laporan${showDraftsInHistory ? ` dan ${historyLocalDrafts.length} draft lokal.` : "."}` : `Menampilkan ${historyResults.length} laporan${showDraftsInHistory ? ` dan ${historyLocalDrafts.length} draft lokal.` : "."}`}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">
            Draft lokal cocok dipakai saat koneksi kurang stabil atau saat ingin review dulu sebelum upload.
          </p>
        </div>
      </div>
      {showDraftsInHistory ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Draft Lokal</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {localDraftsLoading ? "Memuat draft..." : `${historyLocalDrafts.length} draft cocok dengan filter.`}
            </p>
          </div>
          {historyLocalDrafts.map((draft) => (
            <article key={draft.id} className="surface-card rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">{draft.title}</h3>
                    <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">
                      {getLocalDraftStatusLabel(draft.uploadStatus)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {draft.displayDate} | {draft.activityCount} aktivitas | {draft.pendingPhotoCount} foto lokal | diperbarui {formatWitaDateTime(draft.updatedAt)}
                  </p>
                  {draft.uploadError ? (
                    <p className="mt-2 text-sm text-[var(--danger)]">{draft.uploadError}</p>
                  ) : null}
                </div>
                <div className="flex flex-nowrap justify-end gap-2 overflow-x-auto overflow-y-visible lg:flex-wrap lg:overflow-visible">
                  <button
                    type="button"
                    onClick={() => void onHandleLoadLocalDraft(draft.id)}
                    disabled={activeLocalDraftId === draft.id}
                    className="btn-secondary shrink-0 px-3 py-2 text-sm disabled:opacity-60 sm:px-4"
                    aria-label={`Tinjau draft ${draft.title}`}
                  >
                    {activeLocalDraftId === draft.id ? <SpinnerIcon /> : <EyeIcon className="h-4 w-4" />}
                    <span className="hidden sm:inline">Tinjau draft</span>
                  </button>
                  {draft.uploadStatus !== "uploaded" ? (
                    <button
                      type="button"
                      onClick={() => void onHandleQueueLocalDraftUpload(draft.id)}
                      disabled={draft.uploadStatus === "queued" || draft.uploadStatus === "uploading"}
                      className="btn-secondary shrink-0 px-3 py-2 text-sm disabled:opacity-60 sm:px-4"
                      aria-label={`Upload background draft ${draft.title}`}
                    >
                      {draft.uploadStatus === "uploading" ? <SpinnerIcon /> : <UploadIcon className="h-4 w-4" />}
                      <span className="hidden sm:inline">Upload</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onHandleDeleteLocalDraft(draft.id)}
                    className="btn-danger shrink-0 px-3 py-2 text-sm sm:px-4"
                    aria-label={`Hapus draft ${draft.title}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Hapus draft</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
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
            <div className="flex flex-nowrap justify-end gap-2 overflow-x-auto overflow-y-visible lg:flex-wrap lg:overflow-visible">
              {report.reportDate === today || canUseAnyReportDate ? (
                <button
                  type="button"
                  onClick={() => void onHandleLoadEdit(report)}
                  disabled={editLoadingReportId === report.id}
                  className="btn-secondary shrink-0 px-3 py-2 text-sm disabled:opacity-60 sm:px-4"
                  aria-label={`Edit laporan ${report.nama}`}
                >
                  {editLoadingReportId === report.id ? <SpinnerIcon /> : <PencilIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">Edit</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onHandleExport(report)}
                disabled={excelExportingReportId === report.id}
                className="btn-secondary shrink-0 px-3 py-2 text-sm disabled:opacity-60 sm:px-4"
                aria-label={`Download Excel untuk ${report.nama}`}
              >
                {excelExportingReportId === report.id ? (
                  <SpinnerIcon />
                ) : (
                  <>
                    <DownloadIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </>
                )}
              </button>
              <div
                ref={openPrintMenuId === report.id ? printMenuRef : null}
                className="relative flex items-stretch"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenPrintMenuId(null);
                    if (isMobileOrTablet) {
                      void onHandleUnsupportedMobilePrint();
                      return;
                    }
                    void onHandlePrint(report, "a4");
                  }}
                  className={`btn-secondary shrink-0 px-3 py-2 text-sm sm:px-4 ${
                    isMobileOrTablet ? "" : "rounded-r-none"
                  } ${isMobileOrTablet ? "cursor-not-allowed opacity-60" : ""}`}
                  aria-label={`Print A4 untuk ${report.nama}`}
                  aria-disabled={isMobileOrTablet}
                >
                  <PrintIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">A4</span>
                </button>
                {!isMobileOrTablet ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenPrintMenuId((current) =>
                        current === report.id ? null : report.id,
                      )
                    }
                    className="btn-secondary ml-[2px] rounded-l-none px-2 py-2 text-sm"
                    aria-label={`Pilih ukuran kertas print untuk ${report.nama}`}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                ) : null}
                {!isMobileOrTablet && openPrintMenuId === report.id ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[156px] rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-panel)] p-2 shadow-2xl">
                    {printFormats.map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => {
                          setOpenPrintMenuId(null);
                          void onHandlePrint(report, format);
                        }}
                        className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm uppercase text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                      >
                        <span>{format}</span>
                        {format === "a4" ? (
                          <span className="text-xs text-[var(--text-muted)]">default</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {canManageReports ? (
                <button
                  type="button"
                  onClick={() => void onHandleDeleteReport(report)}
                  className="btn-danger shrink-0 px-3 py-2 text-sm sm:px-4"
                  aria-label={`Hapus laporan ${report.nama}`}
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
