import { useMemo, useState, ReactNode } from "react";
import { formatWitaDateTime } from "../lib/time";
import type { ReportRules } from "../config/report-rules";
import type { DraftReport, Report } from "../types/report";
import { AutocompleteInput } from "./autocomplete-input";
import { DeviceNameHistory } from "./device-name-history";
import { FileUploadInput } from "./file-upload-input";
import { ReportPdfDocument } from "./report-pdf-document";
import pdfStyles from "../styles/report-pdf.css?inline";

const inputClassName = "field-input";
const textareaClassName = "field-textarea";
const eyebrowClassName =
  "text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]";

type PendingPreviewMap = Record<number, Array<{ name: string; url: string }>>;

type EntryViewProps = {
  draft: DraftReport;
  savedNames: string[];
  reporterNames: string[];
  searchName: string;
  setSearchName: (value: string) => void;
  searchDate: string;
  setSearchDate: (value: string) => void;
  searchResult: Report | null;
  searchResultLoaded: boolean;
  searchResultCanReload: boolean;
  searchResultNeedsReload: boolean;
  similarName: string | null;
  duplicateReport: Report | null;
  nameCheckLoading: boolean;
  nameExistsInDirectory: boolean | null;
  reportRules: ReportRules;
  canUseAnyReportDate: boolean;
  activityTimeIssues: Array<{
    startAfterMorning: boolean;
    endBeforeStart: boolean;
    startsBeforePreviousEnd: boolean;
    overtime: boolean;
  }>;
  activityCompletionStates: boolean[];
  pendingPreviews: PendingPreviewMap;
  preview: Report;
  submitting: boolean;
  isEditLoading: boolean;
  excelExportingReportId: string | null;
  hasDraftContent: boolean;
  draftSavedAt: string | null;
  draftCacheStatus: "idle" | "saving" | "saved";
  paperFormat: "a4" | "f4" | "legal" | "letter";
  setPaperFormat: (format: "a4" | "f4" | "legal" | "letter") => void;
  onChange: <K extends keyof DraftReport>(
    key: K,
    value: DraftReport[K],
  ) => void;
  onChangeActivity: (
    index: number,
    key: "description" | "startTime" | "endTime",
    value: string,
  ) => void;
  onAddActivity: () => void;
  onRemoveActivity: (index: number) => void;
  onSetActivityFiles: (
    activityNo: number,
    files: FileList | null,
  ) => Promise<void>;
  onClearActivityFiles: (activityNo: number) => void;
  onRestoreActivityFiles: (activityNo: number) => void;
  editableOriginalPhotos: Record<number, Array<{ id: string }>>;
  onHandleLoadEdit: (report: Report) => Promise<void>;

  onHandleExport: (report: Report) => Promise<void>;
  onHandlePrint: (report: Report) => Promise<void>;
  onHandleResetDraft: () => Promise<void>;
  onSaveReport: () => Promise<void>;
  onHandleRemoveSavedName: (name: string) => void;

  searchOpen: boolean;
  navbarPosition?: "top" | "left" | "right";
  navbarSlot?: ReactNode;
};

function SaveIcon(props: { className?: string }) {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
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

function SpinnerIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RestoreIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h2" />
      <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
      <path d="m9 15 3-3 3 3" />
      <path d="M12 12v9" />
    </svg>
  );
}

function CheckCircleIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function SmileIcon(props: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13.5a4 4 0 0 0 8 0" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function XCircleIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
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
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function PlusIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function getPaperPreview(paperFormat: "a4" | "f4" | "legal" | "letter") {
  return {
    width: paperFormat === "a4" || paperFormat === "f4" ? "210mm" : "216mm",
    minHeight:
      paperFormat === "f4"
        ? "330mm"
        : paperFormat === "legal"
          ? "356mm"
          : paperFormat === "letter"
            ? "279mm"
            : "297mm",
  };
}

export function EntryView(props: EntryViewProps) {
  const [previewScale, setPreviewScale] = useState(1);
  const [isApproverExpanded, setIsApproverExpanded] = useState(false);
  const paperPreview = useMemo(
    () => getPaperPreview(props.paperFormat),
    [props.paperFormat],
  );

  const hClass =
    props.navbarPosition === "top" || !props.navbarPosition
      ? "lg:h-[calc(100vh-9.25rem)]"
      : "lg:h-[calc(100vh-4rem)]";

  return (
    <section
      className={`grid gap-4 ${hClass} lg:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)] xl:grid-cols-[minmax(360px,1fr)_minmax(720px,58vw)]`}
    >
      <div className="panel-glass flex min-h-0 flex-col overflow-hidden rounded-[32px]">
        {props.navbarPosition === "left" && props.navbarSlot}
        {props.searchOpen ? (
          <div className="border-b border-[var(--border-soft)] px-4 py-4 sm:px-5 bg-[var(--surface-base)]">
            <div className="surface-muted rounded-[24px] p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <AutocompleteInput
                  value={props.searchName}
                  onChange={props.setSearchName}
                  options={props.reporterNames}
                  placeholder="Cari nama pelapor yang sudah pernah mengisi"
                  className={inputClassName}
                  emptyMessage="Belum ada nama di database yang cocok."
                />
                <input
                  type="date"
                  value={props.searchDate}
                  onChange={(event) => props.setSearchDate(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="mt-3">
                {props.searchResult ? (
                  <div className="inline-note inline-note-info">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {props.searchResultLoaded
                          ? `Laporan ${props.searchResult.nama} sudah aktif di form.`
                          : `Laporan ${props.searchResult.nama} ditemukan dan siap dibuka.`}
                      </span>
                        <button
                          type="button"
                          onClick={() =>
                            void props.onHandleLoadEdit(props.searchResult!)
                          }
                          disabled={
                            !props.searchResultCanReload || props.isEditLoading
                          }
                          className="btn-secondary px-3 py-2 text-sm disabled:opacity-60"
                        >
                        {props.searchResultLoaded
                          ? "Sudah dimuat"
                          : props.searchResultNeedsReload
                            ? "Muat ulang data asli"
                            : "Buka untuk edit"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline-note inline-note-warning">
                    Belum ada laporan yang cocok untuk nama dan tanggal
                    tersebut.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-4 pb-8">
            <section className="surface-card rounded-[15px] p-4">
              <DeviceNameHistory
                names={props.savedNames}
                onPick={(name) => props.onChange("nama", name)}
                onRemove={props.onHandleRemoveSavedName}
              />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {props.similarName ? (
                  <div className="inline-note inline-note-warning md:col-span-2">
                    Ada nama yang mirip: {props.similarName}. Pastikan
                    penulisannya sudah benar.
                  </div>
                ) : null}
                {props.duplicateReport ? (
                  <div className="inline-note inline-note-warning md:col-span-2">
                    Sudah ada laporan atas nama ini untuk tanggal yang dipilih.
                    Jika disimpan, data sebelumnya akan diperbarui.
                  </div>
                ) : null}
                <div className="md:col-span-2">
                  <AutocompleteInput
                    value={props.draft.nama}
                    onChange={(value) => props.onChange("nama", value)}
                    options={props.reporterNames}
                    placeholder="Nama Anda"
                    className={inputClassName}
                    emptyMessage="Nama belum ada di database, tetapi laporan tetap bisa dilanjutkan."
                    endAdornment={
                      props.draft.nama.trim() &&
                      (props.nameCheckLoading ||
                        props.nameExistsInDirectory === true) ? (
                        <div
                          tabIndex={0}
                          className="ui-tooltip-group focus:outline-none"
                        >
                          {props.nameCheckLoading ? (
                            <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--info)]" />
                          ) : (
                            <SmileIcon className="h-5 w-5 text-[var(--success)]" />
                          )}
                          <div className="ui-tooltip ui-tooltip-right">
                            {props.nameCheckLoading
                              ? "Mengecek apakah nama ini sudah pernah tercatat di sistem."
                              : "Nama ini sudah pernah tercatat di sistem."}
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </div>
                {props.canUseAnyReportDate ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tanggal laporan</span>
                    <input
                      type="date"
                      value={props.draft.reportDate}
                      onChange={(event) =>
                        props.onChange("reportDate", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </label>
                ) : null}
                <label
                  className={`space-y-2 ${props.canUseAnyReportDate ? "" : "md:col-span-2"}`}
                >
                  <span className="text-sm font-medium">
                    Hari / Tanggal dokumen
                  </span>
                  <input
                    value={props.draft.tanggal}
                    disabled
                    className={`${inputClassName} cursor-not-allowed opacity-90`}
                  />
                </label>
                {!props.canUseAnyReportDate ? (
                  <div className="inline-note inline-note-info md:col-span-2">
                    Admin saat ini membatasi pengisian laporan hanya untuk hari
                    berjalan.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="surface-card rounded-[15px] overflow-hidden">
              <div className="p-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                <div>
                  <p className={eyebrowClassName}>Aktivitas Harian</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {props.draft.activities.map((activity, index) => (
                  <article
                    key={activity.no}
                    className={`relative surface-muted p-4 sm:p-5 rounded-[24px] ${props.activityCompletionStates[index] ? "border-2 border-green-400" : ""}`}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs text-white transition-colors ${
                            props.activityCompletionStates[index]
                              ? "bg-green-400"
                              : "bg-[var(--primary)]" 
                          }`} 
                        >
                          {activity.no}
                        </div>
                        Aktivitas ke-{activity.no}
                        {props.activityCompletionStates[index] ? (
                          <span className="ml-2 text-xs font-semibold text-green-400">
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        ) : null}
                      </h4>
                      {props.draft.activities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => props.onRemoveActivity(index)}
                          className="flex items-center gap-1.5 rounded-full bg-[var(--danger-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Hapus baris
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">
                          Jam mulai
                        </span>
                        <input
                          type="time"
                          value={activity.startTime}
                          onChange={(event) =>
                            props.onChangeActivity(
                              index,
                              "startTime",
                              event.target.value,
                            )
                          }
                          className={`${inputClassName} py-2.5 text-sm`}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">
                          Jam selesai
                        </span>
                        <input
                          type="time"
                          value={activity.endTime}
                          onChange={(event) =>
                            props.onChangeActivity(
                              index,
                              "endTime",
                              event.target.value,
                            )
                          }
                          className={`${inputClassName} py-2.5 text-sm`}
                        />
                      </label>
                    </div>

                    <label className="mt-4 block space-y-1.5">
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        Detail aktivitas
                      </span>
                      <textarea
                        rows={3}
                        value={activity.description}
                        onChange={(event) =>
                          props.onChangeActivity(
                            index,
                            "description",
                            event.target.value,
                          )
                        }
                        className={`${textareaClassName} break-words`}
                        placeholder="Tulis ringkasan pekerjaan atau kegiatan yang dilakukan"
                      />
                    </label>
                    <div className="mt-3 space-y-2">
                      {props.activityTimeIssues[index]?.startAfterMorning ? (
                        <div className="inline-note inline-note-warning">
                          Aktivitas pertama dimulai lewat dari pukul 09.00 WITA.
                          Cek lagi apakah ada kegiatan pagi yang belum tercatat.
                        </div>
                      ) : null}
                      {props.activityTimeIssues[index]?.endBeforeStart ? (
                        <div className="inline-note inline-note-danger">
                          Jam selesai tidak boleh lebih awal dari jam mulai.
                        </div>
                      ) : null}
                      {props.activityTimeIssues[index]
                        ?.startsBeforePreviousEnd ? (
                        <div className="inline-note inline-note-danger">
                          Jam mulai aktivitas ini bertabrakan dengan jam selesai
                          aktivitas sebelumnya.
                        </div>
                      ) : null}
                      {props.activityTimeIssues[index]?.overtime ? (
                        <div className="inline-note inline-note-success">
                          Sepertinya anda lembur hari ini.
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-stretch gap-2">
                        <div className="min-w-0 flex-1">
                          <FileUploadInput
                            label={`Foto bukti dokumentasi (Maks. ${props.reportRules.maxPhotosPerActivity} foto per aktivitas)`}
                            accept="image/png,image/jpeg,image/webp"
                            multiple={
                              Math.max(
                                0,
                                props.reportRules.maxPhotosPerActivity -
                                  activity.photos.length,
                              ) > 1
                            }
                            helperText="Belum ada foto bukti di aktivitas ini."
                            selectedFileName={
                              (props.pendingPreviews[activity.no]?.length ?? 0) > 0
                                ? `${props.pendingPreviews[activity.no]?.length ?? 0} foto baru siap diunggah`
                                : activity.photos.length > 0
                                  ? `${activity.photos.length} foto lama tetap terhubung`
                                  : undefined
                            }
                            disabled={props.isEditLoading}
                            inputKey={`${activity.no}-${activity.photos.length}-${props.pendingPreviews[activity.no]?.length ?? 0}`}
                            onChange={(files) =>
                              void props.onSetActivityFiles(activity.no, files)
                            }
                          />
                        </div>
                        <div className="flex w-12 shrink-0 flex-col gap-2 self-stretch sm:w-14">
                          <button
                            type="button"
                            onClick={() => props.onClearActivityFiles(activity.no)}
                            disabled={
                              props.isEditLoading ||
                              activity.photos.length === 0 &&
                              (props.pendingPreviews[activity.no]?.length ?? 0) === 0
                            }
                            className="flex flex-1 items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] text-[var(--text-muted)] transition hover:border-red-400 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-soft)] disabled:hover:bg-[var(--surface-panel-strong)] disabled:hover:text-[var(--text-muted)]"
                            aria-label={`Kosongkan foto aktivitas ke-${activity.no}`}
                          >
                            <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                          {props.editableOriginalPhotos[activity.no]?.length ? (
                            <button
                              type="button"
                              onClick={() =>
                                props.onRestoreActivityFiles(activity.no)
                              }
                              disabled={
                                props.isEditLoading ||
                                (props.pendingPreviews[activity.no]?.length ?? 0) ===
                                  0 &&
                                activity.photos.length ===
                                  (props.editableOriginalPhotos[activity.no]?.length ??
                                    0)
                              }
                              className="flex flex-1 items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] text-[var(--text-muted)] transition hover:border-emerald-400 hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-soft)] disabled:hover:bg-[var(--surface-panel-strong)] disabled:hover:text-[var(--text-muted)]"
                              aria-label={`Pulihkan foto asli aktivitas ke-${activity.no}`}
                            >
                              <RestoreIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {(props.pendingPreviews[activity.no]?.length ?? 0) > 0 ||
                      activity.photos.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {activity.photos.slice(0, 1).map((photo) => (
                            <img
                              key={photo.id}
                              src={photo.publicUrl}
                              alt={photo.originalFileName}
                              className="h-24 w-24 rounded-2xl object-cover"
                            />
                          ))}
                          {(props.pendingPreviews[activity.no] ?? [])
                            .slice(
                              0,
                              Math.max(
                                1,
                                props.reportRules.maxPhotosPerActivity,
                              ),
                            )
                            .map((photo) => (
                              <img
                                key={photo.url}
                                src={photo.url}
                                alt={photo.name}
                                className="h-24 w-24 rounded-2xl object-cover ring-2 ring-[var(--primary)]/40"
                              />
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--border-soft)]">
                <button
                  type="button"
                  onClick={props.onAddActivity}
                  disabled={props.isEditLoading}
                  className="flex w-full items-center justify-center gap-2 bg-[var(--surface-accent)]/10 px-4 py-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-accent)]/20 active:bg-[var(--surface-accent)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  Tambah baris aktivitas
                </button>
              </div>
            </section>

            <section className="surface-card rounded-[15px] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsApproverExpanded(!isApproverExpanded)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--surface-accent)]/10"
              >
                <div className="space-y-1">
                  <p className={eyebrowClassName}>Persetujuan</p>
                  <h3 className="text-lg font-semibold">
                    Data pejabat penandatangan
                  </h3>
                </div>
                <ChevronDownIcon
                  className={`h-5 w-5 text-[var(--text-muted)] transition-transform duration-300 ${
                    isApproverExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isApproverExpanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="p-4 pt-0">
                    <p className="mb-4 text-sm text-[var(--text-muted)]">
                      Lengkapi nama, jabatan, dan NIP agar area persetujuan
                      tetap rapi saat dicetak.
                    </p>
                    <div className="grid gap-3 xl:grid-cols-1">
                      <div className="surface-muted rounded-[24px] p-4">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--info-soft)] text-sm font-bold text-[var(--info)]">
                            KT
                          </div>
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                              Pihak 1
                            </p>
                            <h4 className="text-lg font-bold">
                              Koordinator Tim
                            </h4>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <label className="space-y-2">
                            <span className="text-sm font-medium">
                              Nama pejabat
                            </span>
                            <input
                              value={props.draft.approverCoordinator}
                              onChange={(event) =>
                                props.onChange(
                                  "approverCoordinator",
                                  event.target.value.toUpperCase(),
                                )
                              }
                              placeholder="Nama koordinator tim"
                              className={inputClassName}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">NIP</span>
                            <input
                              value={props.draft.approverCoordinatorNip}
                              onChange={(event) =>
                                props.onChange(
                                  "approverCoordinatorNip",
                                  event.target.value,
                                )
                              }
                              placeholder="Nomor induk pegawai"
                              className={inputClassName}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="surface-muted rounded-[24px] p-4">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--warning-soft)] text-sm font-bold text-[var(--warning)]">
                            KB
                          </div>
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                              Pihak 2
                            </p>
                            <h4 className="text-lg font-bold">Kepala Bidang</h4>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <label className="space-y-2">
                            <span className="text-sm font-medium">
                              Nama pejabat
                            </span>
                            <input
                              value={props.draft.approverDivisionHead}
                              onChange={(event) =>
                                props.onChange(
                                  "approverDivisionHead",
                                  event.target.value.toUpperCase(),
                                )
                              }
                              placeholder="Nama kepala bidang"
                              className={inputClassName}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">Jabatan</span>
                            <input
                              value={props.draft.approverDivisionHeadTitle}
                              onChange={(event) =>
                                props.onChange(
                                  "approverDivisionHeadTitle",
                                  event.target.value.toUpperCase(),
                                )
                              }
                              placeholder="Jabatan atau pangkat"
                              className={inputClassName}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">NIP</span>
                            <input
                              value={props.draft.approverDivisionHeadNip}
                              onChange={(event) =>
                                props.onChange(
                                  "approverDivisionHeadNip",
                                  event.target.value,
                                )
                              }
                              placeholder="Nomor induk pegawai"
                              className={inputClassName}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="sticky-fade mt-auto border-t border-[var(--border-soft)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="ui-tooltip-group">
              {props.hasDraftContent ? (
                props.draftCacheStatus === "saving" ? (
                  <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--info)]" />
                ) : (
                  <CheckCircleIcon className="h-5 w-5 text-[var(--success)]" />
                )
              ) : (
                <XCircleIcon className="h-5 w-5 text-[var(--danger)] opacity-60" />
              )}
              <div className="ui-tooltip ui-tooltip-left">
                {props.hasDraftContent
                  ? props.draftSavedAt
                    ? `Draft tersimpan lokal - ${formatWitaDateTime(props.draftSavedAt)}`
                    : "Menyiapkan draft..."
                  : "Belum ada form yang disi yang dapat difaucet."}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void props.onHandleResetDraft()}
              disabled={!props.hasDraftContent || props.isEditLoading}
              className="btn-ghost ml-auto text-sm disabled:opacity-50"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={props.onAddActivity}
              disabled={props.isEditLoading}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Tambah baris
            </button>
          </div>
        </div>
      </div>

      <aside
        className={`panel-glass min-h-0 overflow-hidden rounded-[32px] lg:sticky lg:top-0 ${hClass}`}
      >
        <div className="relative flex h-full min-h-0 flex-col bg-[var(--preview-surface)]">
          <div className="absolute top-0 left-0 right-0 z-20 border-b border-[var(--border-soft)] bg-[var(--surface-panel)]/80 backdrop-blur-xl flex flex-col pointer-events-none">
            {props.navbarPosition === "right" && (
              <div className="pointer-events-auto">{props.navbarSlot}</div>
            )}
            <div className="pointer-events-auto flex flex-row items-center justify-between gap-2 px-3 py-3 sm:px-4 2xl:gap-3 2xl:px-5 2xl:py-4">
              <div className="min-w-0 shrink">
                <p
                  className={`preview-title-pill ${eyebrowClassName} block truncate rounded-[10px] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] sm:text-sm lg:hidden xl:block 2xl:text-lg`}
                >
                  Preview Dokumen
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                <div className="mr-1 flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--field-bg)] px-1 py-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewScale((s) =>
                        Math.max(0.4, Number((s - 0.1).toFixed(1))),
                      )
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)] 2xl:h-7 2xl:w-7"
                    title="Perkecil"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-[10px] font-medium text-[var(--text-primary)] sm:w-12 sm:text-xs">
                    {Math.round(previewScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewScale((s) =>
                        Math.min(1.5, Number((s + 0.1).toFixed(1))),
                      )
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)] 2xl:h-7 2xl:w-7"
                    title="Perbesar"
                  >
                    +
                  </button>
                </div>
                <select
                  value={props.paperFormat}
                  onChange={(event) =>
                    props.setPaperFormat(
                      event.target.value as "a4" | "f4" | "legal" | "letter",
                    )
                  }
                  className="field-input w-[80px] px-3 py-2 text-xs sm:text-sm 2xl:py-2.5"
                >
                  <option value="a4">A4</option>
                  <option value="f4">F4</option>
                  <option value="legal">Legal</option>
                  <option value="letter">Letter</option>
                </select>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => void props.onHandleExport(props.preview)}
                    disabled={
                      props.excelExportingReportId === props.preview.id ||
                      props.isEditLoading
                    }
                    className="btn-secondary px-3 py-2 text-xs disabled:opacity-60 sm:px-4 sm:text-sm 2xl:py-2.5"
                  >
                    {props.excelExportingReportId === props.preview.id ? (
                      <SpinnerIcon className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                    ) : (
                      <DownloadIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {props.excelExportingReportId === props.preview.id
                        ? "Excel..."
                        : "Excel"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void props.onHandlePrint(props.preview)}
                    disabled={props.isEditLoading}
                    className="btn-secondary px-3 py-2 text-xs disabled:opacity-60 sm:px-4 sm:text-sm 2xl:py-2.5"
                  >
                    <PrintIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void props.onSaveReport()}
                    disabled={props.submitting || props.isEditLoading}
                    className="btn-primary px-3 py-2 text-xs sm:px-4 sm:text-sm 2xl:py-2.5"
                  >
                    <SaveIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
                    <span className="whitespace-nowrap lg:hidden xl:inline">
                      {props.submitting ? "Menyimpan..." : "Simpan"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5 pt-[8.5rem] md:pt-[5.5rem]">
            <div
              className="mx-auto w-fit transition-transform duration-200 origin-top"
              style={{ transform: `scale(${previewScale})` }}
            >
              <div
                className="mx-auto isolate overflow-hidden rounded-[28px] border border-[var(--border-soft)]"
                style={{
                  width: paperPreview.width,
                  minHeight: paperPreview.minHeight,
                  backgroundColor: "white",
                  boxShadow: "0 16px 40px rgba(15, 23, 38, 0.18)",
                }}
              >
                <style
                  dangerouslySetInnerHTML={{
                    __html:
                      pdfStyles +
                      `\n.pdf-report-shell, .pdf-report-page { width: 100% !important; min-height: 100% !important; }`,
                  }}
                />
                <ReportPdfDocument report={props.preview} />
              </div>
              <p className="mt-4 text-center text-sm font-medium text-[var(--text-muted)]">
                Terakhir diperbarui:{" "}
                {formatWitaDateTime(props.preview.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
