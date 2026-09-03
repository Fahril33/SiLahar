import { useEffect, useRef, useState, useMemo } from "react";
import { useMediaQuery } from "../hooks/use-media-query";
import { formatWitaDateTime, formatWitaDate } from "../lib/time";
import type {
  Report,
  ReporterDirectoryProfile,
  ReportActivity,
} from "../types/report";
import type { AdminSessionState } from "../types/admin";
import type { LocalReportDraftSummary } from "../types/local-draft";
import { isSameReporterName } from "../lib/reporter-name";
import { LocalDraftsModal } from "./local-drafts-modal";
import {
  getHolidayInfo,
  getEffectiveWorkingDaysInRange,
  isWorkDay,
} from "../lib/holidays";
import {
  resolveEffectiveSystemStartDate,
  getSystemStartDateLabel,
} from "../lib/system-date";

function FileTextIcon(props: { className?: string }) {
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
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

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

function SearchIcon(props: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CalendarIcon(props: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-3.5 w-3.5"}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronLeftIcon(props: { className?: string }) {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon(props: { className?: string }) {
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
      <polyline points="9 18 15 12 9 6" />
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

function FileDownIcon(props: { className?: string }) {
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
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
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

export function HistoryView(props: {
  loading: boolean;
  historyDate: string;
  setHistoryDate: (value: string) => void;
  historyResults: Report[];
  reports: Report[];
  userSession?: ReporterDirectoryProfile | null;
  adminSession?: AdminSessionState | null;
  onHandleLoadEdit: (report: Report) => Promise<void>;
  onHandleExport: (report: Report) => Promise<void>;
  onHandlePrint: (
    report: Report,
    format?: "a4" | "f4" | "legal" | "letter",
  ) => Promise<void>;
  onHandleSaveAsPdf: (report: Report) => Promise<void>;
  onHandleUnsupportedMobilePrint: () => Promise<void>;
  excelExportingReportId: string | null;
  pdfExportingReportId: string | null;
  editLoadingReportId: string | null;
  today: string;
  canUseAnyReportDate: boolean;
  onReload: () => Promise<void>;
  statusRows: Array<{
    name: string;
    done: boolean;
    report: Report | null;
  }>;
  savedLocalDrafts?: LocalReportDraftSummary[];
  activeLocalDraftId?: string | null;
  onHandleLoadLocalDraft?: (draftId: string) => Promise<void>;
  onHandleDeleteLocalDraft?: (draftId: string) => Promise<void>;
  onHandleQueueLocalDraftUpload?: (draftId: string) => Promise<void>;
  onOpenSavedDrafts?: () => void;
  onStartNewReportForDate?: (date: string) => void;
  systemStartDate: string;
}) {
  const {
    loading,
    historyDate,
    setHistoryDate,
    onHandleLoadEdit,
    onHandleExport,
    onHandlePrint,
    onHandleSaveAsPdf,
    onHandleUnsupportedMobilePrint,
    excelExportingReportId,
    pdfExportingReportId,
    editLoadingReportId,
    today,
    canUseAnyReportDate,
    onReload,
    statusRows,
    savedLocalDrafts = [],
    activeLocalDraftId,
    onHandleLoadLocalDraft,
    onHandleDeleteLocalDraft,
    onHandleQueueLocalDraftUpload,
    onOpenSavedDrafts,
    onStartNewReportForDate,
    systemStartDate,
  } = props;
  const [openPrintMenuId, setOpenPrintMenuId] = useState<string | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileOrTablet = useMediaQuery("(max-width: 1023px)");
  const holidayInfo = useMemo(() => getHolidayInfo(historyDate), [historyDate]);

  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [statusSearchQuery, setStatusSearchQuery] = useState("");
  const [expandedCardNames, setExpandedCardNames] = useState<
    Record<string, boolean>
  >({});
  const [showSearchCapsule, setShowSearchCapsule] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Month and Year selector for chronological view
  const [chronoMonth, setChronoMonth] = useState(() => new Date().getMonth());
  const [chronoYear, setChronoYear] = useState(() => new Date().getFullYear());

  // Flash highlight effect state
  const [flashingDate, setFlashingDate] = useState<string | null>(null);

  const BULAN_LABELS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const showChronologicalView =
    Boolean(props.userSession) ||
    (Boolean(props.adminSession) && statusSearchQuery.trim() !== "");

  // All reports list passed from props
  const allReports = props.reports || [];

  const chronoReports = useMemo(() => {
    if (!showChronologicalView) return [];

    // Determine the target reporter name
    const targetName = props.userSession
      ? props.userSession.fullName
      : statusSearchQuery.trim();

    // Filter reports belonging to targetName in the selected month & year
    return allReports
      .filter((r: Report) => {
        const matchName = isSameReporterName(r.nama, targetName);
        if (!matchName) return false;

        const rDate = new Date(r.reportDate);
        return (
          rDate.getMonth() === chronoMonth && rDate.getFullYear() === chronoYear
        );
      })
      .sort((a: Report, b: Report) => b.reportDate.localeCompare(a.reportDate));
  }, [
    allReports,
    showChronologicalView,
    props.userSession,
    statusSearchQuery,
    chronoMonth,
    chronoYear,
  ]);

  // Tanggal acuan mulai operasional: gunakan modul terpusat (in-memory, tanpa query DB tambahan)
  const effectiveStartDate = useMemo(
    () => resolveEffectiveSystemStartDate(systemStartDate, props.reports, props.today),
    [systemStartDate, props.reports, props.today],
  );
  const startDateLabel = useMemo(
    () => getSystemStartDateLabel(effectiveStartDate),
    [effectiveStartDate],
  );

  const consistencyStats = useMemo(() => {
    if (!showChronologicalView || !props.userSession) return null;

    // Start date of the month
    const yyyy = String(chronoYear);
    const mm = String(chronoMonth + 1).padStart(2, "0");
    const startOfMonth = `${yyyy}-${mm}-01`;

    // End date of the month
    const lastDay = new Date(chronoYear, chronoMonth + 1, 0).getDate();
    const endOfMonth = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;

    // Clamp the end date to today if the selected period is the current month and year
    const effectiveEnd = endOfMonth < props.today ? endOfMonth : props.today;
    const effectiveStart = startOfMonth;

    // Get expected working days in this range
    const expectedStats = getEffectiveWorkingDaysInRange(
      effectiveStart,
      effectiveEnd,
      { systemStartDate: effectiveStartDate },
    );
    const targetDays = expectedStats.totalWorkingDays;

    // Filter unique working days submitted by this user in this range
    const uniqueWorkingDaysSubmitted = new Set(
      chronoReports
        .map((r) => r.reportDate)
        .filter(
          (d) =>
            d >= effectiveStart &&
            d <= effectiveEnd &&
            isWorkDay(d) &&
            d >= effectiveStartDate,
        ),
    ).size;

    const pct =
      targetDays > 0
        ? Math.min(
            100,
            Math.round((uniqueWorkingDaysSubmitted / targetDays) * 100),
          )
        : 0;

    return {
      percentage: pct,
      submitted: uniqueWorkingDaysSubmitted,
      target: targetDays,
    };
  }, [
    chronoReports,
    showChronologicalView,
    props.userSession,
    chronoMonth,
    chronoYear,
    props.today,
    effectiveStartDate,
  ]);

  const expectedWorkingDays = useMemo(() => {
    if (!showChronologicalView || !props.userSession) return [];

    const yyyy = String(chronoYear);
    const mm = String(chronoMonth + 1).padStart(2, "0");

    // Start of month or effectiveStartDate (whichever is later)
    const startOfMonth = `${yyyy}-${mm}-01`;
    const effectiveStart = startOfMonth > effectiveStartDate ? startOfMonth : effectiveStartDate;

    // End of month or today (whichever is earlier)
    const lastDay = new Date(chronoYear, chronoMonth + 1, 0).getDate();
    const endOfMonth = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;
    const effectiveEnd = endOfMonth < props.today ? endOfMonth : props.today;

    if (!effectiveStart || !effectiveEnd || effectiveStart > effectiveEnd) return [];

    const [sY, sM, sD] = effectiveStart.slice(0, 10).split("-").map(Number);
    const [eY, eM, eD] = effectiveEnd.slice(0, 10).split("-").map(Number);
    if (isNaN(sY) || isNaN(sM) || isNaN(sD) || isNaN(eY) || isNaN(eM) || isNaN(eD)) return [];

    const current = new Date(sY, sM - 1, sD);
    const endLimit = new Date(eY, eM - 1, eD);
    if (isNaN(current.getTime()) || isNaN(endLimit.getTime())) return [];

    const days: string[] = [];
    let safetyCount = 0;

    while (current <= endLimit && safetyCount < 100) {
      safetyCount++;
      const yStr = current.getFullYear();
      const mStr = String(current.getMonth() + 1).padStart(2, "0");
      const dStr = String(current.getDate()).padStart(2, "0");
      const dateStr = `${yStr}-${mStr}-${dStr}`;
      if (isWorkDay(dateStr)) {
        days.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [chronoMonth, chronoYear, props.today, showChronologicalView, props.userSession, effectiveStartDate]);

  const chronoItems = useMemo(() => {
    if (!showChronologicalView) return [];

    // If this is not a regular user session (e.g. admin searching), just return the actual reports!
    if (!props.userSession) {
      return chronoReports.map(r => ({ type: "report" as const, date: r.reportDate, report: r }));
    }

    // For regular users, we merge with expected working days
    const allDates = new Set([
      ...chronoReports.map(r => r.reportDate),
      ...expectedWorkingDays
    ]);

    const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

    return sortedDates.map(date => {
      const report = chronoReports.find(r => r.reportDate === date);
      if (report) {
        return { type: "report" as const, date, report };
      } else {
        return { type: "missing" as const, date, report: null };
      }
    });
  }, [chronoReports, showChronologicalView, props.userSession, expectedWorkingDays]);

  const handleScrollToDate = (targetDate: string) => {
    if (!targetDate) return;

    const dateObj = new Date(targetDate);
    const targetMonth = dateObj.getMonth();
    const targetYear = dateObj.getFullYear();

    // If different month/year, switch first
    if (targetMonth !== chronoMonth || targetYear !== chronoYear) {
      setChronoMonth(targetMonth);
      setChronoYear(targetYear);
    }

    // Scroll to the element after a short delay to allow rendering
    setTimeout(() => {
      const element = document.getElementById(`date-group-${targetDate}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        // Flash highlight effect
        setFlashingDate(targetDate);
        setTimeout(() => setFlashingDate(null), 2000);
      }
    }, 200);
  };

  useEffect(() => {
    if (showChronologicalView && historyDate) {
      handleScrollToDate(historyDate);
    }
  }, [historyDate, showChronologicalView]);

  useEffect(() => {
    if (showSearchCapsule && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchCapsule]);

  useEffect(() => {
    if (!showDraftsModal) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    // Prevent background scrolling when modal is open
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDraftsModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDraftsModal]);

  const toggleExpand = (name: string) => {
    setExpandedCardNames((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleAdjustDay = (amount: number) => {
    const parts = historyDate.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      const date = new Date(year, month, day);
      date.setDate(date.getDate() + amount);

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      setHistoryDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const submissionStats = useMemo(() => {
    const total = statusRows.length;
    const done = statusRows.filter((r) => r.done).length;
    const pending = total - done;
    return { total, done, pending };
  }, [statusRows]);

  const filteredStatusRows = useMemo(() => {
    const filtered = statusRows.filter((row) =>
      row.name.toLowerCase().includes(statusSearchQuery.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      if (a.done !== b.done) {
        return a.done ? -1 : 1;
      }
      if (a.done && a.report && b.report) {
        const timeA = new Date(a.report.updatedAt).getTime();
        const timeB = new Date(b.report.updatedAt).getTime();
        return timeB - timeA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [statusRows, statusSearchQuery]);

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
    <section className="space-y-4 animate-fadeIn">
      {/* Desktop & Tablet Filter Panels */}
      <div className="hidden md:block w-full animate-fadeIn">
        <div className="flex flex-col gap-3 panel-glass rounded-[28px] p-5">
          {/* Top Row: Stats Capsule & Search/Date Pill */}
          <div className="flex md:flex-row md:items-center md:justify-between gap-4">
            {/* Stats Capsule */}
            {props.userSession || showChronologicalView ? (
              <div className="flex flex-wrap items-center gap-4 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Periode:
                  </span>
                  <select
                    value={chronoMonth}
                    onChange={(e) => setChronoMonth(Number(e.target.value))}
                    className="field-input py-1 px-2 text-xs rounded-lg min-w-[100px] cursor-pointer bg-[var(--surface-panel-strong)] text-[var(--text-primary)] border border-[var(--border-soft)]"
                  >
                    {BULAN_LABELS.map((label, idx) => (
                      <option key={idx} value={idx}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={chronoYear}
                    onChange={(e) => setChronoYear(Number(e.target.value))}
                    className="field-input py-1 px-2 text-xs rounded-lg min-w-[70px] cursor-pointer bg-[var(--surface-panel-strong)] text-[var(--text-primary)] border border-[var(--border-soft)]"
                  >
                    {[2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-4 shadow-sm text-sm font-bold text-[var(--text-primary)] justify-center shrink-0">
                <span className="text-[var(--success)]">
                  {submissionStats.done} Sudah isi
                </span>
                <span className="mx-3 text-[var(--border-soft)]">|</span>
                <span className="text-[var(--danger)]">
                  {submissionStats.pending} Belum isi
                </span>
                <span className="mx-3 text-[var(--border-soft)]">|</span>
                <span>Total {submissionStats.total}</span>
              </div>
            )}

            {/* Unified Search Pill */}
            <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-3.5 shadow-sm gap-2.5 max-w-md w-full md:w-auto">
              {/* Desktop Inline Search */}
              {!props.userSession && (
                <>
                  <div className="hidden lg:flex items-center gap-2 flex-1 min-w-0">
                    <SearchIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                    <input
                      type="text"
                      value={statusSearchQuery}
                      onChange={(e) => setStatusSearchQuery(e.target.value)}
                      placeholder="Cari petugas..."
                      className="bg-transparent border-0 outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] w-[120px] focus:ring-0 p-0"
                    />
                  </div>

                  {/* Desktop-only Divider */}
                  <span className="hidden lg:block h-4 w-[1px] bg-[var(--border-soft)] shrink-0" />

                  {/* Tablet-only Search Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowSearchCapsule((prev) => !prev)}
                    className={`lg:hidden h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition ${
                      showSearchCapsule
                        ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/10"
                        : "hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                    title="Cari Petugas"
                  >
                    <SearchIcon className="h-4 w-4" />
                  </button>

                  {/* Tablet-only Divider */}
                  <span className="lg:hidden h-4 w-[1px] bg-[var(--border-soft)] shrink-0" />
                </>
              )}

              {/* Date Picker with Prev/Next Day buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAdjustDay(-1)}
                  className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition shrink-0"
                  title="Hari Sebelumnya"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-1.5 px-0.5">
                  <CalendarIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] cursor-pointer focus:ring-0 p-0 w-[115px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAdjustDay(1)}
                  className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition shrink-0"
                  title="Hari Berikutnya"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Vertical Divider */}
              <span className="h-4 w-[1px] bg-[var(--border-soft)] shrink-0" />

              {/* Reload Button */}
              <button
                type="button"
                onClick={() => void onReload()}
                disabled={loading}
                className="h-8 w-8 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 disabled:opacity-50 transition"
                title="Muat ulang data"
              >
                {loading ? <SpinnerIcon /> : <ReloadIcon />}
              </button>
            </div>
          </div>

          {/* Tablet Collapsible Search Capsule */}
          {!props.userSession && showSearchCapsule && (
            <div className="lg:hidden flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-4 shadow-sm gap-2 w-full animate-fadeIn">
              <SearchIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={statusSearchQuery}
                onChange={(e) => setStatusSearchQuery(e.target.value)}
                placeholder="Cari petugas..."
                className="bg-transparent border-0 outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] w-full focus:ring-0 p-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Panel */}
      {!props.userSession && !showChronologicalView && (
        <div className="flex flex-col gap-3 md:hidden panel-glass rounded-[28px] p-4">
          {/* Row 1: Stats Capsule */}
          <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-4 shadow-sm text-xs font-bold text-[var(--text-primary)] justify-center w-full">
            <span className="text-[var(--success)]">
              {submissionStats.done} Sudah isi
            </span>
            <span className="mx-2.5 text-[var(--border-soft)]">|</span>
            <span className="text-[var(--danger)]">
              {submissionStats.pending} Belum isi
            </span>
            <span className="mx-2.5 text-[var(--border-soft)]">|</span>
            <span>Total {submissionStats.total}</span>
          </div>

          {/* Row 2: Date Picker & Reload Capsule */}
          <div className="flex items-center justify-between h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-3.5 shadow-sm w-full">
            <button
              type="button"
              onClick={() => setShowSearchCapsule((prev) => !prev)}
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition ${
                showSearchCapsule
                  ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/10"
                  : "hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title="Cari Petugas"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
            <span className="h-4 w-[1px] bg-[var(--border-soft)] shrink-0" />

            <div className="flex items-center gap-1 shrink-0 mx-auto">
              <button
                type="button"
                onClick={() => handleAdjustDay(-1)}
                className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition shrink-0"
                title="Hari Sebelumnya"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-1.5 px-0.5">
                <CalendarIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] cursor-pointer focus:ring-0 p-0 w-[115px]"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustDay(1)}
                className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition shrink-0"
                title="Hari Berikutnya"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <span className="h-4 w-[1px] bg-[var(--border-soft)] shrink-0" />

            <button
              type="button"
              onClick={() => void onReload()}
              disabled={loading}
              className="h-8 w-8 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 disabled:opacity-50 transition"
              title="Muat ulang data"
            >
              {loading ? <SpinnerIcon /> : <ReloadIcon />}
            </button>
          </div>

          {/* Row 3: Mobile Search Capsule */}
          {showSearchCapsule && (
            <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-4 shadow-sm gap-2 w-full animate-fadeIn">
              <SearchIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={statusSearchQuery}
                onChange={(e) => setStatusSearchQuery(e.target.value)}
                placeholder="Cari petugas..."
                className="bg-transparent border-0 outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] w-full focus:ring-0 p-0"
              />
            </div>
          )}
        </div>
      )}

      {/* Submission Status List Grid or Chronological List */}
      <div className="w-full">
        {showChronologicalView ? (
          <div className="space-y-4 max-w-4xl mx-auto w-full animate-fadeIn">
            {/* On mobile, render the Filter & Periode Card at the top */}
            <div className="md:hidden">
              <div className="surface-card rounded-[28px] p-5 border border-[var(--border-soft)] shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Bulan
                    </label>
                    <select
                      value={chronoMonth}
                      onChange={(e) => setChronoMonth(Number(e.target.value))}
                      className="w-full field-input py-2 px-3 text-xs rounded-xl cursor-pointer bg-[var(--surface-panel-strong)] text-[var(--text-primary)] border border-[var(--border-soft)] focus:outline-none focus:border-purple-500"
                    >
                      {BULAN_LABELS.map((label, idx) => (
                        <option key={idx} value={idx}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Tahun
                    </label>
                    <select
                      value={chronoYear}
                      onChange={(e) => setChronoYear(Number(e.target.value))}
                      className="w-full field-input py-2 px-3 text-xs rounded-xl cursor-pointer bg-[var(--surface-panel-strong)] text-[var(--text-primary)] border border-[var(--border-soft)] focus:outline-none focus:border-purple-500"
                    >
                      {[2026, 2027, 2028].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Lompat ke Tanggal
                    </label>
                    <input
                      type="date"
                      value={historyDate}
                      onChange={(e) => setHistoryDate(e.target.value)}
                      className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs focus:outline-none transition shadow-inner text-[var(--text-primary)] cursor-pointer"
                    />
                  </div>
                </div>

                {consistencyStats && (
                  <div className="pt-3.5 border-t border-[var(--border-soft)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-[var(--text-primary)]">Konsistensi Laporan</h4>
                          <span className="group relative cursor-pointer text-[var(--text-soft)] hover:text-[var(--text-primary)] transition shrink-0">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-[var(--surface-tooltip)] text-[var(--text-tooltip)] text-[9px] font-medium leading-normal shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-bottom z-50 text-center">
                              Hari Sabtu, Minggu, Hari Libur Nasional, serta kalender sebelum <strong>{startDateLabel}</strong> tidak dihitung sebagai beban target absensi kerja.
                            </span>
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums">{consistencyStats.percentage}%</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            consistencyStats.percentage >= 80
                              ? "bg-[var(--success)]"
                              : consistencyStats.percentage >= 50
                                ? "bg-[var(--warning)]"
                                : "bg-[var(--danger)]"
                          }`}
                          style={{ width: `${consistencyStats.percentage}%` }}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 text-[10px] text-[var(--text-muted)] font-semibold">
                        <div className="flex justify-between">
                          <span>Sudah mengisi:</span>
                          <span className="text-[var(--text-primary)] font-bold">{consistencyStats.submitted} hari</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Target hari efektif:</span>
                          <span className="text-[var(--text-primary)] font-bold">{consistencyStats.target} hari</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {consistencyStats && (
              <div className="hidden md:block surface-card rounded-2xl p-4 border border-[var(--border-soft)] shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                        Konsistensi Laporan
                      </h3>
                      <span className="group relative cursor-pointer text-[var(--text-soft)] hover:text-[var(--text-primary)] transition shrink-0">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>

                        {/* Custom instant tooltip overlay */}
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-[var(--surface-tooltip)] text-[var(--text-tooltip)] text-[9px] font-medium leading-normal shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-bottom z-50 text-center">
                          Hari Sabtu, Minggu, Hari Libur Nasional, serta kalender sebelum <strong>{startDateLabel}</strong> tidak dihitung sebagai beban target absensi kerja.
                        </span>
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] font-semibold leading-none mt-0.5">
                      {BULAN_LABELS[chronoMonth]} {chronoYear}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[var(--text-primary)] tabular-nums">
                      {consistencyStats.percentage}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        consistencyStats.percentage >= 80
                          ? "bg-[var(--success)]"
                          : consistencyStats.percentage >= 50
                            ? "bg-[var(--warning)]"
                            : "bg-[var(--danger)]"
                      }`}
                      style={{ width: `${consistencyStats.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-semibold">
                    <span>
                      Sudah mengisi:{" "}
                      <strong className="text-[var(--text-primary)]">
                        {consistencyStats.submitted} hari
                      </strong>
                    </span>
                    <span>
                      Target:{" "}
                      <strong className="text-[var(--text-primary)]">
                        {consistencyStats.target} hari kerja efektif
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {chronoItems.length === 0 ? (
              <div className="surface-card rounded-[28px] p-16 text-center text-[var(--text-muted)] border border-[var(--border-soft)]">
                <p className="text-sm font-semibold">
                  Belum ada data laporan untuk periode yang dipilih.
                </p>
              </div>
            ) : (
              chronoItems.map((item) => {
                if (item.type === "report") {
                  const report = item.report!;
                  const isExpanded = expandedCardNames[report.id] || false;
                  return (
                    <div
                      key={report.id}
                      id={`date-group-${report.reportDate}`}
                      onClick={() => toggleExpand(report.id)}
                      className={`surface-card rounded-[26px] p-5 border border-[var(--border-soft)] shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all cursor-pointer hover:bg-[var(--surface-muted)]/30 ${
                        flashingDate === report.reportDate
                          ? "bg-purple-500/10 border-purple-500/30 scale-[1.01]"
                          : ""
                      }`}
                    >
                      <div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 bg-purple-500/10 text-purple-500">
                              <CalendarIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[var(--text-primary)] truncate text-sm">
                                {formatWitaDate(report.reportDate)}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)] mt-1 font-semibold">
                                TIM {report.tim || "TRC"} •{" "}
                                {report.activities.length} Aktivitas •{" "}
                                {report.updatedAt !== report.createdAt
                                  ? `Diperbarui ${formatWitaDateTime(report.updatedAt)}`
                                  : `Diunggah ${formatWitaDateTime(report.createdAt)}`}
                              </p>
                            </div>
                          </div>

                          {/* Right side container */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div
                              className="hidden md:flex items-center pl-4 border-l border-[var(--border-soft)] gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Edit Button */}
                              {(report.reportDate === today ||
                                canUseAnyReportDate) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void onHandleLoadEdit(report);
                                  }}
                                  disabled={editLoadingReportId === report.id}
                                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                                  title="Edit Laporan"
                                >
                                  {editLoadingReportId === report.id ? (
                                    <SpinnerIcon />
                                  ) : (
                                    <PencilIcon className="h-3.5 w-3.5" />
                                  )}
                                  <span>Edit</span>
                                </button>
                              )}

                              {/* Excel Export */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onHandleExport(report);
                                }}
                                disabled={excelExportingReportId === report.id}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                                title="Download Excel"
                              >
                                {excelExportingReportId === report.id ? (
                                  <SpinnerIcon />
                                ) : (
                                  <DownloadIcon className="h-3.5 w-3.5" />
                                )}
                                <span>Excel</span>
                              </button>

                              {/* Print PDF Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMobileOrTablet) {
                                    void onHandleUnsupportedMobilePrint();
                                  } else {
                                    void onHandlePrint(report, "a4");
                                  }
                                }}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                                title="Cetak PDF"
                              >
                                <PrintIcon className="h-3.5 w-3.5" />
                                <span>Print</span>
                              </button>

                              {/* Save as PDF Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onHandleSaveAsPdf(report);
                                }}
                                disabled={pdfExportingReportId === report.id}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                                title="Save PDF"
                              >
                                {pdfExportingReportId === report.id ? (
                                  <SpinnerIcon />
                                ) : (
                                  <FileDownIcon className="h-3.5 w-3.5" />
                                )}
                                <span>PDF</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Activity List */}
                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out border-t border-[var(--border-soft)]"
                          style={{
                            maxHeight: isExpanded ? "1000px" : "0px",
                            opacity: isExpanded ? 1 : 0,
                            marginTop: isExpanded ? "12px" : "0px",
                            paddingTop: isExpanded ? "8px" : "0px",
                            borderTopColor: isExpanded
                              ? "var(--border-soft)"
                              : "transparent",
                            borderTopWidth: isExpanded ? "1px" : "0px",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ul className="divide-y divide-[var(--border-soft)] text-xs text-[var(--text-primary)]">
                            {report.activities.map((activity: ReportActivity) => (
                              <li
                                key={`${report.id}-${activity.no}`}
                                className="leading-relaxed py-2"
                              >
                                <div className="font-semibold text-[var(--text-primary)]">
                                  {activity.no}. {activity.description}
                                </div>
                                <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 font-medium flex items-center gap-1">
                                  <ClockIcon className="h-3 w-3 text-[var(--text-muted)]" />
                                  <span>
                                    {activity.startTime} - {activity.endTime} WITA
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Mobile Actions Row */}
                      {report.activities.length > 0 ? (
                        <div
                          className="md:hidden border-t border-[var(--border-soft)] mt-2 pt-3 flex flex-wrap items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Edit Button */}
                          {(report.reportDate === today ||
                            canUseAnyReportDate) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onHandleLoadEdit(report);
                              }}
                              disabled={editLoadingReportId === report.id}
                              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                              title="Edit Laporan"
                            >
                              {editLoadingReportId === report.id ? (
                                <SpinnerIcon />
                              ) : (
                                <PencilIcon className="h-3.5 w-3.5" />
                              )}
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Excel Export */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onHandleExport(report);
                            }}
                            disabled={excelExportingReportId === report.id}
                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                            title="Download Excel"
                          >
                            {excelExportingReportId === report.id ? (
                              <SpinnerIcon />
                            ) : (
                              <DownloadIcon className="h-3.5 w-3.5" />
                            )}
                            <span>Excel</span>
                          </button>

                          {/* Print PDF Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMobileOrTablet) {
                                void onHandleUnsupportedMobilePrint();
                              } else {
                                void onHandlePrint(report, "a4");
                              }
                            }}
                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                            title="Cetak PDF"
                          >
                            <PrintIcon className="h-3.5 w-3.5" />
                            <span>Print</span>
                          </button>

                          {/* Save as PDF Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onHandleSaveAsPdf(report);
                            }}
                            disabled={pdfExportingReportId === report.id}
                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                            title="Save PDF"
                          >
                            {pdfExportingReportId === report.id ? (
                              <SpinnerIcon />
                            ) : (
                              <FileDownIcon className="h-3.5 w-3.5" />
                            )}
                            <span>PDF</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                } else {
                  // Render missing report card placeholder
                  return (
                    <div
                      key={`missing-${item.date}`}
                      id={`date-group-${item.date}`}
                      className={`surface-card rounded-[26px] p-4 sm:p-5 border border-[var(--border-soft)] shadow-sm flex flex-row items-center justify-between gap-3 hover:scale-[1.01] transition-all bg-[var(--surface-panel-strong)]/40 ${
                        flashingDate === item.date
                          ? "bg-purple-500/10 border-purple-500/30 scale-[1.01]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-extrabold text-[var(--text-primary)] truncate leading-tight">
                            {formatWitaDate(item.date)}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] shrink-0">
                              Belum dibuat
                            </span>
                            <span className="text-[9px] text-[var(--text-muted)] font-semibold hidden xs:inline truncate">
                              Laporan harian kosong
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onStartNewReportForDate) {
                              onStartNewReportForDate(item.date);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] text-[10px] font-extrabold transition shadow-sm shrink-0"
                        >
                          <span>Buat</span>
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="7" y1="17" x2="17" y2="7" />
                            <polyline points="7 7 17 7 17 17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-w-4xl mx-auto w-full">
            {holidayInfo.isHoliday && (
              <div className="holiday-info-banner surface-card rounded-[20px] p-4 shadow-sm flex items-start gap-3 text-xs mb-1.5 animate-fadeIn">
                <div className="banner-icon-container h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="banner-title font-bold">
                    Hari Libur: {holidayInfo.name || "Akhir Pekan"}
                  </p>
                  <p className="banner-desc text-[10.5px] mt-0.5 leading-relaxed">
                    Tanggal yang Anda pilih saat ini adalah hari libur (Sabtu,
                    Minggu, atau Hari Libur Nasional). Seluruh laporan petugas
                    pada hari libur tidak akan dihitung sebagai beban target
                    pada statistik rekapitulasi kerja.
                  </p>
                </div>
              </div>
            )}
            {savedLocalDrafts.length > 0 && (
              <div className="surface-card rounded-[20px] p-3.5 border border-amber-500/30 bg-amber-500/5 shadow-sm flex items-center justify-between gap-3 text-xs mb-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <FileTextIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--text-primary)] truncate">
                      Ada {savedLocalDrafts.length} draft tersimpan di perangkat
                      ini
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">
                      Draft lokal dapat dilanjutkan atau diunggah kembali kapan
                      saja
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenSavedDrafts
                      ? onOpenSavedDrafts()
                      : setShowDraftsModal(true)
                  }
                  className="btn-secondary text-xs px-3 py-1.5 shrink-0 hover:border-amber-500/40"
                >
                  Lihat Draft
                </button>
              </div>
            )}
            {filteredStatusRows.map((row) => {
              const isExpanded = expandedCardNames[row.name] || false;
              return (
                <div
                  key={row.name}
                  onClick={() => row.done && toggleExpand(row.name)}
                  className={`surface-card rounded-[26px] p-5 border border-[var(--border-soft)] shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all ${
                    row.done
                      ? "cursor-pointer hover:bg-[var(--surface-muted)]/30"
                      : ""
                  }`}
                >
                  <div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            row.done
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {row.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--text-primary)] truncate text-sm">
                            {row.name}
                          </p>
                          {row.done && row.report ? (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-semibold">
                              {row.report.activities.length} Aktivitas •{" "}
                              {row.report.updatedAt !== row.report.createdAt
                                ? `Diperbarui ${formatWitaDateTime(row.report.updatedAt)}`
                                : `Diunggah ${formatWitaDateTime(row.report.createdAt)}`}
                            </p>
                          ) : (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-semibold">
                              Belum ada aktivitas
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side container */}
                      <div className="flex items-center gap-3 shrink-0">
                        {!row.done && (
                          <span className="status-pill status-pill-danger shrink-0 hidden md:inline-block">
                            Belum isi
                          </span>
                        )}

                        {row.done && row.report && (
                          <div
                            className="hidden md:flex items-center pl-4 border-l border-[var(--border-soft)] gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Edit Button */}
                            {(row.report.reportDate === today ||
                              canUseAnyReportDate) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onHandleLoadEdit(row.report!);
                                }}
                                disabled={editLoadingReportId === row.report.id}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                                title="Edit Laporan"
                              >
                                {editLoadingReportId === row.report.id ? (
                                  <SpinnerIcon />
                                ) : (
                                  <PencilIcon className="h-3.5 w-3.5" />
                                )}
                                <span>Edit</span>
                              </button>
                            )}

                            {/* Excel Export */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onHandleExport(row.report!);
                              }}
                              disabled={
                                excelExportingReportId === row.report.id
                              }
                              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                              title="Download Excel"
                            >
                              {excelExportingReportId === row.report.id ? (
                                <SpinnerIcon />
                              ) : (
                                <DownloadIcon className="h-3.5 w-3.5" />
                              )}
                              <span>Excel</span>
                            </button>

                            {/* Print PDF Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isMobileOrTablet) {
                                  void onHandleUnsupportedMobilePrint();
                                } else {
                                  void onHandlePrint(row.report!, "a4");
                                }
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                              title="Cetak PDF"
                            >
                              <PrintIcon className="h-3.5 w-3.5" />
                              <span>Print</span>
                            </button>

                            {/* Save as PDF Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onHandleSaveAsPdf(row.report!);
                              }}
                              disabled={pdfExportingReportId === row.report.id}
                              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                              title="Save PDF"
                            >
                              {pdfExportingReportId === row.report.id ? (
                                <SpinnerIcon />
                              ) : (
                                <FileDownIcon className="h-3.5 w-3.5" />
                              )}
                              <span>PDF</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Activity List */}
                    {row.done && row.report && (
                      <div
                        className="overflow-hidden transition-all duration-300 ease-in-out border-t border-[var(--border-soft)]"
                        style={{
                          maxHeight: isExpanded ? "1000px" : "0px",
                          opacity: isExpanded ? 1 : 0,
                          marginTop: isExpanded ? "8px" : "0px",
                          paddingTop: isExpanded ? "4px" : "0px",
                          borderTopColor: isExpanded
                            ? "var(--border-soft)"
                            : "transparent",
                          borderTopWidth: isExpanded ? "1px" : "0px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ul className="divide-y divide-[var(--border-soft)] text-xs text-[var(--text-primary)]">
                          {row.report.activities.map((activity) => (
                            <li
                              key={`${row.report!.id}-${activity.no}`}
                              className="leading-relaxed py-2"
                            >
                              <div className="font-semibold text-[var(--text-primary)]">
                                {activity.no}. {activity.description}
                              </div>
                              <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 font-medium flex items-center gap-1">
                                <ClockIcon className="h-3 w-3 text-[var(--text-muted)]" />
                                <span>
                                  {activity.startTime} - {activity.endTime} WITA
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Mobile Actions Row */}
                  {row.done && row.report ? (
                    <div
                      className="md:hidden border-t border-[var(--border-soft)] mt-2 pt-3 flex flex-wrap items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Edit Button */}
                      {(row.report.reportDate === today ||
                        canUseAnyReportDate) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onHandleLoadEdit(row.report!);
                          }}
                          disabled={editLoadingReportId === row.report.id}
                          className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                          title="Edit Laporan"
                        >
                          {editLoadingReportId === row.report.id ? (
                            <SpinnerIcon />
                          ) : (
                            <PencilIcon className="h-3.5 w-3.5" />
                          )}
                          <span>Edit</span>
                        </button>
                      )}

                      {/* Excel Export */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onHandleExport(row.report!);
                        }}
                        disabled={excelExportingReportId === row.report.id}
                        className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                        title="Download Excel"
                      >
                        {excelExportingReportId === row.report.id ? (
                          <SpinnerIcon />
                        ) : (
                          <DownloadIcon className="h-3.5 w-3.5" />
                        )}
                        <span>Excel</span>
                      </button>

                      {/* Print PDF Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMobileOrTablet) {
                            void onHandleUnsupportedMobilePrint();
                          } else {
                            void onHandlePrint(row.report!, "a4");
                          }
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                        title="Cetak PDF"
                      >
                        <PrintIcon className="h-3.5 w-3.5" />
                        <span>Print</span>
                      </button>

                      {/* Save as PDF Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onHandleSaveAsPdf(row.report!);
                        }}
                        disabled={pdfExportingReportId === row.report.id}
                        className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                        title="Save PDF"
                      >
                        {pdfExportingReportId === row.report.id ? (
                          <SpinnerIcon />
                        ) : (
                          <FileDownIcon className="h-3.5 w-3.5" />
                        )}
                        <span>PDF</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {filteredStatusRows.length === 0 && (
              <div className="surface-card rounded-[28px] p-16 text-center text-[var(--text-muted)]">
                <p className="text-lg">
                  Tidak ada petugas yang cocok dengan pencarian.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drafts Modal Fallback */}
      {!onOpenSavedDrafts && (
        <LocalDraftsModal
          isOpen={showDraftsModal}
          onClose={() => setShowDraftsModal(false)}
          savedLocalDrafts={savedLocalDrafts}
          activeLocalDraftId={activeLocalDraftId}
          onHandleLoadLocalDraft={onHandleLoadLocalDraft}
          onHandleDeleteLocalDraft={onHandleDeleteLocalDraft}
          onHandleQueueLocalDraftUpload={onHandleQueueLocalDraftUpload}
        />
      )}
    </section>
  );
}
