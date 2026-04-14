import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "../hooks/use-media-query";
import { formatWitaDateTime } from "../lib/time";
import type { ReportRules } from "../config/report-rules";
import type { LocalReportDraftSummary } from "../types/local-draft";
import type { DraftReport, Report } from "../types/report";
import { AnchoredInlineWarning } from "./anchored-inline-warning";
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

type PreviewSettingsSection = "header" | "content";

type ReportPreviewSettings = {
  headerFontSize: number;
  headerMarginBottom: number;
  contentFontFamily: string;
  contentFontSize: number;
  contentLineHeight: number;
  contentPaddingTop: number;
  contentPaddingRight: number;
  contentPaddingBottom: number;
  contentPaddingLeft: number;
};

type PreviewSettingConfig = {
  key: PreviewNumericSettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  section: PreviewSettingsSection;
};

type PreviewNumericSettingKey = Exclude<
  keyof ReportPreviewSettings,
  "contentFontFamily"
>;

const defaultReportPreviewSettings: ReportPreviewSettings = {
  headerFontSize: 11,
  headerMarginBottom: 25,
  contentFontFamily: "Calibri, Arial, Helvetica, sans-serif",
  contentFontSize: 10,
  contentLineHeight: 1.35,
  contentPaddingTop: 20,
  contentPaddingRight: 18,
  contentPaddingBottom: 20,
  contentPaddingLeft: 20,
};

const previewFontFamilyOptions = [
  {
    label: "Calibri",
    value: "Calibri, Arial, Helvetica, sans-serif",
  },
  {
    label: "Times New Roman",
    value: "\"Times New Roman\", Times, serif",
  },
  {
    label: "Arial",
    value: "Arial, Helvetica, sans-serif",
  },
  {
    label: "Helvetica",
    value: "Helvetica, Arial, sans-serif",
  },
  {
    label: "sans-serif",
    value: "sans-serif",
  },
] as const;

const previewSettingConfigs: PreviewSettingConfig[] = [
  {
    key: "headerFontSize",
    label: "Font size",
    min: 10,
    max: 18,
    step: 0.5,
    unit: "pt",
    section: "header",
  },
  {
    key: "headerMarginBottom",
    label: "Margin bawah",
    min: 8,
    max: 48,
    step: 1,
    unit: "px",
    section: "header",
  },
  {
    key: "contentFontSize",
    label: "Font size",
    min: 9,
    max: 14,
    step: 0.5,
    unit: "pt",
    section: "content",
  },
  {
    key: "contentLineHeight",
    label: "Line height",
    min: 1.1,
    max: 1.8,
    step: 0.05,
    unit: "",
    section: "content",
  },
  {
    key: "contentPaddingTop",
    label: "Padding atas",
    min: 8,
    max: 35,
    step: 1,
    unit: "mm",
    section: "content",
  },
  {
    key: "contentPaddingRight",
    label: "Padding kanan",
    min: 8,
    max: 35,
    step: 1,
    unit: "mm",
    section: "content",
  },
  {
    key: "contentPaddingBottom",
    label: "Padding bawah",
    min: 8,
    max: 35,
    step: 1,
    unit: "mm",
    section: "content",
  },
  {
    key: "contentPaddingLeft",
    label: "Padding kiri",
    min: 8,
    max: 35,
    step: 1,
    unit: "mm",
    section: "content",
  },
];

const previewSectionMeta: Record<
  PreviewSettingsSection,
  { title: string; selector: string }
> = {
  header: {
    title: "Report Header",
    selector: ".pdf-report-header",
  },
  content: {
    title: "Report Content",
    selector: ".pdf-report-page",
  },
};

const printFormats = ["a4", "f4", "legal", "letter"] as const;

function clampPreviewSetting(
  key: PreviewNumericSettingKey,
  value: number,
): number {
  const config = previewSettingConfigs.find((item) => item.key === key);

  if (!config || Number.isNaN(value)) {
    return defaultReportPreviewSettings[key];
  }

  return Math.min(config.max, Math.max(config.min, value));
}

