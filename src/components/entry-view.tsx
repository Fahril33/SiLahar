import { useMemo, useState, useRef, useEffect, ReactNode } from "react";
import { formatWitaDateTime } from "../lib/time";
import type { ReportRules } from "../config/report-rules";
import type { DraftReport, Report } from "../types/report";
import { AutocompleteInput } from "./autocomplete-input";
import { DeviceNameHistory } from "./device-name-history";
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
  duplicateToday: Report | null;
  nameCheckLoading: boolean;
  nameExistsInDirectory: boolean | null;
  reportRules: ReportRules;
  activityTimeIssues: Array<{
    startAfterMorning: boolean;
    endBeforeStart: boolean;
    startsBeforePreviousEnd: boolean;
    overtime: boolean;
  }>;
  pendingPreviews: PendingPreviewMap;
  preview: Report;
  submitting: boolean;
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
  onSetActivityFiles: (activityNo: number, files: FileList | null) => void;
  onHandleLoadEdit: (report: Report) => Promise<void>;

  onHandleExport: (report: Report) => Promise<void>;
  onHandlePrint: (report: Report) => Promise<void>;
  onHandleResetDraft: () => Promise<void>;
  onSaveReport: () => Promise<void>;
  onHandleRemoveSavedName: (name: string) => void;
  
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  
  navbarPosition?: "top" | "left" | "right";
  navbarSlot?: ReactNode;
};

function SaveIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className || "h-4 w-4"}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function PrintIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className || "h-4 w-4"}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
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
  const paperPreview = useMemo(
    () => getPaperPreview(props.paperFormat),
    [props.paperFormat],
  );
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        props.setSearchOpen(false);
      }
    }
    if (props.searchOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [props.searchOpen, props.setSearchOpen]);

  const hClass = props.navbarPosition === "top" || !props.navbarPosition 
    ? "xl:h-[calc(100vh-9.25rem)]" 
    : "xl:h-[calc(100vh-4rem)]";

  return (
    <section
      className={`grid gap-4 ${hClass} xl:grid-cols-[minmax(360px,1fr)_minmax(860px,58vw)]`}
    >
      <div className="panel-glass flex min-h-0 flex-col overflow-hidden rounded-[32px]">
        {props.navbarPosition === "left" && props.navbarSlot}
        {props.searchOpen ? (
          <div
            ref={searchContainerRef}
            className="border-b border-[var(--border-soft)] px-4 py-4 sm:px-5 bg-[var(--surface-base)]"
          >
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
                        disabled={!props.searchResultCanReload}
                        className="btn-secondary px-3 py-2 text-sm"
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
                {props.duplicateToday ? (
                  <div className="inline-note inline-note-warning md:col-span-2">
                    Sudah ada laporan atas nama ini untuk hari ini. Jika
                    disimpan, data sebelumnya akan diperbarui.
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
                      props.draft.nama.trim() && (props.nameCheckLoading || props.nameExistsInDirectory === true) ? (
                        <div tabIndex={0} className="group relative flex items-center justify-center focus:outline-none">
                          {props.nameCheckLoading ? (
                            <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--info)]" />
                          ) : (
                            <SmileIcon className="h-5 w-5 text-[var(--success)]" />
                          )}
                          <div className="pointer-events-none absolute bottom-full right-0 mb-3 w-max max-w-[220px] sm:max-w-xs whitespace-normal rounded-lg bg-[var(--surface-tooltip)] px-3 py-2 text-[0.8rem] leading-relaxed text-[var(--text-tooltip)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 z-10">
                            {props.nameCheckLoading
                              ? "Mengecek apakah nama ini sudah pernah tercatat di sistem."
                              : "Nama ini sudah pernah tercatat di sistem."}
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </div>
                <input
                  value={props.draft.tanggal}
                  disabled
                  className={`${inputClassName} md:col-span-2 cursor-not-allowed opacity-90`}
                />
              </div>
            </section>

            <section className="surface-card rounded-[15px] py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                <div>
                  <p className={eyebrowClassName}>Aktivitas Harian</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {props.draft.activities.map((activity, index) => (
                  <article
                    key={activity.no}
                    className="relative surface-muted p-4 sm:p-5 rounded-[24px]"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-xs text-white">
                          {activity.no}
                        </div>
                        Aktivitas ke-{activity.no}
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
                    <div className="mt-4 rounded-[22px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4">
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-[var(--text-muted)]">
                          Foto bukti dokumentasi (Maks.{" "}
                          {props.reportRules.maxPhotosPerActivity} foto per
                          aktivitas)
                        </label>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple={props.reportRules.maxPhotosPerActivity > 1}
                        onChange={(event) =>
                          props.onSetActivityFiles(
                            activity.no,
                            event.target.files,
                          )
                        }
                        className="mt-1 block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--surface-accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--text-primary)]"
                      />
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
                            .slice(0, 1)
                            .map((photo) => (
                              <img
                                key={photo.url}
                                src={photo.url}
                                alt={photo.name}
                                className="h-24 w-24 rounded-2xl object-cover ring-2 ring-[var(--primary)]/40"
                              />
                            ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--text-muted)]">
                          Belum ada foto bukti di aktivitas ini.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="surface-card rounded-[15px] p-4">
              <div className="space-y-1">
                <p className={eyebrowClassName}>Persetujuan</p>
                <h3 className="text-lg font-semibold">
                  Data pejabat penandatangan
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Lengkapi nama, jabatan, dan NIP agar area persetujuan tetap
                  rapi saat dicetak.
                </p>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-1">
                <div className="surface-muted rounded-[24px] p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--info-soft)] text-sm font-bold text-[var(--info)]">
                      KT
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Pihak 1
                      </p>
                      <h4 className="text-lg font-bold">Koordinator Tim</h4>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Nama pejabat</span>
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
                      <span className="text-sm font-medium">Nama pejabat</span>
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
            </section>
          </div>
        </div>

        <div className="sticky-fade mt-auto border-t border-[var(--border-soft)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="group relative flex items-center justify-center">
              {props.hasDraftContent ? (
                props.draftCacheStatus === "saving" ? (
                  <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--info)]" />
                ) : (
                  <CheckCircleIcon className="h-5 w-5 text-[var(--success)]" />
                )
              ) : (
                <XCircleIcon className="h-5 w-5 text-[var(--danger)] opacity-60" />
              )}
              <div className="pointer-events-none absolute bottom-full left-0 mb-3 w-max rounded-lg bg-[var(--surface-tooltip)] px-3 py-2 text-xs text-[var(--text-tooltip)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
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
              disabled={!props.hasDraftContent}
              className="btn-ghost ml-auto text-sm disabled:opacity-50"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={props.onAddActivity}
              className="btn-secondary text-sm"
            >
              Tambah baris
            </button>
          </div>
        </div>
      </div>

      <aside
        className={`panel-glass min-h-0 overflow-hidden rounded-[32px] xl:sticky xl:top-0 ${hClass}`}
      >
        <div className="relative flex h-full min-h-0 flex-col bg-[var(--preview-surface)]">
          <div className="absolute top-0 left-0 right-0 z-20 border-b border-[var(--border-soft)] bg-[var(--surface-panel)]/80 backdrop-blur-xl flex flex-col pointer-events-none">
            {props.navbarPosition === "right" && (
              <div className="pointer-events-auto">{props.navbarSlot}</div>
            )}
            <div className="pointer-events-auto px-4 py-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="w-full text-center md:w-auto md:text-left">
                <p
                  className={`${eyebrowClassName} md:self-center md:rounded-[10px] md:px-2 md:w-max text-lg font-semibold text-[var(--text-primary)] bg-[var(--field-bg)]`}
                >
                  Preview Dokumen
                </p>
              </div>
              <div className="flex flex-wrap w-full md:w-auto justify-center md:justify-end items-center gap-2">
                <div className="flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--field-bg)] px-1 py-1 mr-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewScale((s) =>
                        Math.max(0.4, Number((s - 0.1).toFixed(1))),
                      )
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    title="Perkecil"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-xs font-medium text-[var(--text-primary)]">
                    {Math.round(previewScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewScale((s) =>
                        Math.min(1.5, Number((s + 0.1).toFixed(1))),
                      )
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)]"
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
                  className="field-input w-full md:w-auto min-w-[170px] py-2.5 text-sm"
                >
                  <option value="a4">A4 (210 x 297 mm)</option>
                  <option value="f4">F4 (210 x 330 mm)</option>
                  <option value="legal">Legal (216 x 356 mm)</option>
                  <option value="letter">Letter (216 x 279 mm)</option>
                </select>
                <div className="flex w-full md:w-auto items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void props.onHandlePrint(props.preview)}
                    className="btn-secondary flex-1 md:flex-none px-4 py-2.5 text-sm"
                  >
                    <PrintIcon /> <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void props.onSaveReport()}
                    disabled={props.submitting}
                    className="btn-primary flex-1 md:flex-none px-4 py-2.5 text-sm"
                  >
                    <SaveIcon />{" "}
                    <span>
                      {props.submitting ? "Menyimpan..." : "Simpan laporan"}
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
