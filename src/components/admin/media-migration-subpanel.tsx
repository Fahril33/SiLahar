import { useState, useEffect, useRef, useMemo } from "react";
import type { AdminSessionState } from "../../types/admin";
import type {
  MediaMigrationBucketId,
  MediaMigrationScanResult,
  MediaMigrationSummaryResult,
  MediaMigrationProgressEvent,
} from "../../types/media-migration";
import {
  checkMediaMigrationConnections,
  scanMediaMigration,
  executeMediaMigration,
} from "../../lib/media-migration-service";
import { formatMediaBytes } from "../../lib/media-utils";
import { askConfirmation, showError, showSuccess } from "../../lib/alerts";
import { SpinnerIcon } from "./shared";

type ViewMode = "reports" | "files" | "settings";
type MainTab = "selection" | "progress";
type PeriodPreset = "all" | "today" | "last_7_days" | "this_month" | "last_month" | "last_30_days" | "custom";

function calculatePresetDates(preset: PeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatYmd(now);

  if (preset === "all") {
    return { startDate: "", endDate: "" };
  }
  if (preset === "today") {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (preset === "last_7_days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { startDate: formatYmd(d), endDate: todayStr };
  }
  if (preset === "last_30_days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { startDate: formatYmd(d), endDate: todayStr };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatYmd(start), endDate: todayStr };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: formatYmd(start), endDate: formatYmd(end) };
  }
  return { startDate: "", endDate: "" };
}

export function MediaMigrationSubpanel(props: {
  adminSession?: AdminSessionState | null;
  onReloadReports?: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [scanResult, setScanResult] = useState<MediaMigrationScanResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    canMigrate: boolean;
    legacyConnected: boolean;
    primaryConnected: boolean;
    error?: string;
    storageOnlyMode?: boolean;
  } | null>(null);

  // Mode Navigasi Utama (Persis seperti Bulk Export PDF)
  const [viewMode, setViewMode] = useState<MainTab>("selection");
  // Tab View di dalam Mode Seleksi
  const [activeTab, setActiveTab] = useState<ViewMode>("reports");

  // Selection & Filters
  const [selectedBucketIds, setSelectedBucketIds] = useState<MediaMigrationBucketId[]>([
    "daily-report-proofs",
    "official-signatures",
  ]);
  const [selectedReportIds, setSelectedReportIds] = useState<Record<string, boolean>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [skipAlreadySynced, setSkipAlreadySynced] = useState(true);
  const [includeOrphans, setIncludeOrphans] = useState(false);

  // Search & Filter States
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportFilterStatus, setReportFilterStatus] = useState<"all" | "synced" | "pending">("all");
  const [tableFilterStatus, setTableFilterStatus] = useState<string>("all");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Expandable report cards
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  // Progress & Logs
  const [progress, setProgress] = useState<MediaMigrationProgressEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [migrationResult, setMigrationResult] = useState<MediaMigrationSummaryResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // Load scan data
  async function performScan() {
    setLoading(true);
    setProgress(null);
    setMigrationResult(null);
    try {
      const conn = await checkMediaMigrationConnections();
      setConnectionStatus(conn);

      if (!conn.canMigrate) {
        setLoading(false);
        return;
      }

      const res = await scanMediaMigration((statusText) => {
        setProgress({
          phase: "scanning",
          completedItems: 0,
          totalItems: 0,
          transferredBytes: 0,
          totalBytes: 0,
          percent: 0,
          statusText,
        });
      });

      setScanResult(res);

      // Default select all reports & users
      const initialReports: Record<string, boolean> = {};
      (res.reportGroups || []).forEach((r) => {
        initialReports[r.reportId] = true;
      });
      setSelectedReportIds(initialReports);

      const initialUsers: Record<string, boolean> = {};
      res.userGroups.forEach((u) => {
        initialUsers[u.id] = true;
      });
      setSelectedUserIds(initialUsers);
    } catch (err: any) {
      void showError("Pemeriksaan Gagal", err?.message || "Gagal memindai data dan media database lama.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  useEffect(() => {
    void performScan();
  }, []);

  function toggleReportSelection(reportId: string) {
    if (migrating) return;
    setSelectedReportIds((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  }

  function toggleAllReports(selectAll: boolean) {
    if (migrating || !scanResult?.reportGroups) return;
    const next: Record<string, boolean> = {};
    scanResult.reportGroups.forEach((r) => {
      next[r.reportId] = selectAll;
    });
    setSelectedReportIds(next);
  }

  function toggleReportExpanded(reportId: string) {
    setExpandedReports((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  }

  function toggleBucket(bId: MediaMigrationBucketId) {
    if (migrating) return;
    setSelectedBucketIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId],
    );
  }

  function toggleUser(userId: string) {
    if (migrating) return;
    setSelectedUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  }

  function toggleAllUsers(selectAll: boolean) {
    if (migrating || !scanResult) return;
    const next: Record<string, boolean> = {};
    scanResult.userGroups.forEach((u) => {
      next[u.id] = selectAll;
    });
    setSelectedUserIds(next);
  }

  function handlePresetChange(preset: PeriodPreset) {
    setPeriodPreset(preset);
    if (preset !== "custom") {
      const dates = calculatePresetDates(preset);
      setStartDate(dates.startDate);
      setEndDate(dates.endDate);
    }
  }

  function selectAllFilteredReports() {
    if (migrating) return;
    setSelectedReportIds((prev) => {
      const next = { ...prev };
      filteredReportGroups.forEach((r) => {
        next[r.reportId] = true;
      });
      return next;
    });
  }

  function deselectAllFilteredReports() {
    if (migrating) return;
    setSelectedReportIds((prev) => {
      const next = { ...prev };
      filteredReportGroups.forEach((r) => {
        delete next[r.reportId];
      });
      return next;
    });
  }

  // Filtered Report Groups
  const filteredReportGroups = useMemo(() => {
    if (!scanResult?.reportGroups) return [];
    return scanResult.reportGroups.filter((rep) => {
      // Filter periode tanggal
      if (startDate && rep.reportDate && rep.reportDate < startDate) return false;
      if (endDate && rep.reportDate && rep.reportDate > endDate) return false;

      // Filter status
      const isFullySynced = rep.needsMigrationCount === 0;
      if (reportFilterStatus === "synced" && !isFullySynced) return false;
      if (reportFilterStatus === "pending" && isFullySynced) return false;

      // Filter search
      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.toLowerCase();
        const matchName = rep.reporterName.toLowerCase().includes(q);
        const matchDate = (rep.reportDate || "").toLowerCase().includes(q);
        const matchTim = (rep.tim || "").toLowerCase().includes(q);
        const matchId = rep.reportId.toLowerCase().includes(q);
        if (!matchName && !matchDate && !matchTim && !matchId) return false;
      }
      return true;
    });
  }, [scanResult?.reportGroups, startDate, endDate, reportFilterStatus, reportSearchQuery]);

  // Filtered Items for Flat Audit Table
  const filteredTableItems = useMemo(() => {
    if (!scanResult?.items) return [];
    return scanResult.items.filter((item) => {
      // Filter periode tanggal
      if (startDate && item.userRel.reportDate && item.userRel.reportDate < startDate) return false;
      if (endDate && item.userRel.reportDate && item.userRel.reportDate > endDate) return false;

      if (tableFilterStatus === "synced") {
        if (item.status !== "synced" && item.status !== "already_synced") return false;
      } else if (tableFilterStatus === "pending") {
        if (item.status !== "pending") return false;
      } else if (tableFilterStatus === "failed") {
        if (item.status !== "failed") return false;
      }

      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase();
        const matchPath = item.storagePath.toLowerCase().includes(q);
        const matchUser = item.userRel.userName.toLowerCase().includes(q);
        const matchDate = (item.userRel.reportDate || "").includes(q);
        const matchFile = item.originalFileName.toLowerCase().includes(q);
        if (!matchPath && !matchUser && !matchDate && !matchFile) return false;
      }
      return true;
    });
  }, [scanResult?.items, startDate, endDate, tableFilterStatus, tableSearchQuery]);

  // Filtered users for config
  const filteredUserGroups = useMemo(() => {
    if (!scanResult?.userGroups) return [];
    return scanResult.userGroups.filter((u) =>
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()),
    );
  }, [scanResult?.userGroups, userSearchQuery]);

  // Target count statistics
  const selectedReportCount = useMemo(() => {
    return Object.values(selectedReportIds).filter(Boolean).length;
  }, [selectedReportIds]);

  const selectedReportGroups = useMemo(() => {
    if (!scanResult?.reportGroups) return [];
    return scanResult.reportGroups.filter((r) => selectedReportIds[r.reportId]);
  }, [scanResult?.reportGroups, selectedReportIds]);

  const selectedTotalPhotos = useMemo(() => {
    return selectedReportGroups.reduce((acc, r) => acc + (r.totalPhotos || 0), 0);
  }, [selectedReportGroups]);

  const selectedActivitiesCount = useMemo(() => {
    return selectedReportGroups.reduce((acc, r) => acc + (r.activitiesCount || 0), 0);
  }, [selectedReportGroups]);

  async function handleStartMigration() {
    if (!scanResult || scanResult.items.length === 0) {
      void showError("Tidak Ada Data", "Pindai media terlebih dahulu sebelum memulai migrasi.");
      return;
    }

    const activeReportKeys = Object.keys(selectedReportIds).filter((k) => selectedReportIds[k]);
    const activeUserKeys = Object.keys(selectedUserIds).filter((k) => selectedUserIds[k]);

    if (activeReportKeys.length === 0 && activeUserKeys.length === 0) {
      void showError("Peringatan", "Pilih minimal satu laporan atau petugas untuk dimigrasikan.");
      return;
    }

    const confirmed = await askConfirmation(
      "Mulai Migrasi Laporan & Dokumentasi?",
      `Sistem akan memigrasikan data laporan harian, detail aktivitas, dan foto dokumentasi fisik ke Supabase Baru.\n\n` +
        `• Hierarki folder storage dan nama file dipertahankan 100% presisi.\n` +
        `• Relasi foreign key ke akun petugas (reporter_directory), daily_reports, dan daily_report_activities dipastikan utuh.\n` +
        `• Penomoran aktivitas disesuaikan otomatis agar tidak terjadi bentrok.`,
      "Ya, Mulai Migrasi Lengkap",
    );
    if (!confirmed) return;

    setMigrating(true);
    setViewMode("progress"); // Otomatis beralih ke UI Progres (persis seperti bulk PDF export)
    setMigrationResult(null);
    setLogs([]);

    const initialLog = `[${new Date().toLocaleTimeString()}] Memulai migrasi data laporan dan dokumentasi media relasional...`;
    setLogs([initialLog]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await executeMediaMigration(
        scanResult.items,
        {
          selectedBucketIds,
          selectedReportIds: activeReportKeys,
          selectedUserIds: activeUserKeys,
          reportGroups: scanResult.reportGroups,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          skipAlreadySynced,
          includeOrphans,
          signal: abortController.signal,
          adminSession: props.adminSession,
        },
        (event) => {
          setProgress(event);
          if (event.logMessage) {
            setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${event.logMessage}`]);
          }
        },
      );

      setMigrationResult(result);

      if (result.success) {
        void showSuccess(
          "Migrasi Berhasil Sempurna",
          `Berhasil memigrasikan ${result.migratedReportsCount || 0} laporan, ${result.migratedActivitiesCount || 0} detail aktivitas, dan ${result.successCount} berkas media (${formatMediaBytes(result.transferredBytes)}) ke DB Baru tanpa duplikasi!`,
        );
      } else {
        void showError(
          "Migrasi Selesai dengan Catatan",
          `${result.successCount} berkas berhasil, ${result.failedCount} gagal. Periksa log eksekusi di bawah.`,
        );
      }

      if (props.onReloadReports) {
        void props.onReloadReports();
      }

      // Re-scan to update status
      void performScan();
    } catch (err: any) {
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Migrasi dihentikan oleh pengguna.`]);
      } else {
        void showError("Migrasi Terhenti", err?.message || "Terjadi kesalahan saat migrasi media.");
        setLogs((prev) => [...prev, `[ERROR] ${err?.message || err}`]);
      }
    } finally {
      setMigrating(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancelMigration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigasi Mode Utama: 1. Seleksi data & filter | 2. Progres migrasi (Persis seperti Bulk Export PDF) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)] w-fit">
          <button
            type="button"
            onClick={() => setViewMode("selection")}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
              viewMode === "selection"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            1. Seleksi data &amp; filter
          </button>

          <button
            type="button"
            onClick={() => {
              if (progress || migrationResult || migrating) {
                setViewMode("progress");
              }
            }}
            disabled={!progress && !migrationResult && !migrating}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "progress"
                ? "bg-blue-600 text-white shadow-xs"
                : progress || migrationResult
                  ? "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  : "opacity-40 cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-muted)]"
            }`}
          >
            {migrating && (
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            )}
            <span>2. Progres migrasi</span>
          </button>
        </div>
      </div>

      {/* MODE 1: SELEKSI & FILTER DATA LAPORAN */}
      {viewMode === "selection" && (
        <>
      {/* 1. Header Overview & Connection Status */}
      <div className="surface-card rounded-[24px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500 text-lg">📑</span>
              <div>
                <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Migrasi Laporan &amp; Dokumentasi Lengkap</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    Relasi Ketat 100%
                  </span>
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Memindahkan data laporan harian, rincian kegiatan, dan berkas foto dokumentasi ke database baru dengan mempertahankan struktur relasi, akun petugas, serta folder penyimpanan identik.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={performScan}
              disabled={loading || migrating}
              className="btn-secondary text-xs px-4 py-2.5 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50 rounded-xl"
            >
              {loading ? <SpinnerIcon /> : <span>↻</span>}
              <span>Pindai Ulang Data</span>
            </button>
          </div>
        </div>

        {/* Warning if disconnected */}
        {connectionStatus && !connectionStatus.canMigrate && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
            <span>⚠️</span>
            <span>{connectionStatus.error || "Kedua database harus terhubung untuk melakukan sinkronisasi."}</span>
          </div>
        )}

        {/* Storage-Direct Info */}
        {connectionStatus?.storageOnlyMode && (
          <div className="mt-4 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2.5">
            <span className="text-base leading-none">🛡️</span>
            <div className="leading-relaxed">
              <strong className="block font-bold">Mode Rekonstruksi Storage Aktif</strong>
              <span>
                Koneksi langsung ke Supabase Storage lama aktif. Sistem membaca berkas foto dan merekonstruksi laporan beserta aktivitas ke DB baru secara aman tanpa batasan kuota tabel database lama.
              </span>
            </div>
          </div>
        )}

        {/* Key KPI Metrics Grid */}
        {scanResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="p-4 rounded-2xl bg-[var(--surface-muted)]/35 border border-[var(--border-soft)]">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] block">Total Laporan Terdata</span>
              <strong className="text-lg font-black text-[var(--text-primary)] mt-0.5 block">
                {(scanResult.reportGroups?.length || 0).toLocaleString("id-ID")} Laporan
              </strong>
              <small className="text-[10px] text-[var(--text-muted)]">
                {scanResult.userGroups.length} akun petugas terikat
              </small>
            </div>

            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-[11px] font-semibold text-blue-500 block">Total Foto Dokumentasi</span>
              <strong className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
                {scanResult.totalItems.toLocaleString("id-ID")} Berkas
              </strong>
              <small className="text-[10px] text-blue-400">
                {formatMediaBytes(scanResult.totalBytes)} volume total
              </small>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-emerald-500 block">✓ Sudah Ada di DB Baru</span>
              <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {scanResult.alreadySyncedCount.toLocaleString("id-ID")} Berkas
              </strong>
              <small className="text-[10px] text-emerald-500 font-semibold">
                Terverifikasi aman &amp; tersinkron
              </small>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-500 block">⏳ Perlu Dimigrasikan</span>
              <strong className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                {scanResult.needsMigrationCount.toLocaleString("id-ID")} Berkas
              </strong>
              <small className="text-[10px] text-amber-500">
                Menunggu transfer ke DB Baru
              </small>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Periode Tanggal Laporan */}
      {scanResult && (
        <div className="surface-card rounded-[22px] p-4 sm:p-5 border border-[var(--border-soft)] shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500 text-sm">📅</span>
              <div>
                <span className="text-xs font-bold text-[var(--text-primary)] block">
                  Filter Periode Tanggal Laporan
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {startDate || endDate ? (
                    <span className="text-blue-500 font-semibold">
                      Aktif: {startDate || "Awal"} s/d {endDate || "Sekarang"} • Menampilkan {filteredReportGroups.length} laporan ({filteredTableItems.length} berkas)
                    </span>
                  ) : (
                    "Menampilkan seluruh periode laporan (tanpa pembatasan tanggal)"
                  )}
                </span>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "this_month", label: "Bulan Ini" },
                  { id: "last_month", label: "Bulan Lalu" },
                  { id: "last_30_days", label: "30 Hari Terakhir" },
                  { id: "last_7_days", label: "7 Hari Terakhir" },
                  { id: "custom", label: "Kustom" },
                ] as const
              ).map((p) => {
                const isActive = periodPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetChange(p.id)}
                    disabled={migrating}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-xs ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-soft)]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range inputs & Quick Select */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[var(--border-soft)] text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Dari Tanggal:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPeriodPreset("custom");
                  }}
                  disabled={migrating}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Sampai Tanggal:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPeriodPreset("custom");
                  }}
                  disabled={migrating}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)]"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => handlePresetChange("all")}
                  disabled={migrating}
                  className="text-xs px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-500/10 font-semibold transition cursor-pointer"
                >
                  ✕ Reset Filter Periode
                </button>
              )}
            </div>

            {/* Quick Actions for Filtered Period */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllFilteredReports}
                disabled={migrating || filteredReportGroups.length === 0}
                className="text-[11px] text-blue-500 hover:underline font-semibold cursor-pointer"
              >
                Pilih Semua di Periode Ini ({filteredReportGroups.length})
              </button>
              <span className="text-gray-400">·</span>
              <button
                type="button"
                onClick={deselectAllFilteredReports}
                disabled={migrating || filteredReportGroups.length === 0}
                className="text-[11px] text-[var(--text-muted)] hover:underline font-semibold cursor-pointer"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Primary Action Bar */}
      {scanResult && (
        <div className="surface-card rounded-[22px] p-4 sm:p-5 border border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-[var(--surface-app)] to-indigo-950/20 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Target Migrasi: {selectedReportCount} dari {scanResult.reportGroups?.length || 0} Laporan Terpilih</span>
            </span>
            <p className="text-[11px] text-[var(--text-muted)]">
              {skipAlreadySynced
                ? "Mode Resumable aktif: Berkas dan relasi yang sudah tersinkronisasi akan dilewati secara otomatis."
                : "Semua berkas terpilih akan ditimpa ulang (overwrite)."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {migrating ? (
              <button
                type="button"
                onClick={handleCancelMigration}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <SpinnerIcon />
                <span>Hentikan Migrasi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMigration}
                disabled={loading || migrating || selectedReportCount === 0}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white transition flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50"
              >
                <span>🚀</span>
                <span>Mulai Migrasi Laporan &amp; Dokumentasi</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Navigation View Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)] w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "reports"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>📑</span>
            <span>Kelompok Laporan &amp; Dokumentasi ({scanResult?.reportGroups?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "files"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>🖼️</span>
            <span>Daftar Berkas &amp; Audit ({scanResult?.items.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "settings"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>⚙️</span>
            <span>Pengaturan &amp; Petugas</span>
          </button>
        </div>

        {/* Global Options Pills */}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[var(--text-primary)] select-none">
            <input
              type="checkbox"
              checked={skipAlreadySynced}
              onChange={(e) => setSkipAlreadySynced(e.target.checked)}
              disabled={migrating}
              className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="text-[11px]">Lewati yang sudah ada</span>
          </label>
        </div>
      </div>

      {/* 4. Active Tab Content */}

      {/* TAB 1: REPORTS & DOCUMENTATION VIEW */}
      {activeTab === "reports" && scanResult && (
        <div className="space-y-4">
          {/* Filter Bar for Reports */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllReports(true)}
                disabled={migrating}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-blue-500 hover:text-blue-600 font-semibold cursor-pointer"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={() => toggleAllReports(false)}
                disabled={migrating}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold cursor-pointer"
              >
                Batalkan Pilihan
              </button>
              <span className="text-xs text-[var(--text-muted)] ml-2">
                Terpilih: <strong>{selectedReportCount}</strong> laporan
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter status */}
              <div className="flex items-center p-0.5 rounded-lg bg-[var(--surface-muted)]/40 border border-[var(--border-soft)] text-xs">
                <button
                  type="button"
                  onClick={() => setReportFilterStatus("all")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    reportFilterStatus === "all" ? "bg-blue-600 text-white" : "text-[var(--text-muted)]"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilterStatus("pending")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    reportFilterStatus === "pending" ? "bg-amber-600 text-white" : "text-[var(--text-muted)]"
                  }`}
                >
                  ⏳ Belum Lengkap
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilterStatus("synced")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    reportFilterStatus === "synced" ? "bg-emerald-600 text-white" : "text-[var(--text-muted)]"
                  }`}
                >
                  ✓ Lengkap di DB Baru
                </button>
              </div>

              {/* Search reports */}
              <input
                type="text"
                placeholder="Cari nama petugas / tanggal / tim..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)] placeholder-[var(--text-muted)] w-56"
              />
            </div>
          </div>

          {/* Report Cards List */}
          <div className="space-y-3">
            {filteredReportGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)] rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/15">
                Tidak ada laporan yang sesuai dengan filter pencarian.
              </div>
            ) : (
              filteredReportGroups.map((rep) => {
                const isSelected = Boolean(selectedReportIds[rep.reportId]);
                const isExpanded = Boolean(expandedReports[rep.reportId]);
                const isFullySynced = rep.needsMigrationCount === 0;

                return (
                  <div
                    key={rep.reportId}
                    className={`rounded-[20px] border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? "bg-[var(--surface-card)] border-blue-500/40 shadow-sm"
                        : "bg-[var(--surface-card)]/60 border-[var(--border-soft)] opacity-80"
                    }`}
                  >
                    {/* Report Header Bar */}
                    <div className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface-muted)]/15">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleReportSelection(rep.reportId)}
                          disabled={migrating}
                          className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0 cursor-pointer"
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                              {rep.reporterName}
                            </span>
                            {rep.tim && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                Tim {rep.tim}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">
                              Tgl: <strong>{rep.reportDate || "Tidak Terdata"}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                            <span>ID: <code className="text-gray-400">{rep.reportId.slice(0, 13)}...</code></span>
                            <span>•</span>
                            <span>{rep.activitiesCount} Aktivitas Terdata</span>
                            <span>•</span>
                            <span>{rep.totalPhotos} Berkas Foto ({formatMediaBytes(rep.totalBytes)})</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Status Badge & Expand Action */}
                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        {isFullySynced ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                            <span>✓</span>
                            <span>Lengkap di DB Baru</span>
                          </span>
                        ) : rep.isReportInTargetDb ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30 flex items-center gap-1.5">
                            <span>⏳</span>
                            <span>Teks Ada ({rep.syncedPhotosCount}/{rep.totalPhotos} Foto)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1.5">
                            <span>⏳</span>
                            <span>Belum Dimigrasikan</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleReportExpanded(rep.reportId)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-soft)] transition cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{isExpanded ? "Tutup" : "Lihat Detail & Foto"}</span>
                          <span className="text-[10px] font-bold">({rep.items.length})</span>
                          <span>{isExpanded ? "▲" : "▼"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Report Details: Activities and Photos */}
                    {isExpanded && (
                      <div className="p-4 border-t border-[var(--border-soft)] bg-black/5 space-y-4">
                        {/* Section A: Detail Aktivitas Laporan */}
                        {rep.activities && rep.activities.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                              <span>📝</span>
                              <span>Rangkaian Aktivitas Lapangan ({rep.activities.length} Kegiatan):</span>
                            </span>
                            <div className="space-y-2">
                              {rep.activities.map((act) => (
                                <div
                                  key={act.id}
                                  className="p-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card)] text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                        Aktivitas #{act.activityOrder}
                                      </span>
                                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                        ⏱ {act.startTimeText} - {act.endTimeText}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        act.isSynced
                                          ? "bg-emerald-500/10 text-emerald-500"
                                          : "bg-amber-500/10 text-amber-500"
                                      }`}
                                    >
                                      {act.isSynced ? "✓ Ada di DB Baru" : "Menunggu Migrasi"}
                                    </span>
                                  </div>
                                  <p className="text-[var(--text-primary)] font-medium leading-relaxed">
                                    {act.activityDescription}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Section B: Dokumentasi Kegiatan & Foto Lapangan */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                            <span className="flex items-center gap-1.5">
                              <span>📷</span>
                              <span>Dokumentasi Foto Lapangan ({rep.items.length} Foto):</span>
                            </span>
                          </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {rep.items.map((photo) => {
                            const isSynced = photo.status === "synced" || photo.status === "already_synced";
                            const isFailed = photo.status === "failed";

                            return (
                              <div
                                key={photo.id}
                                className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition ${
                                  isSynced
                                    ? "bg-emerald-500/5 border-emerald-500/30"
                                    : isFailed
                                      ? "bg-red-500/5 border-red-500/30"
                                      : "bg-[var(--surface-card)] border-[var(--border-soft)]"
                                }`}
                              >
                                <div className="space-y-1.5 min-w-0">
                                  {/* Status indicator header */}
                                  <div className="flex items-center justify-between gap-2">
                                    {isSynced ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                                        <span>✓</span>
                                        <span>Sudah Dimigrasi</span>
                                      </span>
                                    ) : isFailed ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/30">
                                        Gagal
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30">
                                        Menunggu Migrasi
                                      </span>
                                    )}

                                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                      {formatMediaBytes(photo.fileSize)}
                                    </span>
                                  </div>

                                  {/* File Name & Path */}
                                  <div className="min-w-0">
                                    <strong className="text-xs text-[var(--text-primary)] block truncate" title={photo.originalFileName}>
                                      {photo.originalFileName}
                                    </strong>
                                    <code className="text-[10px] text-[var(--text-muted)] font-mono block truncate" title={photo.storagePath}>
                                      {photo.storagePath}
                                    </code>
                                  </div>

                                  {/* Activity Info */}
                                  <div className="text-[11px] text-[var(--text-muted)] leading-tight pt-1 border-t border-black/5 dark:border-white/5">
                                    <span>Aktivitas #{photo.userRel.activityOrder || 1}: </span>
                                    <span className="text-[var(--text-primary)] font-medium">
                                      {photo.userRel.activityDescription || "Dokumentasi Lapangan"}
                                    </span>
                                  </div>
                                </div>

                                {/* Preview Button if migrated */}
                                {isSynced && (
                                  <div className="pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                      Tersimpan di Target Storage
                                    </span>
                                    <a
                                      href={photo.targetUrl || photo.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-500 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                                    >
                                      <span>Lihat Foto</span>
                                      <span>↗</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FLAT AUDIT FILE TABLE */}
      {activeTab === "files" && scanResult && (
        <div className="surface-card rounded-[22px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Daftar Seluruh Berkas &amp; Audit Relasi ({filteredTableItems.length} Baris)
              </h5>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Pemeriksaan status migrasi media per file, penanda database, dan tautan penyimpanan baru.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={tableFilterStatus}
                onChange={(e) => setTableFilterStatus(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)]"
              >
                <option value="all">Semua Status</option>
                <option value="pending">⏳ Belum Dimigrasi</option>
                <option value="synced">✓ Sudah Dimigrasi (Target DB)</option>
                <option value="failed">❌ Gagal</option>
              </select>

              <input
                type="text"
                placeholder="Cari file / path / petugas..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)]"
              >
              </input>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-muted)]/60 text-[var(--text-muted)] border-b border-[var(--border-soft)] text-[11px]">
                  <th className="py-2.5 px-3.5 font-bold">Status Migrasi</th>
                  <th className="py-2.5 px-3.5 font-bold">Nama File &amp; Path Storage</th>
                  <th className="py-2.5 px-3.5 font-bold">Terikat ke Laporan &amp; Petugas</th>
                  <th className="py-2.5 px-3.5 font-bold">Bucket</th>
                  <th className="py-2.5 px-3.5 font-bold">Ukuran</th>
                  <th className="py-2.5 px-3.5 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] font-mono text-[11px]">
                {filteredTableItems.slice(0, 100).map((it) => {
                  const isSynced = it.status === "synced" || it.status === "already_synced";
                  const isFailed = it.status === "failed";

                  return (
                    <tr key={it.id} className="hover:bg-[var(--surface-muted)]/20 transition">
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {isSynced ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <span>✓</span>
                            <span>Sudah Dimigrasi</span>
                          </span>
                        ) : isFailed ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/30">
                            Gagal
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 max-w-xs text-[var(--text-primary)]">
                        <span className="font-sans font-bold block truncate" title={it.originalFileName}>
                          {it.originalFileName}
                        </span>
                        <code className="text-[10px] text-[var(--text-muted)] block truncate" title={it.storagePath}>
                          {it.storagePath}
                        </code>
                      </td>
                      <td className="py-2.5 px-3.5 font-sans whitespace-nowrap">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
                          {it.userRel.userName}
                        </span>
                        {it.userRel.reportDate && (
                          <small className="text-[10px] text-[var(--text-muted)] block">
                            Tgl: {it.userRel.reportDate} {it.userRel.tim ? `· Tim ${it.userRel.tim}` : ""}
                          </small>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-[var(--text-muted)] font-sans">
                        {it.bucketId}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-[var(--text-primary)]">
                        {formatMediaBytes(it.fileSize)}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-sans">
                        {isSynced ? (
                          <a
                            href={it.targetUrl || it.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-500 hover:underline text-[11px] font-semibold flex items-center gap-1"
                          >
                            <span>Buka URL</span>
                            <span>↗</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTableItems.length > 100 && (
              <div className="p-2.5 text-center text-xs text-[var(--text-muted)] bg-[var(--surface-muted)]/20 border-t border-[var(--border-soft)]">
                Menampilkan 100 dari {filteredTableItems.length} berkas. Gunakan filter pencarian untuk membatasi hasil.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & USER SELECTION */}
      {activeTab === "settings" && scanResult && (
        <div className="surface-card rounded-[22px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm space-y-5">
          <div>
            <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Filter Target Penyimpanan &amp; Petugas
            </h5>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Sesuaikan bucket dan akun petugas yang diikutsertakan dalam migrasi.
            </p>
          </div>

          {/* Buckets */}
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] block mb-2">
              Bucket Penyimpanan Supabase:
            </span>
            <div className="flex flex-wrap gap-2.5">
              {scanResult.bucketGroups.map((b) => {
                const isSelected = selectedBucketIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBucket(b.id)}
                    disabled={migrating}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-[var(--surface-muted)]/30 border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>{b.id}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20">
                      {b.totalItems} file ({formatMediaBytes(b.totalBytes)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Users */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                Daftar Petugas ({scanResult.userGroups.length} Akun Terkait):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllUsers(true)}
                  disabled={migrating}
                  className="text-[11px] text-blue-500 hover:underline font-semibold cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-gray-400">·</span>
                <button
                  type="button"
                  onClick={() => toggleAllUsers(false)}
                  disabled={migrating}
                  className="text-[11px] text-blue-500 hover:underline font-semibold cursor-pointer"
                >
                  Batal Pilih
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Cari nama petugas..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full text-xs px-3.5 py-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)] placeholder-[var(--text-muted)] mb-3"
            />

            <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-2 space-y-1.5 bg-[var(--surface-app)]/30 scrollbar-thin">
              {filteredUserGroups.map((u) => {
                const isSelected = Boolean(selectedUserIds[u.id]);
                const isFullyMigrated = u.needsMigrationCount === 0;

                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30 text-[var(--text-primary)]"
                        : "bg-[var(--surface-muted)]/15 border-transparent text-[var(--text-muted)] opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 pointer-events-none"
                      />
                      <span className="font-semibold truncate">{u.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] shrink-0 font-mono">
                      <span>{u.totalPhotos} foto</span>
                      {isFullyMigrated ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                          ✓ Lengkap
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                          {u.needsMigrationCount} belum
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={includeOrphans}
                onChange={(e) => setIncludeOrphans(e.target.checked)}
                disabled={migrating}
                className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span>Sertakan berkas orphan di storage yang tidak memiliki data induk laporan</span>
            </label>
          </div>
        </div>
      )}
      </>
      )}

      {/* MODE 2: PROGRES MIGRASI (PERSIS SEPERTI PROGRES PDF BULK DOWNLOAD) */}
      {viewMode === "progress" && (
        <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-blue-500/20 shadow-sm animate-fadeIn">
          {/* Header Progress Page */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setViewMode("selection")}
                disabled={migrating}
                className="btn-secondary h-[40px] px-3 text-xs flex items-center gap-2 rounded-xl disabled:opacity-40 cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Kembali ke Seleksi Data</span>
              </button>
              <div>
                <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Progres Migrasi Laporan &amp; Dokumentasi</span>
                  {migrating ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse border border-blue-500/30 flex items-center gap-1">
                      <SpinnerIcon className="h-3 w-3 animate-spin" />
                      <span>Sedang Memigrasikan...</span>
                    </span>
                  ) : migrationResult?.success ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Selesai ✓
                    </span>
                  ) : migrationResult ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                      Terhenti / Gagal ✕
                    </span>
                  ) : null}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Memindahkan data teks laporan lengkap, detail aktivitas, dan berkas foto dokumentasi fisik dari Supabase lama ke database Supabase baru.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Total: {selectedReportGroups.length} Laporan Terpilih • {selectedActivitiesCount} Aktivitas • {selectedTotalPhotos} Foto
              </span>
            </div>
          </div>

          {/* Metric Status Cards & Progress Bar */}
          <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                {migrating ? (
                  <SpinnerIcon className="h-4 w-4 animate-spin text-blue-600" />
                ) : migrationResult?.success ? (
                  <span className="text-emerald-500 font-extrabold text-sm">✓</span>
                ) : (
                  <span className="text-red-500 font-extrabold text-sm">✕</span>
                )}
                <span className="font-extrabold">
                  {progress?.statusText || (migrating ? "Sedang memigrasikan data..." : migrationResult ? "Migrasi rampung." : "Siap bermigrasi.")}
                </span>
              </div>
              <div className="text-[var(--text-muted)]">
                {progress?.percent || (migrationResult ? 100 : 0)}% Selesai (
                {progress?.completedItems || (migrationResult ? migrationResult.totalItems : 0)} / {progress?.totalItems || selectedReportGroups.length} Diproses)
              </div>
            </div>

            {/* Main Animated Progress Bar */}
            <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  migrating
                    ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 animate-pulse"
                    : migrationResult?.success
                      ? "bg-emerald-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, progress?.percent || (migrationResult ? 100 : 0))}%` }}
              />
            </div>

            {/* Quick Metrics Grid (4 cards persis seperti bulk download) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Petugas Aktif</span>
                <p className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
                  {progress?.currentItem?.userRel.userName || (migrating ? "Memproses..." : "-")}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Laporan Termigrasi</span>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {migrationResult?.migratedReportsCount ?? progress?.completedItems ?? 0} / {selectedReportGroups.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Aktivitas Tercover</span>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {migrationResult?.migratedActivitiesCount ?? selectedActivitiesCount} Aktivitas
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Media &amp; Kuota</span>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {formatMediaBytes(progress?.transferredBytes || migrationResult?.transferredBytes || 0)}
                </p>
              </div>
            </div>

            {migrationResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold ${
                  migrationResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                }`}
              >
                <p className="font-bold text-sm mb-0.5">
                  {migrationResult.success
                    ? "✓ Seluruh Data Laporan & Dokumentasi Berhasil Dimigrasikan"
                    : "⚠ Migrasi Selesai dengan Catatan"}
                </p>
                <p>
                  Berhasil memigrasikan {migrationResult.migratedReportsCount || 0} laporan, {migrationResult.migratedActivitiesCount || 0} aktivitas, dan {migrationResult.successCount} berkas media ({formatMediaBytes(migrationResult.transferredBytes)}) tanpa ada data terduplikasi.
                </p>
              </div>
            )}
          </div>

          {/* Hierarchical Progress Tree View (persis seperti bulk download) */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
              <span>Struktur Antrean &amp; Status Laporan yang Dimigrasikan ({selectedReportGroups.length} Laporan)</span>
            </h5>

            <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs max-h-[500px] overflow-y-auto">
              {selectedReportGroups.map((rep, rIdx) => {
                const isCurrentlyMigrating = migrating && progress?.currentItem?.userRel.reportId === rep.reportId;
                const isDone = rep.isReportFullySynced || (migrationResult && migrationResult.success);

                return (
                  <div
                    key={rep.reportId}
                    className={`p-3.5 sm:p-4 space-y-2.5 transition ${
                      isCurrentlyMigrating
                        ? "bg-blue-500/10"
                        : isDone
                          ? "bg-emerald-500/5"
                          : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 flex items-center justify-center">
                          {isCurrentlyMigrating ? (
                            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/50 shadow-xs animate-pulse">
                              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                            </span>
                          ) : isDone ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/40 shadow-2xs">
                              ✓
                            </span>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-xs">
                              ○
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {rep.reporterName}
                          </span>
                          {rep.tim && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                              Tim {rep.tim}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-[var(--text-muted)] font-medium">
                            Tgl: <strong>{rep.reportDate || "Tidak Terdata"}</strong>
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">
                            (Laporan #{rIdx + 1} • {rep.activitiesCount} Aktivitas • {rep.totalPhotos} Foto)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrentlyMigrating && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1 animate-pulse">
                            <SpinnerIcon className="h-3 w-3 animate-spin" />
                            <span>Memproses...</span>
                          </span>
                        )}
                        {isDone && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Selesai Lengkap ✓
                          </span>
                        )}
                        {!isCurrentlyMigrating && !isDone && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--text-muted)]">
                            Menunggu Antrean
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sub-tree branch connector lines: Kegiatan & Foto */}
                    <div className="ml-3 pl-3.5 sm:pl-4 border-l-2 border-dashed border-blue-500/30 dark:border-blue-800/40 space-y-1.5 py-0.5">
                      {rep.activities && rep.activities.map((act) => (
                        <div
                          key={act.id}
                          className="flex flex-wrap items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl border border-[var(--border-soft)]/50 bg-[var(--surface-muted)]/20 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[var(--text-muted)] font-mono font-bold text-xs select-none">
                              └─
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">
                              Aktivitas #{act.activityOrder}
                            </span>
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">
                              (⏱ {act.startTimeText} - {act.endTimeText})
                            </span>
                            <span className="text-[var(--text-muted)] truncate max-w-xs sm:max-w-md">
                              • {act.activityDescription}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                              📷 {act.photosCount} Foto
                            </span>
                            <span className={`px-1.5 py-0.5 rounded ${act.isSynced ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
                              {act.isSynced ? "Tersinkron" : "Antrean"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Logs Console */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>📜</span>
                  <span>Log Riwayat Eksekusi Migrasi</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold cursor-pointer"
                >
                  Bersihkan Log
                </button>
              </div>

              <div
                ref={logBoxRef}
                className="w-full h-44 rounded-xl bg-black/80 p-3 font-mono text-[11px] text-gray-300 overflow-y-auto space-y-1 leading-relaxed border border-white/10"
              >
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={
                      log.includes("[BERHASIL]")
                        ? "text-emerald-400"
                        : log.includes("[ERROR]")
                          ? "text-red-400 font-bold"
                          : log.includes("[DEDUP]")
                            ? "text-blue-400"
                            : log.includes("[SELESAI]")
                              ? "text-sky-400 font-bold"
                              : "text-slate-300"
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
            <button
              type="button"
              onClick={() => setViewMode("selection")}
              disabled={migrating}
              className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40 cursor-pointer"
            >
              ← Kembali ke Seleksi Data
            </button>

            {migrating ? (
              <button
                type="button"
                onClick={handleCancelMigration}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <SpinnerIcon />
                <span>Hentikan Migrasi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode("selection")}
                className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Selesai &amp; Kembali
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