function havePreviewSettingsChanged(
  left: ReportPreviewSettings,
  right: ReportPreviewSettings,
) {
  return (Object.keys(defaultReportPreviewSettings) as Array<
    keyof ReportPreviewSettings
  >).some(
    (key) => left[key] !== right[key],
  );
}

function getPreviewSectionDefaults(section: PreviewSettingsSection) {
  const defaults = previewSettingConfigs
    .filter((config) => config.section === section)
    .reduce(
      (accumulator, config) => {
        accumulator[config.key] = defaultReportPreviewSettings[config.key];
        return accumulator;
      },
      {} as Partial<ReportPreviewSettings>,
    );

  if (section === "content") {
    defaults.contentFontFamily = defaultReportPreviewSettings.contentFontFamily;
  }

  return defaults;
}

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
  localDraftCount: number;
  queuedLocalDraftCount: number;
  loadedLocalDraftSummary: LocalReportDraftSummary | null;
  showRenameOverwriteWarning: boolean;
  renameOverwriteWarningKey: string | null;
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
  onHandleUnsupportedMobilePrint: () => Promise<void>;
  onHandleResetDraft: () => Promise<void>;
  onSaveReport: () => Promise<void>;
  onSaveLocalDraft: (mode?: "update" | "new") => Promise<void>;
  onOpenSavedDrafts: () => void;
  onHandleRemoveSavedName: (name: string) => void;

  searchOpen: boolean;
  navbarPosition?: "top" | "left" | "right";
  navbarSlot?: ReactNode;
  isOnline: boolean;
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

