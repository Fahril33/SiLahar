import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Report } from "../types/report";
import { formatWitaDate } from "../lib/time";

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

function InfoIcon(props: { className?: string }) {
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
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ModernPrintLoader(props: { statusText: string; progress: number }) {
  return (
    <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--primary)]/30 shadow-md flex items-center gap-3.5 animate-fadeIn">
      {/* Sleek rotating ring loader with document icon */}
      <div className="relative h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 shadow-xs">
        <SpinnerIcon className="h-5 w-5 text-[var(--primary)]" />
      </div>

      {/* Progress detail and bar */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary)]"></span>
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
              {props.statusText}
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-[var(--primary)] shrink-0">
            {props.progress}%
          </span>
        </div>

        {/* Minimalist Smooth Progress Bar with Active Motion */}
        <div className="h-2 w-full bg-[var(--surface-muted)] rounded-full overflow-hidden p-0.5 border border-[var(--border-soft)]">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-[var(--primary)] to-emerald-400 rounded-full transition-all duration-200 ease-out shadow-xs"
            style={{ width: `${Math.min(100, Math.max(8, props.progress))}%` }}
          />
        </div>
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
  const [sourceFilter, setSourceFilter] = useState<"all" | "db" | "local">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
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

  // Find target report if any
  const targetReport = useMemo(() => {
    if (!targetReportId) return null;
    return userReports.find((r) => r.id === targetReportId) || null;
  }, [targetReportId, userReports]);

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

    return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [userReports, sourceFilter, searchQuery]);

  // Total count for current month options
  const totalMonthsSourceCount = useMemo(() => {
    return availableMonthOptions.reduce((acc, curr) => acc + curr.count, 0);
  }, [availableMonthOptions]);

  // Auto-reset monthFilter if selected month has 0 reports under active sourceFilter/searchQuery
  useEffect(() => {
    if (monthFilter !== "all") {
      const exists = availableMonthOptions.some((opt) => opt.key === monthFilter);
      if (!exists) {
        setMonthFilter("all");
      }
    }
  }, [availableMonthOptions, monthFilter]);

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
      setIsPrinting(false);
      setPrintProgress(0);
      setPrintStatusText("Menyiapkan dokumen...");
      setSearchQuery("");
      setSourceFilter("all");
      setMonthFilter("all");
      setPaperFormat(defaultPaperFormat);

      if (targetReportId) {
        setSelectedIds([targetReportId]);
        setSelectionMode("clicked");
      } else {
        setSelectedIds(userReports.map((r) => r.id));
        setSelectionMode("all");
      }
    }
  }, [isOpen, targetReportId, userReports, defaultPaperFormat]);

  // Filtered reports based on correlated source filter, month filter, and search query
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

      // 3. Search query filter
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
  }, [userReports, sourceFilter, monthFilter, searchQuery]);

  // Quick Preset Handlers
  const handleSelectOnlyClicked = () => {
    if (targetReportId) {
      setSelectedIds([targetReportId]);
      setSelectionMode("clicked");
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(userReports.map((r) => r.id));
    setSelectionMode("all");
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredReports.map((r) => r.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    setSelectionMode("custom");
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
      if (next.length === userReports.length) {
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
    if (selectedIds.length === 0 || isPrinting) return;
    setIsPrinting(true);
    setPrintProgress(15);
    setPrintStatusText(`Menyiapkan data (${selectedIds.length} laporan)...`);

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
      // Filter and sort chronologically
      const reportsToPrint = userReports
        .filter((r) => selectedIds.includes(r.id))
        .sort((a, b) => (a.reportDate || "").localeCompare(b.reportDate || ""));

      // Small async tick allowing React to paint progress before heavy processing starts
      await new Promise((resolve) => setTimeout(resolve, 80));

      await onExecutePrint(reportsToPrint, paperFormat, (step, pct) => {
        setPrintStatusText(step);
        setPrintProgress((prev) => Math.max(prev, pct));
      });

      if (tickerId) window.clearInterval(tickerId);
      setPrintProgress(100);
      setPrintStatusText("Membuka dialog cetak...");

      // Smooth auto-close modal after print dialog invocation
      setTimeout(() => {
        onClose();
      }, 400);
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
            <div className="h-9 w-9 rounded-xl bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center shrink-0 border border-[var(--primary)]/20 shadow-xs">
              <PrintIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight">
                  Cetak Dokumen Laporan Petugas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                  {userReports.length} Laporan
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                Petugas:{" "}
                <span className="font-bold text-[var(--text-primary)]">
                  {userName || "Tanpa Nama"}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPrinting}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0 cursor-pointer disabled:opacity-40"
            title="Tutup Modal"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Action Row 1: Mode Pilihan Cepat (Compact Segmented Bar) */}
          <div className="bg-[var(--surface-muted)]/60 p-1 rounded-xl border border-[var(--border-soft)] grid grid-cols-1 sm:grid-cols-3 gap-1">
            {targetReport && (
              <button
                type="button"
                disabled={isPrinting}
                onClick={handleSelectOnlyClicked}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  selectionMode === "clicked" &&
                  selectedIds.length === 1 &&
                  selectedIds[0] === targetReportId
                    ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-sm border border-[var(--border-soft)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
                title={`Khusus tanggal ${formatWitaDate(targetReport.reportDate)}`}
              >
                <TargetIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Laporan Ini</span>
              </button>
            )}

            <button
              type="button"
              disabled={isPrinting}
              onClick={handleSelectAll}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                selectionMode === "all" || selectedIds.length === userReports.length
                  ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-sm border border-[var(--border-soft)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LayersIcon className="h-3.5 w-3.5 shrink-0" />
              <span>Semua ({userReports.length})</span>
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={() => setSelectionMode("custom")}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                selectionMode === "custom" &&
                selectedIds.length > 0 &&
                selectedIds.length < userReports.length &&
                (!targetReportId || selectedIds.length !== 1 || selectedIds[0] !== targetReportId)
                  ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-sm border border-[var(--border-soft)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[var(--primary)] shrink-0" />
              <span>Pilih Manual ({selectedIds.length})</span>
            </button>
          </div>

          {/* Action Row 2: Filter Toolbar Berelasi (Sumber Data, Bulan, Kertas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
            {/* Sumber Data: Campur / DB / Lokal (4 cols) */}
            <div className="lg:col-span-4 space-y-1">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Sumber Data:
              </span>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--surface-muted)] rounded-xl border border-[var(--border-soft)]">
                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={() => setSourceFilter("all")}
                  className={`py-1 px-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 ${
                    sourceFilter === "all"
                      ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-xs border border-[var(--border-soft)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                  title="Gabungan database dan lokal"
                >
                  <LayersIcon className="h-3 w-3" />
                  <span>Semua</span>
                  <span className="text-[10px] opacity-75">({sourceCounts.all})</span>
                </button>

                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={() => setSourceFilter("db")}
                  className={`py-1 px-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 ${
                    sourceFilter === "db"
                      ? "bg-[var(--surface-card)] text-sky-600 dark:text-sky-400 shadow-xs border border-[var(--border-soft)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                  title="Database Supabase saja"
                >
                  <DatabaseIcon className="h-3 w-3" />
                  <span>DB</span>
                  <span className="text-[10px] opacity-75">({sourceCounts.db})</span>
                </button>

                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={() => setSourceFilter("local")}
                  className={`py-1 px-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 ${
                    sourceFilter === "local"
                      ? "bg-[var(--surface-card)] text-amber-600 dark:text-amber-400 shadow-xs border border-[var(--border-soft)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                  title="Draft lokal / cache perangkat saja"
                >
                  <HardDriveIcon className="h-3 w-3" />
                  <span>Lokal</span>
                  <span className="text-[10px] opacity-75">({sourceCounts.local})</span>
                </button>
              </div>
            </div>

            {/* Filter Bulan Dropdown Berelasi (4 cols) */}
            <div className="lg:col-span-4 space-y-1">
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

            {/* Ukuran Kertas Dropdown (4 cols) */}
            <div className="lg:col-span-4 space-y-1">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Ukuran Kertas:
              </span>
              <div className="relative">
                <select
                  value={paperFormat}
                  disabled={isPrinting}
                  onChange={(e) =>
                    setPaperFormat(e.target.value as "a4" | "f4" | "legal" | "letter")
                  }
                  className="w-full h-[34px] pl-7 pr-7 text-xs font-semibold bg-[var(--surface-muted)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer appearance-none uppercase disabled:opacity-50"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="f4">F4 / Folio (215 × 330 mm)</option>
                  <option value="legal">Legal (216 × 356 mm)</option>
                  <option value="letter">Letter (216 × 279 mm)</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
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
                Pilih Hasil Filter ({filteredReports.length})
              </button>
              <span className="text-[var(--border-soft)]">|</span>
              <button
                type="button"
                disabled={isPrinting || selectedIds.length === 0}
                onClick={handleUnselectAll}
                className="text-xs font-bold text-red-500 hover:underline cursor-pointer disabled:opacity-40"
              >
                Lepas Semua
              </button>
            </div>
          </div>

          {/* List of User Reports */}
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {filteredReports.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--surface-muted)]/20 rounded-2xl border border-dashed border-[var(--border-soft)]">
                Tidak ada laporan yang sesuai dengan kombinasi filter dan pencarian aktif.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = selectedIds.includes(report.id);
                const isTarget = targetReportId === report.id;
                const isLocal = isReportLocal(report);
                const actCount = report.activities?.length || 0;
                const firstAct = report.activities?.[0]?.description || "Tidak ada uraian aktivitas";

                return (
                  <div
                    key={report.id}
                    onClick={() => handleToggleReport(report.id)}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all select-none ${
                      isPrinting
                        ? isSelected
                          ? "bg-[var(--primary)]/10 border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/30 cursor-wait"
                          : "opacity-40 cursor-not-allowed bg-[var(--surface-card)]"
                        : "cursor-pointer"
                    } flex items-start gap-2.5 ${
                      isSelected && !isPrinting
                        ? "bg-[var(--primary)]/8 border-[var(--primary)]/40 shadow-xs ring-1 ring-[var(--primary)]/20"
                        : !isSelected && !isPrinting
                        ? "bg-[var(--surface-card)] hover:bg-[var(--surface-muted)]/50 border-[var(--border-soft)] opacity-85"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isPrinting}
                      onChange={() => handleToggleReport(report.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)] rounded cursor-pointer shrink-0 disabled:cursor-not-allowed"
                    />

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {formatWitaDate(report.reportDate)}
                        </span>

                        {isLocal ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <HardDriveIcon className="h-2.5 w-2.5" />
                            <span>Lokal</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1">
                            <DatabaseIcon className="h-2.5 w-2.5" />
                            <span>Database</span>
                          </span>
                        )}

                        {report.tim && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 uppercase">
                            Tim {report.tim}
                          </span>
                        )}

                        {isTarget && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 flex items-center gap-1">
                            <TargetIcon className="h-2.5 w-2.5" />
                            <span>Laporan Terpilih</span>
                          </span>
                        )}

                        <span className="text-[11px] text-[var(--text-muted)]">
                          • {actCount} Aktivitas
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                        {firstAct}
                        {actCount > 1 ? ` (+${actCount - 1} lainnya)` : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Clean Modern Progressing Loader */}
          {isPrinting ? (
            <ModernPrintLoader statusText={printStatusText} progress={printProgress} />
          ) : (
            /* Info Notice Box */
            <div className="p-2.5 rounded-xl bg-[var(--primary)]/8 border border-[var(--primary)]/20 text-xs text-[var(--text-muted)] flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-[var(--primary)] shrink-0" />
              <span className="leading-snug">
                Setiap tanggal laporan otomatis dicetak pada halaman terpisah (page-break per tanggal) dengan format kertas <strong>{paperFormat.toUpperCase()}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-muted)]/40 shrink-0">
          <div className="text-xs font-bold text-[var(--text-primary)]">
            <span className="text-[var(--primary)]">{selectedIds.length}</span> dari {userReports.length} Laporan Terpilih
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
              disabled={selectedIds.length === 0 || isPrinting}
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
                  <span>Cetak Dokumen ({selectedIds.length})</span>
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
