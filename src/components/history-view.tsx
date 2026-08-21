import { useEffect, useRef, useState, useMemo } from "react";
import { useMediaQuery } from "../hooks/use-media-query";
import { formatWitaDateTime } from "../lib/time";
import type { Report } from "../types/report";


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
  } = props;
  const [openPrintMenuId, setOpenPrintMenuId] = useState<string | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileOrTablet = useMediaQuery("(max-width: 1023px)");

  const [statusSearchQuery, setStatusSearchQuery] = useState("");
  const [expandedCardNames, setExpandedCardNames] = useState<Record<string, boolean>>({});
  const [showSearchCapsule, setShowSearchCapsule] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showSearchCapsule && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchCapsule]);

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
    const done = statusRows.filter(r => r.done).length;
    const pending = total - done;
    return { total, done, pending };
  }, [statusRows]);

  const filteredStatusRows = useMemo(() => {
    const filtered = statusRows.filter((row) =>
      row.name.toLowerCase().includes(statusSearchQuery.toLowerCase())
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
            <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-4 shadow-sm text-sm font-bold text-[var(--text-primary)] justify-center shrink-0">
              <span className="text-[var(--success)]">{submissionStats.done} Sudah isi</span>
              <span className="mx-3 text-[var(--border-soft)]">|</span>
              <span className="text-[var(--danger)]">{submissionStats.pending} Belum isi</span>
              <span className="mx-3 text-[var(--border-soft)]">|</span>
              <span>Total {submissionStats.total}</span>
            </div>

            {/* Unified Search Pill */}
            <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-3.5 shadow-sm gap-2.5 max-w-md w-full md:w-auto">
              {/* Desktop Inline Search (Visible on large screens lg and above) */}
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

              {/* Tablet-only Search Toggle Button (Visible only on md screens, hidden on lg screens) */}
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

              {/* Date Picker with Prev/Next Day buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Decrement Day */}
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

                {/* Increment Day */}
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

          {/* Tablet Collapsible Search Capsule (rendered INSIDE the panel-glass container, filling width below) */}
          {showSearchCapsule && (
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
      <div className="flex flex-col gap-3 md:hidden panel-glass rounded-[28px] p-4">
        {/* Row 1: Stats Capsule */}
        <div className="flex items-center h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-4 shadow-sm text-xs font-bold text-[var(--text-primary)] justify-center w-full">
          <span className="text-[var(--success)]">{submissionStats.done} Sudah isi</span>
          <span className="mx-2.5 text-[var(--border-soft)]">|</span>
          <span className="text-[var(--danger)]">{submissionStats.pending} Belum isi</span>
          <span className="mx-2.5 text-[var(--border-soft)]">|</span>
          <span>Total {submissionStats.total}</span>
        </div>

        {/* Row 2: Date Picker & Reload Capsule */}
        <div className="flex items-center justify-between h-[46px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-3.5 shadow-sm w-full">
          {/* Search Toggle Button */}
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

          {/* Vertical Divider */}
          <span className="h-4 w-[1px] bg-[var(--border-soft)] shrink-0" />

          {/* Date Selector with Prev/Next buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Decrement Day */}
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

            {/* Increment Day */}
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

        {/* Row 3: Collapsible Search Capsule (rendered below the filter capsule) */}
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

      {/* Submission Status List Grid */}
      <div className="grid grid-cols-1 gap-2 max-w-4xl mx-auto w-full">
        {filteredStatusRows.map((row) => {
          const isExpanded = expandedCardNames[row.name] || false;
          return (
            <div 
              key={row.name} 
              onClick={() => row.done && toggleExpand(row.name)}
              className={`surface-card rounded-[26px] p-5 border border-[var(--border-soft)] shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all ${
                row.done ? "cursor-pointer hover:bg-[var(--surface-muted)]/30" : ""
              }`}
            >
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      row.done 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : "bg-red-500/10 text-red-500"
                    }`}>
                      {row.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--text-primary)] truncate text-sm">{row.name}</p>
                      {row.done && row.report ? (
                        <p className="text-[10px] text-[var(--text-muted)] mt-1 font-semibold">
                          {row.report.activities.length} Aktivitas • {row.report.updatedAt !== row.report.createdAt 
                            ? `Diperbarui ${formatWitaDateTime(row.report.updatedAt)}`
                            : `Diunggah ${formatWitaDateTime(row.report.createdAt)}`
                          }
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 font-semibold">
                          Belum ada aktivitas
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Right side container: only contains 'Belum isi' status pill OR the actions (raised for md+) */}
                  <div className="flex items-center gap-3 shrink-0">
                    {!row.done && (
                      <span className="status-pill status-pill-danger shrink-0 hidden md:inline-block">
                        Belum isi
                      </span>
                    )}

                    {row.done && row.report && (
                      <div 
                        className="hidden md:flex items-center pl-4 border-l border-[var(--border-soft)]/60 gap-2" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Edit Button */}
                        {(row.report.reportDate === today || canUseAnyReportDate) && (
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
                            {editLoadingReportId === row.report.id ? <SpinnerIcon /> : <PencilIcon className="h-3.5 w-3.5" />}
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
                          {excelExportingReportId === row.report.id ? <SpinnerIcon /> : <DownloadIcon className="h-3.5 w-3.5" />}
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
                          {pdfExportingReportId === row.report.id ? <SpinnerIcon /> : <FileDownIcon className="h-3.5 w-3.5" />}
                          <span>PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Activity List */}
                {row.done && row.report && (
                  <div 
                    className="overflow-hidden transition-all duration-300 ease-in-out border-t border-[var(--border-soft)]/50"
                    style={{
                      maxHeight: isExpanded ? "1000px" : "0px",
                      opacity: isExpanded ? 1 : 0,
                      marginTop: isExpanded ? "8px" : "0px",
                      paddingTop: isExpanded ? "4px" : "0px",
                      borderTopColor: isExpanded ? "var(--border-soft)" : "transparent",
                      borderTopWidth: isExpanded ? "1px" : "0px"
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul className="divide-y divide-[var(--border-soft)]/30 text-xs text-[var(--text-primary)]">
                      {row.report.activities.map((activity) => (
                        <li key={`${row.report!.id}-${activity.no}`} className="leading-relaxed py-2">
                          <div className="font-semibold text-[var(--text-primary)]">{activity.no}. {activity.description}</div>
                          <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 font-medium flex items-center gap-1">
                            <ClockIcon className="h-3 w-3 text-[var(--text-muted)]" />
                            <span>{activity.startTime} - {activity.endTime} WITA</span>
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
                  className="md:hidden border-t border-[var(--border-soft)]/60 mt-2 pt-3 flex items-center justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Edit Button */}
                  {(row.report.reportDate === today || canUseAnyReportDate) && (
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
                      {editLoadingReportId === row.report.id ? <SpinnerIcon /> : <PencilIcon className="h-3.5 w-3.5" />}
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
                    {excelExportingReportId === row.report.id ? <SpinnerIcon /> : <DownloadIcon className="h-3.5 w-3.5" />}
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
                    {pdfExportingReportId === row.report.id ? <SpinnerIcon /> : <FileDownIcon className="h-3.5 w-3.5" />}
                    <span>PDF</span>
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {filteredStatusRows.length === 0 && (
        <div className="surface-card rounded-[28px] p-16 text-center text-[var(--text-muted)]">
          <p className="text-lg">Tidak ada petugas yang cocok dengan pencarian.</p>
        </div>
      )}
    </section>
  );
}