function GearIcon(props: { className?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.43.3.93.47 1.46.47H21a2 2 0 1 1 0 4h-.14c-.53 0-1.03.17-1.46.53Z" />
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
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [paperMenuOpen, setPaperMenuOpen] = useState(false);
  const [previewSettingsOpen, setPreviewSettingsOpen] = useState(false);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [patchNotesContent, setPatchNotesContent] = useState("");
  const [renameOverwriteWarningDismissedKey, setRenameOverwriteWarningDismissedKey] =
    useState<string | null>(null);
  const [draftPreviewSettings, setDraftPreviewSettings] = useState(
    defaultReportPreviewSettings,
  );
  const [appliedPreviewSettings, setAppliedPreviewSettings] = useState(
    defaultReportPreviewSettings,
  );
  const saveMenuRef = useRef<HTMLDivElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const paperMenuRef = useRef<HTMLDivElement | null>(null);
  const previewSettingsRef = useRef<HTMLDivElement | null>(null);
  const patchNotesButtonRef = useRef<HTMLButtonElement | null>(null);
  const patchNotesRef = useRef<HTMLDivElement | null>(null);
  const isMobileOrTablet = useMediaQuery("(max-width: 1023px)");
  const paperPreview = useMemo(
    () => getPaperPreview(props.paperFormat),
    [props.paperFormat],
  );
  const hasPendingPreviewSettings = useMemo(
    () =>
      havePreviewSettingsChanged(draftPreviewSettings, appliedPreviewSettings),
    [appliedPreviewSettings, draftPreviewSettings],
  );
  const previewStyleTag = useMemo(
    () =>
      [
        pdfStyles,
        ".pdf-report-shell, .pdf-report-page { width: 100% !important; min-height: 100% !important; }",
        `.pdf-report-header { font-size: ${appliedPreviewSettings.headerFontSize}pt !important; margin-bottom: ${appliedPreviewSettings.headerMarginBottom}px !important; }`,
        `.pdf-report-page { padding: ${appliedPreviewSettings.contentPaddingTop}mm ${appliedPreviewSettings.contentPaddingRight}mm ${appliedPreviewSettings.contentPaddingBottom}mm ${appliedPreviewSettings.contentPaddingLeft}mm !important; font-family: ${appliedPreviewSettings.contentFontFamily} !important; font-size: ${appliedPreviewSettings.contentFontSize}pt !important; line-height: ${appliedPreviewSettings.contentLineHeight} !important; }`,
      ].join("\n"),
    [appliedPreviewSettings],
  );

  useEffect(() => {
    fetch("/docs/patch-notes.md")
      .then((res) => res.text())
      .then((text) => setPatchNotesContent(text))
      .catch(() => setPatchNotesContent("Gagal memuat catatan rilis."));
  }, []);

  useEffect(() => {
    if (!saveMenuOpen && !paperMenuOpen && !previewSettingsOpen && !patchNotesOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (saveMenuOpen && !saveMenuRef.current?.contains(target)) {
        setSaveMenuOpen(false);
      }
      if (paperMenuOpen && !paperMenuRef.current?.contains(target)) {
        setPaperMenuOpen(false);
      }
      if (
        previewSettingsOpen &&
        !previewSettingsRef.current?.contains(target)
      ) {
        setPreviewSettingsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSaveMenuOpen(false);
        setPaperMenuOpen(false);
        setPreviewSettingsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [paperMenuOpen, previewSettingsOpen, saveMenuOpen, patchNotesOpen]);

  useEffect(() => {
    setRenameOverwriteWarningDismissedKey(null);
  }, [props.renameOverwriteWarningKey]);

  useEffect(() => {
    if (!props.showRenameOverwriteWarning) {
      setRenameOverwriteWarningDismissedKey(null);
    }
  }, [props.showRenameOverwriteWarning]);

  const renameOverwriteCurrentKey = useMemo(() => {
    if (!props.showRenameOverwriteWarning) return null;
    return `${props.renameOverwriteWarningKey ?? ""}:${props.draft.nama.trim()}`;
  }, [props.draft.nama, props.renameOverwriteWarningKey, props.showRenameOverwriteWarning]);

  const hClass =
    props.navbarPosition === "top" || !props.navbarPosition
      ? "lg:h-[calc(100vh-8rem)]"
      : "lg:h-[calc(100vh-2.2rem)]";
  const previewSections = ["header", "content"] as const;

  function handleDraftPreviewSettingChange(
    key: PreviewNumericSettingKey,
    value: number,
  ) {
    setDraftPreviewSettings((current) => ({
      ...current,
      [key]: clampPreviewSetting(key, value),
    }));
  }

  function handleResetPreviewSection(section: PreviewSettingsSection) {
    setDraftPreviewSettings((current) => ({
      ...current,
      ...getPreviewSectionDefaults(section),
    }));
  }

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
                        {props.isEditLoading ? (
                          <SpinnerIcon className="h-4 w-4 animate-spin" />
                        ) : props.searchResultLoaded ? (
                          "Sudah dimuat"
                        ) : props.searchResultNeedsReload ? (
                          "Muat ulang data asli"
                        ) : (
                          "Buka untuk edit"
                        )}
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
                            Aktivitas pertama dimulai lewat dari pukul 09.00
                            WITA. Cek lagi apakah ada kegiatan pagi yang belum
                            tercatat.
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
                            Jam mulai aktivitas ini bertabrakan dengan jam
                            selesai aktivitas sebelumnya.
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
                                (props.pendingPreviews[activity.no]?.length ??
                                  0) > 0
                                  ? `${props.pendingPreviews[activity.no]?.length ?? 0} foto baru siap diunggah`
                                  : activity.photos.length > 0
                                    ? `${activity.photos.length} foto lama tetap terhubung`
                                    : undefined
                              }
                              disabled={props.isEditLoading}
                              inputKey={`${activity.no}-${activity.photos.length}-${props.pendingPreviews[activity.no]?.length ?? 0}`}
                              onChange={(files) =>
                                void props.onSetActivityFiles(
                                  activity.no,
                                  files,
                                )
                              }
                            />
                          </div>
                          <div className="flex w-12 shrink-0 flex-col gap-2 self-stretch sm:w-14">
                            <button
                              type="button"
                              onClick={() =>
                                props.onClearActivityFiles(activity.no)
                              }
                              disabled={
                                props.isEditLoading ||
                                (activity.photos.length === 0 &&
                                  (props.pendingPreviews[activity.no]?.length ??
                                    0) === 0)
                              }
                              className="flex flex-1 items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] text-[var(--text-muted)] transition hover:border-red-400 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-soft)] disabled:hover:bg-[var(--surface-panel-strong)] disabled:hover:text-[var(--text-muted)]"
                              aria-label={`Kosongkan foto aktivitas ke-${activity.no}`}
                            >
                              <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            {props.editableOriginalPhotos[activity.no]
                              ?.length ? (
                              <button
                                type="button"
                                onClick={() =>
                                  props.onRestoreActivityFiles(activity.no)
                                }
                                disabled={
                                  props.isEditLoading ||
                                  ((props.pendingPreviews[activity.no]
                                    ?.length ?? 0) === 0 &&
                                    activity.photos.length ===
                                      (props.editableOriginalPhotos[activity.no]
                                        ?.length ?? 0))
                                }
                                className="flex flex-1 items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] text-[var(--text-muted)] transition hover:border-emerald-400 hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-soft)] disabled:hover:bg-[var(--surface-panel-strong)] disabled:hover:text-[var(--text-muted)]"
                                aria-label={`Pulihkan foto asli aktivitas ke-${activity.no}`}
                              >
                                <RestoreIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {(props.pendingPreviews[activity.no]?.length ?? 0) >
                          0 || activity.photos.length > 0 ? (
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
                                  event.target.value,
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
                                  event.target.value,
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
            <div className="relative">
              <button
                ref={patchNotesButtonRef}
                type="button"
                onClick={() => setPatchNotesOpen(!patchNotesOpen)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                  patchNotesOpen
                    ? "bg-[var(--primary)] text-white shadow-lg"
                    : "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] border border-[var(--border-soft)] shadow-sm"
                }`}
                style={{ width: "38px", height: "38px" }}
                aria-label="Informasi pembaruan"
                title="Patch Notes"
              >
                <InfoIcon className="h-5 w-5" />
              </button>

              <AnimatePresence mode="wait">
                {patchNotesOpen && (
                  <motion.div
                    ref={patchNotesRef}
                    initial={{ opacity: 0, scale: 0.98, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 8 }}
                    transition={{ duration: 0.08, ease: "easeOut" }}
                    className="absolute bottom-full left-0 mb-4 z-[100] w-80 sm:w-[440px] overflow-hidden rounded-[32px] border border-[var(--border-soft)] shadow-[0_24px_54px_rgba(0,0,0,0.22)] backdrop-blur-3xl"
                    style={{
                      background: "color-mix(in srgb, var(--surface-panel-strong) 98%, var(--text-primary) 2%)",
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border-soft)]/60 px-6 py-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20">
                          <InfoIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[var(--text-primary)] leading-none">
                            Catatan Rilis
                          </h3>
                          <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                            Patch History & Updates
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPatchNotesOpen(false)}
                        className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-all active:scale-95"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="max-h-[55vh] overflow-y-auto px-6 py-2 text-sm leading-relaxed text-[var(--text-muted)] custom-scrollbar">
                      {patchNotesContent ? (
                        <div className="divide-y divide-[var(--border-soft)]/40">
                          {patchNotesContent
                            .split("\n\n##")
                            .map((section, sectionIndex) => {
                              const lines = (sectionIndex === 0 ? section : "##" + section)
                                .split("\n")
                                .filter((line) => line.trim() && !line.startsWith("# "));
                              
                              return (
                                <div key={sectionIndex} className="first:pt-4 last:pb-5">
                                  {lines.map((line, i) => {
                                    if (line.startsWith("## ")) {
                                      return (
                                        <div key={i} className="mb-4 flex items-center justify-between gap-3">
                                          <h4 className="text-base font-bold text-[var(--text-primary)]">
                                            {line.replace("## ", "")}
                                          </h4>
                                          {sectionIndex === 0 && (
                                            <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight text-[var(--primary)]">
                                              Terbaru
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }
                                    if (line.startsWith("### ")) {
                                      return (
                                        <h5
                                          key={i}
                                          className="mt-4 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] opacity-50"
                                        >
                                          {line.replace("### ", "")}
                                        </h5>
                                      );
                                    }
                                    if (line.startsWith("- ")) {
                                      return (
                                        <div key={i} className="mt-1.5 flex gap-3 text-[12.5px] leading-snug">
                                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)] opacity-30" />
                                          <span className="opacity-90">{line.replace("- ", "")}</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <p key={i} className="mt-2 text-[12.5px] opacity-70">
                                        {line}
                                      </p>
                                    );
                                  })}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="h-9 w-9 animate-spin rounded-full border-3 border-[var(--primary)] border-t-transparent" />
                          <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">
                            Memuat catatan rilis...
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="bg-[var(--surface-muted)]/30 border-t border-[var(--border-soft)]/50 px-6 py-1 w-full flex items-center justify-center">
                      <p className="text-[10.5px] font-medium leading-relaxed text-[var(--text-muted)] opacity-80 ">
                        Digunakan untuk melihat versi rilis.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
              Reset Form
            </button>
            {props.localDraftCount > 0 ? (
              <button
                type="button"
                onClick={props.onOpenSavedDrafts}
                className="btn-secondary text-sm"
              >
                Lihat draft ({props.localDraftCount})
              </button>
            ) : null}
            {props.queuedLocalDraftCount > 0 ? (
              <div className="rounded-full border border-[var(--info-soft)] bg-[var(--info-soft)] px-3 py-2 text-xs font-semibold text-[var(--info)]">
                {props.queuedLocalDraftCount} upload background aktif
              </div>
            ) : null}
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
                  className={`preview-title-pill ${eyebrowClassName} hidden truncate rounded-[10px] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] sm:block sm:text-sm lg:hidden xl:block 2xl:text-lg`}
                >
                  Preview Dokumen
                </p>
              </div>
              <div className="min-w-0 overflow-visible">
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap sm:gap-2">
                  <div
                    ref={previewSettingsRef}
                    className={`${isMobileOrTablet ? "hidden" : "relative"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewSettingsOpen((open) => !open)}
                      className={`btn-secondary px-2.5 py-2 text-xs sm:px-3 sm:text-sm 2xl:py-2.5 ${
                        previewSettingsOpen ? "bg-[var(--surface-muted)]" : ""
                      }`}
                      aria-label="Buka pengaturan preview dokumen"
                      title="Pengaturan preview"
                    >
                      <GearIcon className="h-4 w-4" />
                    </button>
                    {previewSettingsOpen ? (
                      <div
                        className="pointer-events-auto absolute right-auto top-[calc(100%+10px)] z-30 flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-[var(--border-soft)] shadow-2xl backdrop-blur-sm mt-2"
                        style={{
                          width: "min(96vw, 300px)",
                          maxWidth: "calc(100vw - 24px)",
                          maxHeight: "min(72vh, calc(100vh - 120px))",
                          background:
                            "color-mix(in srgb, var(--surface-panel-strong) 98%, black 2%)",
                        }}
                      >
                        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-4">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              Custom Settings
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftPreviewSettings(
                                defaultReportPreviewSettings,
                              )
                            }
                            className="text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                          >
                            Reset all
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                          <div className="space-y-4">
                            {previewSections.map((section) => (
                              <section
                                key={section}
                                className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-base)] p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                                      {previewSectionMeta[section].title}
                                    </p>
                                    <p className="text-[11px] text-[var(--text-muted)]">
                                      {previewSectionMeta[section].selector}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleResetPreviewSection(section)
                                    }
                                    className="text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                                  >
                                    Reset
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  {section === "content" ? (
                                    <label className="space-y-2 sm:col-span-2">
                                      <span className="text-xs font-medium text-[var(--text-muted)]">
                                        Font family
                                      </span>
                                      <select
                                        value={
                                          draftPreviewSettings.contentFontFamily
                                        }
                                        onChange={(event) =>
                                          setDraftPreviewSettings((current) => ({
                                            ...current,
                                            contentFontFamily:
                                              event.target.value,
                                          }))
                                        }
                                        className={`${inputClassName} w-full px-3 py-2 text-sm`}
                                      >
                                        {previewFontFamilyOptions.map(
                                          (fontFamily) => (
                                            <option
                                              key={fontFamily.label}
                                              value={fontFamily.value}
                                            >
                                              {fontFamily.label}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </label>
                                  ) : null}
                                  {previewSettingConfigs
                                    .filter(
                                      (config) => config.section === section,
                                    )
                                    .map((config) => (
                                      <label
                                        key={config.key}
                                        className="space-y-2"
                                      >
                                        <span className="text-xs font-medium text-[var(--text-muted)]">
                                          {config.label}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min={config.min}
                                            max={config.max}
                                            step={config.step}
                                            value={draftPreviewSettings[config.key]}
                                            onChange={(event) => {
                                              const nextValue =
                                                event.target.valueAsNumber;
                                              if (Number.isNaN(nextValue)) {
                                                return;
                                              }
                                              handleDraftPreviewSettingChange(
                                                config.key,
                                                nextValue,
                                              );
                                            }}
                                            className={`${inputClassName} min-w-0 px-3 py-2 text-sm`}
                                          />
                                          {config.unit ? (
                                            <span className="w-8 shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                                              {config.unit}
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)]">
                                          Min {config.min}
                                          {config.unit} - max {config.max}
                                          {config.unit}
                                        </p>
                                      </label>
                                    ))}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                        <div
                          className="shrink-0 sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--border-soft)] px-4 py-3"
                          style={{
                            background:
                              "color-mix(in srgb, var(--surface-panel-strong) 99%, black 1%)",
                          }}
                        >
                          <p className="text-xs text-[var(--text-muted)]">
                            {hasPendingPreviewSettings
                              ? "Ada perubahan yang belum diterapkan."
                              : "Preview sudah sesuai."}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setAppliedPreviewSettings(draftPreviewSettings)
                            }
                            disabled={!hasPendingPreviewSettings}
                            className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
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
                      <>
                        <DownloadIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Excel</span>
                      </>
                    )}
                  </button>
                    <div
                      ref={paperMenuRef}
                      className="relative flex items-stretch"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPaperMenuOpen(false);
                          if (isMobileOrTablet) {
                            void props.onHandleUnsupportedMobilePrint();
                            return;
                          }
                          void props.onHandlePrint(props.preview);
                        }}
                        className={`btn-secondary px-3 py-2 text-xs sm:px-4 sm:text-sm 2xl:py-2.5 ${
                          isMobileOrTablet ? "" : "rounded-r-none"
                        } ${
                          props.isEditLoading || isMobileOrTablet
                            ? "cursor-not-allowed opacity-60"
                            : ""
                        }`}
                        aria-label={`Print ${props.paperFormat.toUpperCase()} untuk preview laporan`}
                        aria-disabled={props.isEditLoading || isMobileOrTablet}
                      >
                        <PrintIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">
                          {props.paperFormat.toUpperCase()}
                        </span>
                      </button>
                      {!isMobileOrTablet ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPaperMenuOpen((open) => !open)
                          }
                          className="btn-secondary ml-[2px] rounded-l-none px-2 py-2 text-xs sm:px-3 sm:text-sm 2xl:py-2.5"
                          aria-label={`Pilih ukuran kertas, saat ini ${props.paperFormat.toUpperCase()}`}
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                      {!isMobileOrTablet && paperMenuOpen ? (
                        <div
                          className="pointer-events-auto absolute right-0 top-[calc(100%+8px)] z-30 min-w-[156px] rounded-[18px] border border-[var(--border-soft)] p-2 shadow-2xl backdrop-blur-sm"
                          style={{
                            background:
                              "color-mix(in srgb, var(--surface-panel-strong) 97%, black 3%)",
                          }}
                        >
                          {printFormats.map((format) => (
                            <button
                              key={format}
                              type="button"
                              onClick={() => {
                                props.setPaperFormat(format);
                                setPaperMenuOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm uppercase text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                            >
                              <span>{format}</span>
                              {props.paperFormat === format ? (
                                <CheckIcon className="h-4 w-4 text-[var(--success)]" />
                              ) : format === "a4" ? (
                                <span className="text-xs text-[var(--text-muted)]">
                                  default
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  <div ref={saveMenuRef} className="relative flex items-stretch">
                    <AnchoredInlineWarning
                      open={
                        props.showRenameOverwriteWarning &&
                        renameOverwriteWarningDismissedKey !==
                          renameOverwriteCurrentKey
                      }
                      anchorRef={saveButtonRef}
                      placement="left"
                      gap={12}
                      maxWidth={340}
                      instanceKey={props.renameOverwriteWarningKey}
                      onClose={() =>
                        setRenameOverwriteWarningDismissedKey(
                          renameOverwriteCurrentKey,
                        )
                      }
                      summary="Mengganti nama akan menimpa laporan ini."
                      details="Anda akan memperbarui laporan yang sudah ada ini, bukan menjadikannya format untuk laporan baru. Sangat disarankan untuk membuat draft tersendiri guna memudahkan Anda dalam menyusun laporan baru tanpa menghapus data lama. Mohon pastikan kembali bahwa tujuan Anda adalah memang untuk memperbarui laporan terkait."
                    />
                    <button
                      ref={saveButtonRef}
                      type="button"
                      onClick={() => {
                        setSaveMenuOpen(false);
                        void props.onSaveReport();
                      }}
                      disabled={props.submitting || props.isEditLoading}
                      className="btn-primary rounded-r-none px-3 py-2 text-xs sm:px-4 sm:text-sm 2xl:py-2.5"
                    >
                      {props.submitting ? (
                        <SpinnerIcon className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                      ) : (
                        <>
                          <SaveIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden whitespace-nowrap sm:inline">
                            Simpan
                          </span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveMenuOpen((open) => !open)}
                      disabled={props.submitting || props.isEditLoading}
                      className="btn-primary ml-[2px] rounded-l-none px-2 py-2 text-xs sm:px-3 sm:text-sm 2xl:py-2.5"
                      aria-label="Opsi simpan"
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 transition-transform ${saveMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {saveMenuOpen ? (
                      <div
                        className="pointer-events-auto absolute right-0 top-[calc(100%+8px)] z-30 min-w-[260px] rounded-[14px] border border-[var(--border-soft)] p-1 shadow-2xl backdrop-blur-sm"
                        style={{
                          background:
                            "color-mix(in srgb, var(--surface-panel-strong) 97%, black 3%)",
                        }}
                      >
                        {props.loadedLocalDraftSummary ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSaveMenuOpen(false);
                              void props.onSaveLocalDraft("update");
                            }}
                            className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                          >
                            <span>Perbarui draft</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              aktif
                            </span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setSaveMenuOpen(false);
                            void props.onSaveLocalDraft(
                              props.loadedLocalDraftSummary ? "new" : undefined,
                            );
                          }}
                          className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                        >
                          <span>
                            {props.loadedLocalDraftSummary
                              ? "Simpan sbg draft baru"
                              : "Simpan sebagai draft lokal"}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {props.localDraftCount} draft
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
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
                    __html: previewStyleTag,
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
function InfoIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
