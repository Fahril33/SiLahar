import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Report, DocumentPresentationMode } from "../types/report";
import { formatWitaDate } from "../lib/time";
import {
  getCalendarWeekRange,
  getMonthCalendarWeeks,
  getCalendarWeeksFromReports,
  type MonthCalendarWeek,
} from "../lib/calendar-week-utils";

export interface AdminPrintSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  targetReportId: string | null;
  userReports: Report[];
  onExecutePrint: (
    reports: Report[],
    paperFormat: "a4" | "f4" | "legal" | "letter",
    onProgress?: (step: string, pct: number) => void,
    presentationMode?: DocumentPresentationMode,
  ) => Promise<void>;
  defaultPaperFormat?: "a4" | "f4" | "legal" | "letter";
}

const BULAN_NAMES = [
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

function SpinnerIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`animate-spin ${props.className || "h-4 w-4"}`}
      style={{ animation: "spin 0.85s linear infinite" }}
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
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
      className={props.className || "h-3.5 w-3.5"}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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
      className={props.className || "h-3.5 w-3.5"}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function DatabaseIcon(props: { className?: string }) {
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
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function HardDriveIcon(props: { className?: string }) {
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
      <line x1="22" y1="12" x2="2" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </svg>
  );
}

function LayersIcon(props: { className?: string }) {
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
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function TargetIcon(props: { className?: string }) {
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
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function FileTextIcon(props: { className?: string }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TableIcon(props: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
    </svg>
  );
}

function ModernPrintLoader(props: { statusText: string; progress: number }) {
  return (
    <div className="py-2 px-3 rounded-xl bg-[var(--surface-muted)]/70 border border-[var(--border-soft)] flex flex-col gap-1.5 animate-fadeIn shrink-0">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <SpinnerIcon className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {props.statusText || "Mempersiapkan dokumen..."}
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-[var(--primary)] shrink-0">
          {props.progress}%
        </span>
      </div>

      {/* Super thin minimalist progress bar */}
      <div className="h-1 w-full bg-[var(--border-soft)]/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--primary)] rounded-full transition-all duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.max(5, props.progress))}%` }}
        />
      </div>
    </div>
  );
}

function isReportLocal(r: Report): boolean {
  return r.source === "local" || r.id.startsWith("draft-");
}

export function AdminPrintSelectionModal({
  isOpen,
  onClose,
  userName,
  targetReportId,
  userReports,
  onExecutePrint,
  defaultPaperFormat = "a4",
}: AdminPrintSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paperFormat, setPaperFormat] = useState<"a4" | "f4" | "legal" | "letter">(
    defaultPaperFormat,
  );
  const [presentationMode, setPresentationMode] = useState<DocumentPresentationMode>("weekly");
  const [sourceFilter, setSourceFilter] = useState<"all" | "db" | "local">("db");
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [selectionMode, setSelectionMode] = useState<"clicked" | "all" | "custom">(
    "clicked",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);
  const [printStatusText, setPrintStatusText] = useState("Menyiapkan dokumen...");

  // Lock body & document scroll whenever modal is open
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  // Handle ESC key to close safely
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPrinting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPrinting, onClose]);


  // 1. Available Months (Correlated to active sourceFilter and searchQuery)
  const availableMonthOptions = useMemo(() => {
    const monthMap = new Map<string, { key: string; label: string; count: number }>();

    for (const r of userReports) {
      // Correlate with active source filter
      if (sourceFilter === "db" && isReportLocal(r)) continue;
      if (sourceFilter === "local" && !isReportLocal(r)) continue;

      // Correlate with search query if any
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDate = (r.reportDate || "").toLowerCase().includes(q);
        const matchFormattedDate = formatWitaDate(r.reportDate).toLowerCase().includes(q);
        const matchTeam = (r.tim || "").toLowerCase().includes(q);
        const matchAct = (r.activities || []).some((a) =>
          (a?.description || "").toLowerCase().includes(q),
        );
        if (!matchDate && !matchFormattedDate && !matchTeam && !matchAct) continue;
      }

      if (!r.reportDate) continue;
      const parts = r.reportDate.split("-");
      if (parts.length >= 2) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          const key = `${year}-${String(monthNum).padStart(2, "0")}`;
          const label = `${BULAN_NAMES[monthNum - 1]} ${year}`;
          const current = monthMap.get(key) || { key, label, count: 0 };
          current.count += 1;
          monthMap.set(key, current);
        }
      }
    }

    // Always ensure current calendar month exists in options so default selection is valid
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(currentKey)) {
      monthMap.set(currentKey, {
        key: currentKey,
        label: `${BULAN_NAMES[now.getMonth()]} ${now.getFullYear()}`,
        count: 0,
      });
    }

    return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [userReports, sourceFilter, searchQuery]);

  // Total count for current month options
  const totalMonthsSourceCount = useMemo(() => {
    return availableMonthOptions.reduce((acc, curr) => acc + curr.count, 0);
  }, [availableMonthOptions]);

  // 1b. Available Weeks for Calendar Week Mode
  const availableWeekOptions = useMemo(() => {
    let baseWeeks: MonthCalendarWeek[] = [];

    if (monthFilter !== "all") {
      baseWeeks = getMonthCalendarWeeks(monthFilter);
    } else {
      baseWeeks = getCalendarWeeksFromReports(userReports);
    }

    // Correlate week counts with active sourceFilter and searchQuery
    return baseWeeks.map((w) => {
      let count = 0;
      for (const r of userReports) {
        if (sourceFilter === "db" && isReportLocal(r)) continue;
        if (sourceFilter === "local" && !isReportLocal(r)) continue;

        if (monthFilter !== "all") {
          const parts = (r.reportDate || "").split("-");
          if (parts.length >= 2) {
            const key = `${parts[0]}-${String(parseInt(parts[1], 10)).padStart(2, "0")}`;
            if (key !== monthFilter) continue;
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDate = (r.reportDate || "").toLowerCase().includes(q);
          const matchFormattedDate = formatWitaDate(r.reportDate).toLowerCase().includes(q);
          const matchTeam = (r.tim || "").toLowerCase().includes(q);
          const matchAct = (r.activities || []).some((a) =>
            (a?.description || "").toLowerCase().includes(q),
          );
          if (!matchDate && !matchFormattedDate && !matchTeam && !matchAct) continue;
        }

        if (!r.reportDate) continue;
        const range = getCalendarWeekRange(r.reportDate);
        const rWeekKey = `${range.monday}_${range.sunday}`;
        if (rWeekKey === w.weekKey) {
          count++;
        }
      }

      return {
        ...w,
        count,
      };
    });
  }, [monthFilter, userReports, sourceFilter, searchQuery]);

  // Current active calendar week item
  const currentWeekItem = useMemo(() => {
    return availableWeekOptions.find((w) => w.isCurrentWeek) || null;
  }, [availableWeekOptions]);

  // Auto-reset weekFilter to "all" when monthFilter changes
  useEffect(() => {
    setWeekFilter("all");
  }, [monthFilter]);

  // 2. Source Data Counts (Correlated to active monthFilter and searchQuery)
  const sourceCounts = useMemo(() => {
    let allCount = 0;
    let dbCount = 0;
    let localCount = 0;

    for (const r of userReports) {
      // Correlate with active month filter
      if (monthFilter !== "all") {
        const parts = (r.reportDate || "").split("-");
        if (parts.length >= 2) {
          const key = `${parts[0]}-${String(parseInt(parts[1], 10)).padStart(2, "0")}`;
          if (key !== monthFilter) continue;
        }
      }

      // Correlate with search query if any
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDate = (r.reportDate || "").toLowerCase().includes(q);
        const matchFormattedDate = formatWitaDate(r.reportDate).toLowerCase().includes(q);
        const matchTeam = (r.tim || "").toLowerCase().includes(q);
        const matchAct = (r.activities || []).some((a) =>
          (a?.description || "").toLowerCase().includes(q),
        );
        if (!matchDate && !matchFormattedDate && !matchTeam && !matchAct) continue;
      }

      allCount++;
      if (isReportLocal(r)) {
        localCount++;
      } else {
        dbCount++;
      }
    }

    return {
      all: allCount,
      db: dbCount,
      local: localCount,
    };
  }, [userReports, monthFilter, searchQuery]);

  // Initialize selection when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      setIsPrinting(false);
      setPrintProgress(0);
      setPrintStatusText("Menyiapkan dokumen...");
      setSearchQuery("");
      setSourceFilter("db"); // Default DB as requested
      setPresentationMode("weekly"); // Default per minggu as requested
      setWeekFilter("all"); // Default all weeks
      setPaperFormat(defaultPaperFormat);

      if (targetReportId) {
        const target = userReports.find((r) => r.id === targetReportId);
        if (target?.reportDate) {
          const targetMonth = target.reportDate.substring(0, 7);
          setMonthFilter(targetMonth);
        } else {
          setMonthFilter(currentMonthKey);
        }
        setSelectedIds([targetReportId]);
        setSelectionMode("clicked");
      } else {
        // Default month to current month
        setMonthFilter(currentMonthKey);

        // Pre-select reports matching initial default filters (DB + current month)
        const initialMatching = userReports.filter((r) => {
          if (isReportLocal(r)) return false;
          if (r.reportDate && !r.reportDate.startsWith(currentMonthKey)) return false;
          return true;
        });

        if (initialMatching.length > 0) {
          setSelectedIds(initialMatching.map((r) => r.id));
        } else {
          const allDbReports = userReports.filter((r) => !isReportLocal(r));
          setSelectedIds(allDbReports.map((r) => r.id));
        }
        setSelectionMode("all");
      }
    }
  }, [isOpen, targetReportId, userReports, defaultPaperFormat]);

  // Filtered reports based on correlated source filter, month filter, week filter, and search query
  const filteredReports = useMemo(() => {
    return userReports.filter((r) => {
      // 1. Source filter: db / local / all (campur)
      if (sourceFilter === "db" && isReportLocal(r)) return false;
      if (sourceFilter === "local" && !isReportLocal(r)) return false;

      // 2. Month filter
      if (monthFilter !== "all") {
        const parts = (r.reportDate || "").split("-");
        if (parts.length >= 2) {
          const key = `${parts[0]}-${String(parseInt(parts[1], 10)).padStart(2, "0")}`;
          if (key !== monthFilter) return false;
        }
      }

      // 3. Week filter (when presentationMode === "weekly" and weekFilter !== "all")
      if (presentationMode === "weekly" && weekFilter !== "all") {
        if (!r.reportDate) return false;
        const range = getCalendarWeekRange(r.reportDate);
        const rWeekKey = `${range.monday}_${range.sunday}`;
        if (rWeekKey !== weekFilter) return false;
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDate = (r.reportDate || "").toLowerCase().includes(q);
        const matchFormattedDate = formatWitaDate(r.reportDate).toLowerCase().includes(q);
        const matchTeam = (r.tim || "").toLowerCase().includes(q);
        const matchAct = (r.activities || []).some((a) =>
          (a?.description || "").toLowerCase().includes(q),
        );
        if (!matchDate && !matchFormattedDate && !matchTeam && !matchAct) return false;
      }
      return true;
    });
  }, [userReports, sourceFilter, monthFilter, weekFilter, presentationMode, searchQuery]);

  // Strictly calculate reports that are BOTH matching current active filters AND checked by user
  const effectiveSelectedReports = useMemo(() => {
    return filteredReports.filter((r) => selectedIds.includes(r.id));
  }, [filteredReports, selectedIds]);

  const effectiveSelectedCount = effectiveSelectedReports.length;

  // Keep selection strictly in sync with active filter criteria
  useEffect(() => {
    if (!isOpen) return;

    if (selectionMode === "clicked" && targetReportId) {
      if (filteredReports.some((r) => r.id === targetReportId)) {
        setSelectedIds([targetReportId]);
      } else {
        setSelectedIds(filteredReports.map((r) => r.id));
        setSelectionMode("all");
      }
    } else if (selectionMode === "all") {
      setSelectedIds(filteredReports.map((r) => r.id));
    } else {
      // In custom selection mode: prune any IDs that are no longer visible in filteredReports
      setSelectedIds((prev) => {
        const valid = prev.filter((id) => filteredReports.some((r) => r.id === id));
        // If all previously selected IDs were filtered out, default to selecting all in current filter view
        return valid.length > 0 ? valid : filteredReports.map((r) => r.id);
      });
    }
  }, [sourceFilter, monthFilter, weekFilter, searchQuery, filteredReports]);

  // Quick Preset Handlers
  const handleSelectAllFiltered = () => {
    setSelectedIds(filteredReports.map((r) => r.id));
    setSelectionMode("all");
  };

  const handleUnselectAll = () => {
    setSelectedIds([]);
    setSelectionMode("custom");
  };

  const handleToggleReport = (reportId: string) => {
    if (isPrinting) return;
    setSelectedIds((prev) => {
      const exists = prev.includes(reportId);
      const next = exists ? prev.filter((id) => id !== reportId) : [...prev, reportId];
      const allSelected =
        filteredReports.length > 0 && filteredReports.every((r) => next.includes(r.id));
      if (allSelected) {
        setSelectionMode("all");
      } else if (targetReportId && next.length === 1 && next[0] === targetReportId) {
        setSelectionMode("clicked");
      } else {
        setSelectionMode("custom");
      }
      return next;
    });
  };

  const handlePrintSubmit = async () => {
    // Strictly only print reports that are currently filtered AND selected!
    const reportsToPrint = [...effectiveSelectedReports].sort((a, b) =>
      (a.reportDate || "").localeCompare(b.reportDate || ""),
    );

    if (reportsToPrint.length === 0 || isPrinting) return;
    setIsPrinting(true);
    setPrintProgress(15);
    setPrintStatusText(`Menyiapkan data (${reportsToPrint.length} laporan)...`);

    // Active timer to smoothly increment progress while async operations run
    let tickerId: number | null = null;
    tickerId = window.setInterval(() => {
      setPrintProgress((prev) => {
        if (prev < 88) {
          return prev + Math.floor(Math.random() * 3 + 1);
        }
        return prev;
      });
    }, 150);

    try {
      // Small async tick allowing React to paint progress before heavy processing starts
      await new Promise((resolve) => setTimeout(resolve, 80));

      await onExecutePrint(
        reportsToPrint,
        paperFormat,
        (step, pct) => {
          setPrintStatusText(step);
          setPrintProgress((prev) => Math.max(prev, pct));
        },
        presentationMode,
      );

      if (tickerId) window.clearInterval(tickerId);
      setPrintProgress(100);
      setPrintStatusText("Pencetakan selesai");

      // Keep modal open after browser print dialog finishes or is cancelled
      setTimeout(() => {
        setIsPrinting(false);
        setPrintProgress(0);
        setPrintStatusText("");
      }, 500);
    } catch (err) {
      if (tickerId) window.clearInterval(tickerId);
      console.error("Gagal mencetak dokumen:", err);
      setIsPrinting(false);
      setPrintProgress(0);
      setPrintStatusText("Gagal mencetak dokumen");
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPrinting) {
          onClose();
        }
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="surface-card rounded-[24px] border border-[var(--border-soft)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto bg-[var(--surface-panel-strong)] animate-scaleUp relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-[var(--border-soft)] flex items-center justify-between gap-3 bg-[var(--surface-muted)]/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight">
                  Cetak Dokumen Laporan Petugas
                </h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                Petugas:{" "}
                <span className="font-bold text-[var(--text-primary)]">
                  {userName || "Tanpa Nama"}
                </span>
              </p>
            </div>
          </div>

          {/* Opsi Pilih Kertas di Header Kanan Atas Menggantikan Tombol X */}
          <div className="flex items-center gap-2 shrink-0">
   
            <div className="relative min-w-[135px] sm:min-w-[160px]">
              <select
                value={paperFormat}
                disabled={isPrinting}
                onChange={(e) =>
                  setPaperFormat(e.target.value as "a4" | "f4" | "legal" | "letter")
                }
                className="w-full h-[34px] pl-7 pr-7 text-xs font-bold bg-[var(--surface-muted)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer appearance-none uppercase disabled:opacity-50 transition shadow-2xs hover:border-[var(--primary)]/50"
                title="Pilih Ukuran Kertas"
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="f4">F4 / Folio (215 × 330 mm)</option>
                <option value="legal">Legal (216 × 356 mm)</option>
                <option value="letter">Letter (216 × 279 mm)</option>
              </select>
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--primary)] pointer-events-none">
                <FileTextIcon className="h-3.5 w-3.5" />
              </div>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Filter Toolbar Berelasi (Sumber Data, Bulan, [Minggu], Bentuk Penyajian) */}
          <div className="space-y-2.5">
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 ${
                presentationMode === "weekly" ? "lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-3"
              } gap-2.5 items-end`}
            >
              {/* Sumber Data Combobox */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Sumber Data:
                </span>
                <div className="relative">
                  <select
                    value={sourceFilter}
                    disabled={isPrinting}
                    onChange={(e) =>
                      setSourceFilter(e.target.value as "all" | "db" | "local")
                    }
                    className="w-full h-[34px] pl-7 pr-7 text-xs font-semibold bg-[var(--surface-muted)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer appearance-none disabled:opacity-50"
                  >
                    <option value="db">Database ({sourceCounts.db})</option>
                    <option value="local">Lokal ({sourceCounts.local})</option>
                    <option value="all">Semua ({sourceCounts.all})</option>
                  </select>
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    {sourceFilter === "db" && <DatabaseIcon className="h-3.5 w-3.5 text-sky-500" />}
                    {sourceFilter === "local" && <HardDriveIcon className="h-3.5 w-3.5 text-amber-500" />}
                    {sourceFilter === "all" && <LayersIcon className="h-3.5 w-3.5 text-[var(--primary)]" />}
                  </div>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Filter Bulan Dropdown Berelasi */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Pilih Bulan:
                </span>
                <div className="relative">
                  <select
                    value={monthFilter}
                    disabled={isPrinting}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full h-[34px] pl-7 pr-7 text-xs font-semibold bg-[var(--surface-muted)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer appearance-none disabled:opacity-50"
                  >
                    <option value="all">Semua Bulan ({totalMonthsSourceCount})</option>
                    {availableMonthOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label} ({opt.count})
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <CalendarIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bentuk Penyajian Dropdown */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Bentuk Penyajian:
                </span>
                <div className="relative">
                  <select
                    value={presentationMode}
                    disabled={isPrinting}
                    onChange={(e) =>
                      setPresentationMode(e.target.value as DocumentPresentationMode)
                    }
                    className="w-full h-[34px] pl-7 pr-7 text-xs font-semibold bg-[var(--surface-muted)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer appearance-none disabled:opacity-50"
                  >
                    <option value="weekly">Per Minggu (Tabel Kalender)</option>
                    <option value="daily">Per Hari (Halaman Terpisah)</option>
                    <option value="custom">Custom (1 Tabel Konsolidasi)</option>
                  </select>
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <TableIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Pilih Minggu (Muncul Hanya Jika Active Filter Per Minggu) - Di Kanan Dari Pilih Bulan */}
              {presentationMode === "weekly" && (
                <div className="space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block truncate">
                      Pilih Minggu:
                    </span>
                    
                  </div>
                  <div className="relative">
                    <select
                      value={weekFilter}
                      disabled={isPrinting}
                      onChange={(e) => setWeekFilter(e.target.value)}
                      className={`w-full h-[34px] pl-7 pr-7 text-xs font-semibold bg-[var(--surface-muted)] border rounded-xl text-[var(--text-primary)] outline-none cursor-pointer appearance-none disabled:opacity-50 transition ${
                        weekFilter !== "all" && currentWeekItem?.weekKey === weekFilter
                          ? "border-emerald-500 ring-1 ring-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold"
                          : "border-[var(--border-soft)] focus:border-[var(--primary)]"
                      }`}
                    >
                      <option value="all">Semua Minggu ({filteredReports.length} data)</option>
                      {availableWeekOptions.map((w) => (
                        <option key={w.weekKey} value={w.weekKey}>
                          {w.label} ({w.rangeLabel}){w.isCurrentWeek ? " (Minggu Berjalan)" : ""} ({w.count})
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                      <CalendarIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

            </div>
            
          </div>

          {/* Quick Search & Filter Selection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-soft)]">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <input
                type="text"
                value={searchQuery}
                disabled={isPrinting}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tanggal / tim / uraian..."
                className="w-full h-[32px] pl-7 pr-7 text-xs bg-[var(--surface-muted)]/70 border border-[var(--border-soft)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] outline-none disabled:opacity-50"
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                <SearchIcon className="h-3.5 w-3.5" />
              </div>
              {searchQuery && !isPrinting && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <span className="text-[var(--text-muted)] font-medium">
                Tersaring: <strong className="text-[var(--text-primary)]">{filteredReports.length}</strong> dari {userReports.length}
              </span>
              <span className="text-[var(--border-soft)]">|</span>
              <button
                type="button"
                disabled={isPrinting || filteredReports.length === 0}
                onClick={handleSelectAllFiltered}
                className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer disabled:opacity-40"
              >
                Pilih Semua Hasil Filter ({filteredReports.length})
              </button>
              <span className="text-[var(--border-soft)]">|</span>
              <button
                type="button"
                disabled={isPrinting || effectiveSelectedCount === 0}
                onClick={handleUnselectAll}
                className="text-xs font-bold text-red-500 hover:underline cursor-pointer disabled:opacity-40"
              >
                Lepas Semua
              </button>
            </div>
          </div>

          {/* List of User Reports */}
          <div className="max-h-[320px] overflow-y-auto pr-1">
            {filteredReports.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--surface-muted)]/20 rounded-xl border border-dashed border-[var(--border-soft)]">
                Tidak ada laporan yang sesuai dengan kombinasi filter dan pencarian aktif.
              </div>
            ) : (
              filteredReports.map((report, idx) => {
                const isSelected = selectedIds.includes(report.id);
                const isTarget = targetReportId === report.id;
                const isLocal = isReportLocal(report);
                const actCount = report.activities?.length || 0;

                return (
                  <div key={report.id}>
                    {idx > 0 && <hr className="border-t border-[var(--border-soft)] my-0.5" />}
                    <div
                      onClick={() => handleToggleReport(report.id)}
                      className={`py-2 px-2 rounded-lg transition-colors select-none flex items-start gap-2.5 ${
                        isPrinting
                          ? isSelected
                            ? "bg-[var(--primary)]/10 cursor-wait"
                            : "opacity-40 cursor-not-allowed"
                          : "cursor-pointer hover:bg-[var(--surface-muted)]/60"
                      } ${
                        isSelected && !isPrinting ? "bg-[var(--primary)]/[0.06]" : ""
                      }`}
                    >
                      {/* Modern Custom Checkbox Indicator */}
                      <div
                        className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all border ${
                          isSelected
                            ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-2xs"
                            : "border-[var(--border-soft)] bg-transparent hover:border-[var(--primary)]/50"
                        }`}
                      >
                        {isSelected && (
                          <svg viewBox="0 0 24 24" className="h-3 w-3 stroke-white fill-none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isPrinting}
                          onChange={() => handleToggleReport(report.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="sr-only"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* Baris 1: Icon Data + Tanggal + Badge Tim / Target */}
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isLocal ? (
                              <HardDriveIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <DatabaseIcon className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            )}
                            <span className="text-xs sm:text-[13px] font-bold text-[var(--text-primary)] leading-none">
                              {formatWitaDate(report.reportDate)}
                            </span>
                          </div>

                          {report.tim && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 uppercase shrink-0">
                              Tim {report.tim}
                            </span>
                          )}

                          {isTarget && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/25 inline-flex items-center gap-1 shrink-0">
                              <TargetIcon className="h-2.5 w-2.5" />
                              <span>Laporan Terpilih</span>
                            </span>
                          )}
                        </div>

                        {/* Baris 2: Jumlah Aktivitas di Bawah Tanggal (Menggantikan Detail) */}
                        <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                          <span className="font-semibold text-[var(--text-primary)]">{actCount}</span> aktivitas
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Clean Modern Progressing Loader (Thin & Compact) */}
          {isPrinting && (
            <ModernPrintLoader statusText={printStatusText} progress={printProgress} />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-muted)]/40 shrink-0">
          <div className="text-xs font-bold text-[var(--text-primary)]">
            <span className="text-[var(--primary)]">{effectiveSelectedCount}</span> dari {filteredReports.length} Laporan Terpilih
            {filteredReports.length !== userReports.length && (
              <span className="text-[var(--text-muted)] font-normal ml-1">
                (dari total {userReports.length})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isPrinting}
              className="btn-secondary px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handlePrintSubmit}
              disabled={effectiveSelectedCount === 0 || isPrinting}
              className="btn-primary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--primary)]/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isPrinting ? (
                <>
                  <SpinnerIcon className="h-4 w-4 shrink-0 text-white" />
                  <span>Mempersiapkan Dokumen...</span>
                </>
              ) : (
                <>
                  <PrintIcon className="h-4 w-4 shrink-0" />
                  <span>Cetak Dokumen ({effectiveSelectedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
