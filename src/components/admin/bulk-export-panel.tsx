import { useEffect, useMemo, useState } from "react";
import {
  askConfirmation,
  showInfo
} from "../../lib/alerts";
import {
  buildInitialBulkPdfProgressState,
  executeBulkPdfDownload,
  getAllCombinedReports,
  type BulkPdfProgressState
} from "../../lib/browser-cache-recovery";
import {
  buildInitialBulkMonthlyPdfProgressState,
  executeBulkMonthlyPdfDownload,
  groupReportsForBulkMonthlyPdf,
  type BulkMonthlyPdfProgressState,
} from "../../lib/bulk-monthly-pdf-service";
import {
  buildInitialBulkWeeklyPdfProgressState,
  executeBulkWeeklyPdfDownload,
  groupReportsForBulkWeeklyPdf,
  type BulkWeeklyPdfProgressState,
} from "../../lib/bulk-weekly-pdf-service";
import {
  deduplicateReporterNames
} from "../../lib/reporter-name";
import { formatWitaDate } from "../../lib/time";
import type { Report } from "../../types/report";

import { SpinnerIcon } from "./shared";
const inputClassName = "field-input";

export function BulkExportPanel(props: {
  reports: Report[];
  bulkExporting: boolean;
  onHandleBulkExport: (reports: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupExcel?: (reports?: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupJson?: (
    reports?: Report[],
    userFilter?: string,
  ) => Promise<void>;
  deviceBackupExporting?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"selection" | "pdf-progress">(
    "selection",
  );
  const [paperFormat, setPaperFormat] = useState<
    "a4" | "f4" | "legal" | "letter"
  >("a4");
  const [sourceFilter, setSourceFilter] = useState<"all" | "db" | "local">(
    "all",
  );
  const [combinedReports, setCombinedReports] = useState<Report[]>(
    props.reports,
  );
  const [keyword, setKeyword] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "user_asc">(
    "newest",
  );
  const [selectedActivities, setSelectedActivities] = useState<
    Record<string, number[]>
  >({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedReports, setExpandedReports] = useState<
    Record<string, boolean>
  >({});
  const [livePdfProgressState, setLivePdfProgressState] =
    useState<BulkPdfProgressState | null>(null);
  const [pdfMode, setPdfMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [pdfEngine, setPdfEngine] = useState<"puppeteer" | "html2pdf">("puppeteer");
  const [liveWeeklyPdfProgressState, setLiveWeeklyPdfProgressState] =
    useState<BulkWeeklyPdfProgressState | null>(null);
  const [liveMonthlyPdfProgressState, setLiveMonthlyPdfProgressState] =
    useState<BulkMonthlyPdfProgressState | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfResult, setPdfResult] = useState<{
    success: boolean;
    downloadedCount: number;
    errors: string[];
  } | null>(null);
  const [exportProgressState, setExportProgressState] = useState<{
    type: "pdf" | "excel" | "json" | "zip";
    title: string;
    status: "running" | "completed" | "error";
    message: string;
    count: number;
    errorMessage?: string;
  } | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel" | "json" | "zip">("pdf");

  // Load both DB and Local draft reports so all reports are combined
  useEffect(() => {
    let active = true;
    const loadReports = async () => {
      try {
        const data = await getAllCombinedReports(props.reports);
        if (active) {
          setCombinedReports(data);
          const sel: Record<string, number[]> = {};
          const expU: Record<string, boolean> = {};
          data.forEach((r) => {
            sel[r.id] = (r.activities || []).map((a) => a.no);
            expU[r.nama] = true;
          });
          setSelectedActivities(sel);
          setExpandedUsers(expU);
        }
      } catch {
        if (active) setCombinedReports(props.reports);
      }
    };
    void loadReports();
    return () => {
      active = false;
    };
  }, [props.reports]);

  // Determine base dataset based on user's source filter ("all" | "db" | "local")
  const baseDataset = useMemo(() => {
    if (sourceFilter === "db") {
      return combinedReports.filter(
        (r) => r.source !== "local" && !r.id.startsWith("draft-"),
      );
    }
    if (sourceFilter === "local") {
      return combinedReports.filter(
        (r) => r.source === "local" || r.id.startsWith("draft-"),
      );
    }
    return combinedReports;
  }, [sourceFilter, combinedReports]);

  // Unique users for filter dropdown
  const allUniqueUsers = useMemo(() => {
    return deduplicateReporterNames(
      baseDataset.map((r) => r.nama || "Tanpa Nama"),
    ).sort((a, b) => a.localeCompare(b));
  }, [baseDataset]);

  // Filtering & Sorting
  const visibleReports = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return baseDataset
      .filter((report) => {
        if (
          selectedUserFilter !== "all" &&
          report.nama !== selectedUserFilter
        ) {
          return false;
        }
        if (
          search &&
          !report.nama.toLowerCase().includes(search) &&
          !report.reportDate.includes(search) &&
          !(report.activities || []).some((a) =>
            (a?.description || "").toLowerCase().includes(search),
          )
        ) {
          return false;
        }
        if (dateFrom && report.reportDate < dateFrom) return false;
        if (dateTo && report.reportDate > dateTo) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        if (sortMode === "newest") {
          const byDate = b.reportDate.localeCompare(a.reportDate);
          if (byDate !== 0) return byDate;
          return a.nama.localeCompare(b.nama);
        } else if (sortMode === "oldest") {
          const byDate = a.reportDate.localeCompare(b.reportDate);
          if (byDate !== 0) return byDate;
          return a.nama.localeCompare(b.nama);
        } else {
          const byUser = a.nama.localeCompare(b.nama);
          if (byUser !== 0) return byUser;
          return b.reportDate.localeCompare(a.reportDate);
        }
      });
  }, [baseDataset, keyword, selectedUserFilter, dateFrom, dateTo, sortMode]);

  // Group by User
  const groupedByUser = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const report of visibleReports) {
      const user = report.nama || "Tanpa Nama";
      if (!map.has(user)) {
        map.set(user, []);
      }
      map.get(user)!.push(report);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleReports]);

  // Selection metrics
  const selectedReports = useMemo(
    () =>
      visibleReports.filter((r) => (selectedActivities[r.id] || []).length > 0),
    [visibleReports, selectedActivities],
  );
  const selectedReportsCount = selectedReports.length;

  const selectedActivitiesCount = useMemo(() => {
    return visibleReports.reduce((sum, r) => {
      const sel = selectedActivities[r.id] || [];
      return sum + sel.length;
    }, 0);
  }, [visibleReports, selectedActivities]);

  const totalActivitiesCount = useMemo(() => {
    return visibleReports.reduce(
      (sum, r) => sum + (r.activities?.length || 0),
      0,
    );
  }, [visibleReports]);

  const selectedUsersCount = useMemo(() => {
    const selectedUserNames = selectedReports.map((r) => r.nama);
    return deduplicateReporterNames(selectedUserNames).length;
  }, [selectedReports]);

  // Weekly PDF grouping metrics
  const weeklyUserGroups = useMemo(() => {
    return groupReportsForBulkWeeklyPdf(visibleReports, selectedActivities);
  }, [visibleReports, selectedActivities]);

  const totalWeeklyDocsCount = useMemo(() => {
    return weeklyUserGroups.reduce((sum, u) => sum + u.weeks.length, 0);
  }, [weeklyUserGroups]);

  // Monthly PDF grouping metrics
  const monthlyUserGroups = useMemo(() => {
    return groupReportsForBulkMonthlyPdf(visibleReports, selectedActivities);
  }, [visibleReports, selectedActivities]);

  const totalMonthlyDocsCount = useMemo(() => {
    return monthlyUserGroups.reduce((sum, u) => sum + u.months.length, 0);
  }, [monthlyUserGroups]);

  // Selection handlers
  const toggleActivity = (reportId: string, activityNo: number) => {
    setSelectedActivities((prev) => {
      const current = prev[reportId] || [];
      const next = current.includes(activityNo)
        ? current.filter((no) => no !== activityNo)
        : [...current, activityNo];
      return { ...prev, [reportId]: next };
    });
  };

  const toggleReport = (report: Report) => {
    const allNos = (report.activities || []).map((a) => a.no);
    const current = selectedActivities[report.id] || [];
    const isAllSelected = allNos.length > 0 && current.length === allNos.length;
    setSelectedActivities((prev) => ({
      ...prev,
      [report.id]: isAllSelected ? [] : allNos,
    }));
  };

  const toggleUser = (userReports: Report[]) => {
    const isUserAllSelected = userReports.every((r) => {
      const selected = selectedActivities[r.id] || [];
      return (
        (r.activities || []).length > 0 &&
        selected.length === (r.activities || []).length
      );
    });
    setSelectedActivities((prev) => {
      const next = { ...prev };
      userReports.forEach((r) => {
        next[r.id] = isUserAllSelected
          ? []
          : (r.activities || []).map((a) => a.no);
      });
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedActivities((prev) => {
      const next = { ...prev };
      visibleReports.forEach((r) => {
        next[r.id] = (r.activities || []).map((a) => a.no);
      });
      return next;
    });
  };

  const clearAllVisible = () => {
    setSelectedActivities((prev) => {
      const next = { ...prev };
      visibleReports.forEach((r) => {
        next[r.id] = [];
      });
      return next;
    });
  };

  const toggleExpandUser = (user: string) => {
    setExpandedUsers((prev) => ({ ...prev, [user]: !prev[user] }));
  };

  const toggleExpandReport = (reportId: string) => {
    setExpandedReports((prev) => ({ ...prev, [reportId]: !prev[reportId] }));
  };

  // Bulk PDF Export Handler
  const handleStartBulkPdfExport = async () => {
    if (selectedReportsCount === 0) {
      await showInfo(
        "Pilih Data",
        "Pilih setidaknya satu laporan untuk diunduh sebagai dokumen PDF.",
      );
      return;
    }

    if (pdfMode === "weekly") {
      if (totalWeeklyDocsCount === 0) {
        await showInfo(
          "Pilih Data",
          "Tidak ada laporan yang dapat dikelompokkan ke dalam dokumen PDF mingguan.",
        );
        return;
      }

      const engineLabel =
        pdfEngine === "puppeteer"
          ? "Puppeteer (Kualitas Tinggi)"
          : "Browser (html2pdf)";

      const confirmed = await askConfirmation(
        "Export PDF Massal Mingguan (Per Bulan)",
        `Apakah Anda yakin ingin memulai export PDF massal mingguan untuk ${weeklyUserGroups.length} petugas (${totalWeeklyDocsCount} file bulanan yang memuat rekap per minggu) dari ${selectedReportsCount} laporan terpilih dengan format kertas ${paperFormat.toUpperCase()} menggunakan Engine ${engineLabel}?`,
        "Ya, Unduh PDF Mingguan",
      );
      if (!confirmed) return;

      const initialWeeklyPdfProgress = buildInitialBulkWeeklyPdfProgressState(
        weeklyUserGroups,
        selectedReportsCount,
      );
      setLiveWeeklyPdfProgressState(initialWeeklyPdfProgress);
      setLivePdfProgressState(null);
      setLiveMonthlyPdfProgressState(null);
      setExportProgressState({
        type: "pdf",
        title: "Export PDF Massal Mingguan",
        status: "running",
        message: "Memulai proses rendering dokumen PDF massal mingguan...",
        count: totalWeeklyDocsCount,
      });
      setViewMode("pdf-progress");
      setPdfResult(null);
      setPdfExporting(true);

      try {
        const result = await executeBulkWeeklyPdfDownload(
          visibleReports,
          selectedActivities,
          paperFormat,
          (state) => {
            setLiveWeeklyPdfProgressState({ ...state });
          },
          pdfEngine,
        );
        setPdfResult(result);
        if (result.success) {
          setExportProgressState((prev) =>
            prev
              ? {
                ...prev,
                status: "completed",
                message: `Selesai! ${result.downloadedCount} file PDF mingguan berhasil diunduh.`,
              }
              : null,
          );
        } else {
          setExportProgressState((prev) =>
            prev
              ? {
                ...prev,
                status: "error",
                message: "Gagal membuat sebagian file PDF mingguan",
                errorMessage: result.errors.join(", "),
              }
              : null,
          );
        }
      } catch (err: any) {
        setPdfResult({
          success: false,
          downloadedCount: 0,
          errors: [
            err?.message || "Kesalahan tak terduga saat membuat dokumen PDF mingguan",
          ],
        });
        setExportProgressState((prev) =>
          prev
            ? {
              ...prev,
              status: "error",
              message: "Gagal membuat dokumen PDF mingguan",
              errorMessage: err?.message,
            }
            : null,
        );
      } finally {
        setPdfExporting(false);
      }
      return;
    }

    if (pdfMode === "monthly") {
      if (totalMonthlyDocsCount === 0) {
        await showInfo(
          "Pilih Data",
          "Tidak ada laporan yang dapat dikelompokkan ke dalam dokumen PDF bulanan.",
        );
        return;
      }

      const engineLabel =
        pdfEngine === "puppeteer"
          ? "Puppeteer (Kualitas Tinggi)"
          : "Browser (html2pdf)";

      const confirmed = await askConfirmation(
        "Export PDF Massal Bulanan",
        `Apakah Anda yakin ingin memulai export PDF massal bulanan untuk ${monthlyUserGroups.length} petugas (${totalMonthlyDocsCount} dokumen bulanan) dari ${selectedReportsCount} laporan terpilih dengan format kertas ${paperFormat.toUpperCase()} menggunakan Engine ${engineLabel}?`,
        "Ya, Unduh PDF Bulanan",
      );
      if (!confirmed) return;

      const initialMonthlyPdfProgress = buildInitialBulkMonthlyPdfProgressState(
        monthlyUserGroups,
        selectedReportsCount,
      );
      setLiveMonthlyPdfProgressState(initialMonthlyPdfProgress);
      setLivePdfProgressState(null);
      setLiveWeeklyPdfProgressState(null);
      setExportProgressState({
        type: "pdf",
        title: "Export PDF Massal Bulanan",
        status: "running",
        message: "Memulai proses rendering dokumen PDF massal bulanan...",
        count: totalMonthlyDocsCount,
      });
      setViewMode("pdf-progress");
      setPdfResult(null);
      setPdfExporting(true);

      try {
        const result = await executeBulkMonthlyPdfDownload(
          visibleReports,
          selectedActivities,
          paperFormat,
          (state) => {
            setLiveMonthlyPdfProgressState({ ...state });
          },
          pdfEngine,
        );
        setPdfResult(result);
        if (result.success) {
          setExportProgressState((prev) =>
            prev
              ? {
                ...prev,
                status: "completed",
                message: `Selesai! ${result.downloadedCount} file PDF bulanan berhasil diunduh.`,
              }
              : null,
          );
        } else {
          setExportProgressState((prev) =>
            prev
              ? {
                ...prev,
                status: "error",
                message: "Gagal membuat sebagian file PDF bulanan",
                errorMessage: result.errors.join(", "),
              }
              : null,
          );
        }
      } catch (err: any) {
        setPdfResult({
          success: false,
          downloadedCount: 0,
          errors: [
            err?.message || "Kesalahan tak terduga saat membuat dokumen PDF bulanan",
          ],
        });
        setExportProgressState((prev) =>
          prev
            ? {
              ...prev,
              status: "error",
              message: "Gagal membuat dokumen PDF bulanan",
              errorMessage: err?.message,
            }
            : null,
        );
      } finally {
        setPdfExporting(false);
      }
      return;
    }

    const engineLabel =
      pdfEngine === "puppeteer"
        ? "Puppeteer (Kualitas Tinggi)"
        : "Browser (html2pdf)";

    const confirmed = await askConfirmation(
      "Export PDF Massal",
      `Apakah Anda yakin ingin memulai export PDF massal untuk ${selectedReportsCount} laporan terpilih dengan format kertas ${paperFormat.toUpperCase()} menggunakan Engine ${engineLabel}?`,
      "Ya, Unduh PDF",
    );
    if (!confirmed) return;

    const initialPdfProgress = buildInitialBulkPdfProgressState(
      visibleReports,
      selectedActivities,
    );
    setLivePdfProgressState(initialPdfProgress);
    setLiveWeeklyPdfProgressState(null);
    setLiveMonthlyPdfProgressState(null);
    setExportProgressState({
      type: "pdf",
      title: "Export PDF Massal Harian",
      status: "running",
      message: "Memulai proses rendering dokumen PDF massal...",
      count: selectedReportsCount,
    });
    setViewMode("pdf-progress");
    setPdfResult(null);
    setPdfExporting(true);

    try {
      const result = await executeBulkPdfDownload(
        visibleReports,
        selectedActivities,
        paperFormat,
        (state) => {
          setLivePdfProgressState({ ...state });
        },
        pdfEngine,
      );
      setPdfResult(result);
      if (result.success) {
        setExportProgressState((prev) =>
          prev
            ? {
              ...prev,
              status: "completed",
              message: `Selesai! ${result.downloadedCount} file PDF berhasil diunduh.`,
            }
            : null,
        );
      } else {
        setExportProgressState((prev) =>
          prev
            ? {
              ...prev,
              status: "error",
              message: "Gagal membuat sebagian file PDF",
              errorMessage: result.errors.join(", "),
            }
            : null,
        );
      }
    } catch (err: any) {
      setPdfResult({
        success: false,
        downloadedCount: 0,
        errors: [
          err?.message || "Kesalahan tak terduga saat membuat dokumen PDF",
        ],
      });
      setExportProgressState((prev) =>
        prev
          ? {
            ...prev,
            status: "error",
            message: "Gagal membuat dokumen PDF",
            errorMessage: err?.message,
          }
          : null,
      );
    } finally {
      setPdfExporting(false);
    }
  };

  const handleStartExcelExport = async () => {
    if (!props.onHandleDownloadDeviceBackupExcel) return;
    if (selectedReportsCount === 0) {
      await showInfo(
        "Pilih Data",
        "Pilih setidaknya satu laporan untuk diexport ke Excel.",
      );
      return;
    }
    setViewMode("pdf-progress");
    setExportProgressState({
      type: "excel",
      title: "Ekspor Excel Tab User",
      status: "running",
      message: `Menyusun data Excel untuk ${selectedReportsCount} laporan terpilih (${selectedUsersCount} petugas)...`,
      count: selectedReportsCount,
    });
    try {
      await props.onHandleDownloadDeviceBackupExcel(selectedReports);
      setExportProgressState({
        type: "excel",
        title: "Ekspor Excel Tab User",
        status: "completed",
        message: `Ekspor Excel berhasil! File cadangan berisi ${selectedReportsCount} laporan telah terunduh.`,
        count: selectedReportsCount,
      });
    } catch (err: any) {
      setExportProgressState({
        type: "excel",
        title: "Ekspor Excel Tab User",
        status: "error",
        message: "Gagal mengekspor data ke Excel.",
        count: selectedReportsCount,
        errorMessage:
          err?.message ||
          "Terjadi kesalahan tak terduga saat menyusun file Excel.",
      });
    }
  };

  const handleStartJsonExport = async () => {
    if (!props.onHandleDownloadDeviceBackupJson) return;
    if (selectedReportsCount === 0) {
      await showInfo(
        "Pilih Data",
        "Pilih setidaknya satu laporan untuk diexport ke JSON.",
      );
      return;
    }
    setViewMode("pdf-progress");
    setExportProgressState({
      type: "json",
      title: "Ekspor JSON Cadangan",
      status: "running",
      message: `Menyusun file JSON cadangan untuk ${selectedReportsCount} laporan terpilih...`,
      count: selectedReportsCount,
    });
    try {
      await props.onHandleDownloadDeviceBackupJson(selectedReports);
      setExportProgressState({
        type: "json",
        title: "Ekspor JSON Cadangan",
        status: "completed",
        message: `Ekspor JSON berhasil! File JSON cadangan berisi ${selectedReportsCount} laporan telah terunduh.`,
        count: selectedReportsCount,
      });
    } catch (err: any) {
      setExportProgressState({
        type: "json",
        title: "Ekspor JSON Cadangan",
        status: "error",
        message: "Gagal mengekspor file JSON cadangan.",
        count: selectedReportsCount,
        errorMessage:
          err?.message ||
          "Terjadi kesalahan tak terduga saat menyusun file JSON.",
      });
    }
  };

  const handleStartZipExport = async () => {
    if (selectedReportsCount === 0) {
      await showInfo(
        "Pilih Data",
        "Pilih setidaknya satu laporan untuk diexport ke ZIP.",
      );
      return;
    }
    setViewMode("pdf-progress");
    setExportProgressState({
      type: "zip",
      title: "Ekspor ZIP Excel Terpisah",
      status: "running",
      message: `Menyusun file arsip ZIP berisi Excel untuk ${selectedReportsCount} laporan terpilih...`,
      count: selectedReportsCount,
    });
    try {
      await props.onHandleBulkExport(selectedReports);
      setExportProgressState({
        type: "zip",
        title: "Ekspor ZIP Excel Terpisah",
        status: "completed",
        message: `Ekspor ZIP Excel berhasil! File arsip ZIP per petugas telah terunduh.`,
        count: selectedReportsCount,
      });
    } catch (err: any) {
      setExportProgressState({
        type: "zip",
        title: "Ekspor ZIP Excel Terpisah",
        status: "error",
        message: "Gagal mengekspor arsip ZIP Excel.",
        count: selectedReportsCount,
        errorMessage:
          err?.message ||
          "Terjadi kesalahan tak terduga saat menyusun file ZIP.",
      });
    }
  };

  return (
    <div className="settings-data-tools grid gap-5">
      <div className="settings-workflow-navigation">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("selection")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${viewMode === "selection"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              }`}
          >
            1. Pilih laporan
          </button>
          <button
            type="button"
            onClick={() => setViewMode("pdf-progress")}
            disabled={!livePdfProgressState && !liveWeeklyPdfProgressState && !liveMonthlyPdfProgressState && !exportProgressState}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${viewMode === "pdf-progress"
                ? "bg-emerald-600 text-white shadow-xs"
                : livePdfProgressState || exportProgressState
                  ? "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  : "opacity-40 cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}
          >
            {(pdfExporting ||
              props.deviceBackupExporting ||
              props.bulkExporting) && (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              )}
            <span>2. Progres unduhan</span>
          </button>
        </div>
      </div>

      {/* MODE 1: SELEKSI & FILTER */}
      {viewMode === "selection" && (
        <>
          {/* Card Filter & Pencarian */}
          <div className="surface-card rounded-[24px] p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {/* Cari Kata Kunci */}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Cari kata kunci / nama
                </span>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="mis.  Kebakaran"
                  className={inputClassName}
                />
              </label>

              {/* Filter Petugas */}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Filter Petugas
                </span>
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className={inputClassName}
                >
                  <option value="all">
                    Semua Petugas ({allUniqueUsers.length})
                  </option>
                  {allUniqueUsers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Sumber Data Filter */}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Sumber Data
                </span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as any)}
                  className={inputClassName}
                >
                  <option value="all">Semua (DB + Cache Lokal)</option>
                  <option value="db">Hanya Database Supabase</option>
                  <option value="local">Hanya Cache Lokal / Draft</option>
                </select>
              </label>

              {/* Urutkan */}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Urutan Laporan
                </span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as any)}
                  className={inputClassName}
                >
                  <option value="newest">Terbaru → Terlama</option>
                  <option value="oldest">Terlama → Terbaru</option>
                  <option value="user_asc">Nama Petugas A-Z</option>
                </select>
              </label>

              {/* Dari Tanggal */}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Dari Tanggal
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClassName}
                />
              </label>

              {/* Sampai Tanggal */}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Sampai Tanggal
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClassName}
                />
              </label>
            </div>

            {/* Sub-bar Filter & Aksi Terpilih */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)]">
              <p className="settings-hint" role="status" aria-live="polite">
                {visibleReports.length} laporan sesuai filter · {selectedReportsCount} laporan dipilih ({selectedActivitiesCount}/{totalActivitiesCount} aktivitas, {selectedUsersCount} petugas)
              </p>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="btn-secondary h-[36px] px-3 text-xs font-bold"
                >
                  Pilih Terlihat
                </button>
                <button
                  type="button"
                  onClick={clearAllVisible}
                  className="btn-secondary h-[36px] px-3 text-xs font-bold"
                >
                  Reset Pilihan
                </button>
              </div>
            </div>
          </div>

          <div className="settings-card settings-export-options">
            <div className="settings-card-heading">
              <h4>Format unduhan</h4>
              <p className="settings-hint">{selectedReportsCount} laporan dan {selectedActivitiesCount} aktivitas dipilih.</p>
            </div>
            <div className="settings-card-body grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="settings-label">Format berkas</span>
                <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as typeof exportFormat)} className="field-input">
                  <option value="pdf">PDF</option>
                  {props.onHandleDownloadDeviceBackupExcel && <option value="excel">Excel — lembar per petugas</option>}
                  {props.onHandleDownloadDeviceBackupJson && <option value="json">JSON — cadangan laporan</option>}
                  <option value="zip">ZIP — berkas Excel terpisah</option>
                </select>
              </label>
              {exportFormat === "pdf" && <>
                <label className="grid gap-2">
                  <span className="settings-label">Periode dokumen</span>
                  <select value={pdfMode} onChange={(event) => setPdfMode(event.target.value as typeof pdfMode)} className="field-input">
                    <option value="daily">Harian</option>
                    <option value="weekly">Mingguan</option>
                    <option value="monthly">Bulanan</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="settings-label">Ukuran kertas</span>
                  <select value={paperFormat} onChange={(event) => setPaperFormat(event.target.value as typeof paperFormat)} className="field-input">
                    <option value="a4">A4</option><option value="f4">F4</option><option value="legal">Legal</option><option value="letter">Letter</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="settings-label">Pemrosesan PDF</span>
                  <select value={pdfEngine} onChange={(event) => setPdfEngine(event.target.value as typeof pdfEngine)} className="field-input">
                    <option value="puppeteer">Server — kualitas cetak</option>
                    <option value="html2pdf">Perangkat ini</option>
                  </select>
                </label>
              </>}
            </div>
            <div className="settings-card-footer">
              <span className="settings-hint mr-auto">
                {exportFormat === "pdf" && pdfMode !== "daily" ? `${pdfMode === "weekly" ? totalWeeklyDocsCount : totalMonthlyDocsCount} dokumen ${pdfMode === "weekly" ? "mingguan" : "bulanan"}` : "Pilih laporan pada daftar di bawah sebelum mengunduh."}
              </span>
              <button
                type="button"
                className="btn-primary"
                disabled={pdfExporting || props.bulkExporting || props.deviceBackupExporting || selectedReportsCount === 0 || (exportFormat === "pdf" && ((pdfMode === "weekly" && totalWeeklyDocsCount === 0) || (pdfMode === "monthly" && totalMonthlyDocsCount === 0)))}
                onClick={() => {
                  if (exportFormat === "pdf") void handleStartBulkPdfExport();
                  else if (exportFormat === "excel") void handleStartExcelExport();
                  else if (exportFormat === "json") void handleStartJsonExport();
                  else void handleStartZipExport();
                }}
              >
                {(pdfExporting || props.bulkExporting || props.deviceBackupExporting) && <SpinnerIcon />}
                Unduh {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>

          {/* Grouped Tree List per User */}
          {groupedByUser.length === 0 ? (
            <div className="surface-card rounded-[24px] p-8 text-center text-sm text-[var(--text-muted)] space-y-2">
              <p className="font-semibold text-[var(--text-primary)]">
                Tidak ada laporan yang sesuai dengan filter.
              </p>
              <p className="text-xs">
                Coba ubah kata kunci pencarian, sumber data, atau rentang
                tanggal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByUser.map(([userName, userReports]) => {
                const isExpanded = expandedUsers[userName] ?? true;
                const isUserAllSelected = userReports.every((r) => {
                  const selected = selectedActivities[r.id] || [];
                  return (
                    r.activities.length > 0 &&
                    selected.length === r.activities.length
                  );
                });
                const isUserSomeSelected = userReports.some((r) => {
                  const selected = selectedActivities[r.id] || [];
                  return selected.length > 0;
                });

                return (
                  <div
                    key={userName}
                    className="surface-card rounded-[24px] p-4 sm:p-5 space-y-3 border border-[var(--border-soft)] shadow-2xs"
                  >
                    {/* User Node Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border-soft)]/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isUserAllSelected}
                          ref={(el) => {
                            if (el)
                              el.indeterminate =
                                !isUserAllSelected && isUserSomeSelected;
                          }}
                          onChange={() => toggleUser(userReports)}
                          className="h-4 w-4 accent-[var(--primary)] cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-[var(--text-primary)] truncate">
                            {userName}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-muted)]">
                            {userReports.length} Laporan
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpandUser(userName)}
                        className="btn-secondary h-[34px] px-3 text-xs font-bold flex items-center gap-1.5"
                      >
                        <span>{isExpanded ? "Tutup" : "Buka"}</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""
                            }`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {/* User Reports List */}
                    {isExpanded && (
                      <div className="grid gap-3 pl-2 sm:pl-4 border-l-2 border-[var(--border-soft)]">
                        {userReports.map((report) => {
                          const isReportExpanded =
                            expandedReports[report.id] ?? false;
                          const allNos = (report.activities || []).map(
                            (a) => a.no,
                          );
                          const selNos = selectedActivities[report.id] || [];
                          const isReportAllSelected =
                            allNos.length > 0 &&
                            selNos.length === allNos.length;
                          const isReportSomeSelected =
                            selNos.length > 0 && selNos.length < allNos.length;
                          const isDraft =
                            report.source === "local" ||
                            report.id.startsWith("draft-");

                          return (
                            <div
                              key={report.id}
                              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-3 sm:p-4 space-y-2"
                            >
                              {/* Report Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isReportAllSelected}
                                    ref={(el) => {
                                      if (el)
                                        el.indeterminate = isReportSomeSelected;
                                    }}
                                    onChange={() => toggleReport(report)}
                                    className="h-4 w-4 accent-[var(--primary)] cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">
                                      {formatWitaDate(report.reportDate)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                      Tim {report.tim || "TRC"}
                                    </span>
                                    {isDraft ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                        Draft Lokal
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                        DB Synced
                                      </span>
                                    )}
                                    <span className="text-xs text-[var(--text-muted)]">
                                      • {selNos.length}/
                                      {report.activities.length} Aktivitas
                                      terpilih
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleExpandReport(report.id)}
                                  className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>
                                    {isReportExpanded
                                      ? "Sembunyikan Rincian"
                                      : "Lihat Rincian Aktivitas"}
                                  </span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`h-3.5 w-3.5 transition-transform ${isReportExpanded ? "rotate-180" : ""
                                      }`}
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                              </div>

                              {/* Expanded Activities List */}
                              {isReportExpanded && (
                                <div className="mt-2 pl-6 space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                                  {report.activities.map((act) => {
                                    const isActSelected = selNos.includes(
                                      act.no,
                                    );
                                    return (
                                      <label
                                        key={act.no}
                                        className="flex items-start gap-2.5 py-1 px-2 rounded-lg hover:bg-[var(--surface-muted)] cursor-pointer text-xs"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isActSelected}
                                          onChange={() =>
                                            toggleActivity(report.id, act.no)
                                          }
                                          className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
                                        />
                                        <span className="font-bold text-[var(--text-muted)] shrink-0">
                                          #{act.no}
                                        </span>
                                        <span className="text-[var(--text-primary)] line-clamp-2 min-w-0">
                                          {act.description}
                                        </span>
                                        {act.photos &&
                                          act.photos.length > 0 && (
                                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                                              {act.photos.length} Foto
                                            </span>
                                          )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODE 2: PROGRES EXPORT DOKUMEN PAGE */}
      {viewMode === "pdf-progress" && (
        <>
          {/* A. Progress Card for Excel / JSON / ZIP Export */}
          {exportProgressState && exportProgressState.type !== "pdf" && (
            <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-emerald-500/20 shadow-sm animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("selection")}
                    disabled={
                      props.deviceBackupExporting || props.bulkExporting
                    }
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
                      <span>Progres {exportProgressState.title}</span>
                      {exportProgressState.status === "running" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse border border-emerald-500/30 flex items-center gap-1">
                          <SpinnerIcon className="h-3 w-3 animate-spin" />
                          <span>Memproses...</span>
                        </span>
                      ) : exportProgressState.status === "completed" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Selesai ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                          Gagal ✕
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Progres ekspor dokumen massal ke perangkat Anda.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Target: {exportProgressState.count} Laporan Terpilih
                  </span>
                </div>
              </div>

              <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    {exportProgressState.status === "running" ? (
                      <SpinnerIcon className="h-4 w-4 animate-spin text-emerald-600" />
                    ) : exportProgressState.status === "completed" ? (
                      <span className="text-emerald-500 font-extrabold text-sm">
                        ✓
                      </span>
                    ) : (
                      <span className="text-red-500 font-extrabold text-sm">
                        ✕
                      </span>
                    )}
                    <span>{exportProgressState.message}</span>
                  </div>
                  <div className="text-[var(--text-muted)]">
                    {exportProgressState.status === "running"
                      ? "Sedang Mengolah Dokumen..."
                      : exportProgressState.status === "completed"
                        ? "100% Selesai & Terunduh"
                        : "Proses Terhenti"}
                  </div>
                </div>

                <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${exportProgressState.status === "running"
                        ? "bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 animate-pulse w-3/4"
                        : exportProgressState.status === "completed"
                          ? "bg-emerald-500 w-full"
                          : "bg-red-500 w-full"
                      }`}
                  />
                </div>

                {exportProgressState.errorMessage && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-medium">
                    <strong>Detail Kesalahan:</strong>{" "}
                    {exportProgressState.errorMessage}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
                <button
                  type="button"
                  onClick={() => setViewMode("selection")}
                  disabled={props.deviceBackupExporting || props.bulkExporting}
                  className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40 cursor-pointer"
                >
                  ← Kembali ke Seleksi Data
                </button>

                {exportProgressState.status !== "running" && (
                  <button
                    type="button"
                    onClick={() => setViewMode("selection")}
                    className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    Selesai &amp; Kembali
                  </button>
                )}
              </div>
            </div>
          )}

          {/* B1. Progress Page for Weekly PDF Massal Export */}
          {pdfMode === "weekly" &&
            liveWeeklyPdfProgressState &&
            (!exportProgressState || exportProgressState.type === "pdf") && (
              <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-rose-500/20 shadow-sm animate-fadeIn">
                {/* Header Progress PDF Page */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("selection")}
                      disabled={pdfExporting}
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
                        <span>Progres unduhan PDF Massal Mingguan</span>
                        {pdfExporting ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse border border-rose-500/30">
                            Sedang Merender...
                          </span>
                        ) : liveWeeklyPdfProgressState.overallStatus ===
                          "completed" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Selesai
                          </span>
                        ) : null}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Mengunduh dokumen PDF rekap mingguan konsolidasi per petugas secara otomatis ke perangkat Anda.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      Total: {liveWeeklyPdfProgressState.totalUsers} Petugas •{" "}
                      {liveWeeklyPdfProgressState.totalWeeklyDocs} Dokumen Mingguan •{" "}
                      {liveWeeklyPdfProgressState.totalReports} Laporan
                    </span>
                  </div>
                </div>

                {/* Metric Status Cards & Progress Bar */}
                <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      {pdfExporting ? (
                        <SpinnerIcon className="h-4 w-4 animate-spin text-rose-600" />
                      ) : (
                        <span className="text-emerald-500">✓</span>
                      )}
                      <span className="font-extrabold">
                        {liveWeeklyPdfProgressState.currentMessage}
                      </span>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {liveWeeklyPdfProgressState.totalWeeklyDocs > 0
                        ? Math.round(
                          (liveWeeklyPdfProgressState.completedDocsCount /
                            liveWeeklyPdfProgressState.totalWeeklyDocs) *
                          100,
                        )
                        : 0}
                      % Selesai ({liveWeeklyPdfProgressState.completedDocsCount}/
                      {liveWeeklyPdfProgressState.totalWeeklyDocs} Dokumen)
                    </div>
                  </div>

                  {/* Main Animated Progress Bar */}
                  <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 via-purple-600 to-emerald-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${liveWeeklyPdfProgressState.totalWeeklyDocs > 0
                            ? Math.min(
                              100,
                              (liveWeeklyPdfProgressState.completedDocsCount /
                                liveWeeklyPdfProgressState.totalWeeklyDocs) *
                              100,
                            )
                            : 0
                          }%`,
                      }}
                    />
                  </div>

                  {/* Quick Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Petugas Aktif
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
                        {liveWeeklyPdfProgressState.currentUserName || "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Dokumen Terunduh
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {liveWeeklyPdfProgressState.completedDocsCount} /{" "}
                        {liveWeeklyPdfProgressState.totalWeeklyDocs}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Laporan Tercover
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {liveWeeklyPdfProgressState.totalReports} Laporan
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Ukuran Kertas
                      </span>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5 uppercase">
                        {paperFormat}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hierarchical Progress Tree View */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                    <span>Struktur Antrean &amp; Status Dokumen PDF Mingguan</span>
                  </h5>

                  <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
                    {liveWeeklyPdfProgressState.users.map((userGroup, uIdx) => {
                      const isUserRendering = userGroup.status === "rendering";
                      const isUserSuccess = userGroup.status === "success";
                      const isUserError = userGroup.status === "error";

                      return (
                        <div
                          key={userGroup.userName}
                          className={`p-3.5 sm:p-4 space-y-2.5 transition ${isUserRendering
                              ? "bg-rose-500/5"
                              : isUserError
                                ? "bg-red-500/5"
                                : ""
                            }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="shrink-0 flex items-center justify-center">
                                {isUserRendering ? (
                                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/50 shadow-xs animate-pulse">
                                    <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                                  </span>
                                ) : isUserSuccess ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/40 shadow-2xs">
                                    ✓
                                  </span>
                                ) : isUserError ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/40 shadow-2xs">
                                    ✕
                                  </span>
                                ) : (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-xs">
                                    ○
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                  {userGroup.userName}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                  Tim {userGroup.teamName}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                                  (Petugas #{uIdx + 1} •{" "}
                                  {userGroup.completedWeeks}/
                                  {userGroup.totalWeeks} Dokumen Mingguan selesai)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isUserRendering && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                  <SpinnerIcon className="h-3 w-3 animate-spin" />
                                  <span>Memproses Rekap...</span>
                                </span>
                              )}
                              {isUserSuccess && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  Dokumen Selesai ✓
                                </span>
                              )}
                              {isUserError && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                                  Error ✕
                                </span>
                              )}
                              {userGroup.status === "pending" && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                  Menunggu Antrean
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="ml-3 pl-3.5 sm:pl-4 border-l-2 border-dashed border-rose-500/30 dark:border-rose-800/40 space-y-1.5 py-0.5">
                            {userGroup.weeks.map((weekItem) => {
                              const isWeekRendering =
                                weekItem.status === "rendering";
                              const isWeekSuccess =
                                weekItem.status === "success";
                              const isWeekError = weekItem.status === "error";

                              return (
                                <div
                                  key={weekItem.id}
                                  className={`flex flex-wrap items-center justify-between gap-2.5 py-2 px-3 rounded-xl border transition-all text-xs ${isWeekRendering
                                      ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/20"
                                      : isWeekSuccess
                                        ? "bg-[var(--surface-muted)]/30 border-emerald-500/20"
                                        : isWeekError
                                          ? "bg-red-500/10 border-red-500/30"
                                          : "bg-[var(--surface-muted)]/15 border-transparent opacity-75"
                                    }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-[var(--text-muted)] font-mono font-bold text-xs select-none">
                                      └─
                                    </span>

                                    <div className="shrink-0 flex items-center justify-center">
                                      {isWeekRendering ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/25 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/50 animate-spin">
                                          <SpinnerIcon className="h-3 w-3" />
                                        </span>
                                      ) : isWeekSuccess ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                          ✓
                                        </span>
                                      ) : isWeekError ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-[10px] border border-red-500/30">
                                          ✕
                                        </span>
                                      ) : (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-[9px]">
                                          ○
                                        </span>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex flex-col gap-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-[var(--text-primary)]">
                                          Laporan Mingguan • {weekItem.periodLabel} ({weekItem.totalWeeksCount || weekItem.weeks?.length || 0} Minggu)
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                          1 File Bulanan (TTD Kabid di Akhir Bulan)
                                        </span>
                                        <span className="text-[var(--text-muted)] text-[11px]">
                                          • {weekItem.totalActivitiesCount} Total Aktivitas
                                        </span>
                                        <span className="text-[10.5px] font-mono text-[var(--text-muted)] opacity-80 truncate max-w-xs sm:max-w-md">
                                          ({weekItem.pdfFileName})
                                        </span>
                                        {weekItem.errorMessage && (
                                          <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                            ({weekItem.errorMessage})
                                          </span>
                                        )}
                                      </div>

                                      {/* Rincian minggu dalam file bulanan ini */}
                                      {weekItem.weeks && weekItem.weeks.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                          {weekItem.weeks.map((subWeek) => (
                                            <span
                                              key={subWeek.weekKey}
                                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20"
                                            >
                                              {subWeek.weekLabel} ({subWeek.periodLabel}):{" "}
                                              <strong
                                                className={
                                                  subWeek.showDivisionHead
                                                    ? "text-purple-600 dark:text-purple-400"
                                                    : ""
                                                }
                                              >
                                                {subWeek.showDivisionHead
                                                  ? "TTD Koord + Kabid"
                                                  : "TTD Koord"}
                                              </strong>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {isWeekRendering && (
                                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 animate-pulse text-[11px]">
                                        <SpinnerIcon className="h-3 w-3 animate-spin" />
                                        <span>Merender PDF...</span>
                                      </span>
                                    )}
                                    {isWeekSuccess && (
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                        Dokumen Terunduh ✓
                                      </span>
                                    )}
                                    {isWeekError && (
                                      <span className="font-bold text-red-600 dark:text-red-400 text-[11px]">
                                        Gagal ✕
                                      </span>
                                    )}
                                    {weekItem.status === "pending" && (
                                      <span className="text-[11px] text-[var(--text-muted)] italic">
                                        Menunggu...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Footer on Progress Page */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
                  <button
                    type="button"
                    onClick={() => setViewMode("selection")}
                    disabled={pdfExporting}
                    className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40 cursor-pointer"
                  >
                    ← Kembali ke Seleksi Data
                  </button>

                  {pdfResult && (
                    <button
                      type="button"
                      onClick={() => setViewMode("selection")}
                      className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      Selesai &amp; Kembali
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* B2. Progress Page for Monthly PDF Massal Export */}
          {pdfMode === "monthly" &&
            liveMonthlyPdfProgressState &&
            (!exportProgressState || exportProgressState.type === "pdf") && (
              <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-rose-500/20 shadow-sm animate-fadeIn">
                {/* Header Progress PDF Page */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("selection")}
                      disabled={pdfExporting}
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
                        <span>Progres unduhan PDF Massal Bulanan</span>
                        {pdfExporting ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse border border-rose-500/30">
                            Sedang Merender...
                          </span>
                        ) : liveMonthlyPdfProgressState.overallStatus ===
                          "completed" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Selesai
                          </span>
                        ) : null}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Mengunduh dokumen PDF rekap bulanan konsolidasi per petugas secara otomatis ke perangkat Anda.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      Total: {liveMonthlyPdfProgressState.totalUsers} Petugas •{" "}
                      {liveMonthlyPdfProgressState.totalMonthlyDocs} Dokumen Bulanan •{" "}
                      {liveMonthlyPdfProgressState.totalReports} Laporan
                    </span>
                  </div>
                </div>

                {/* Metric Status Cards & Progress Bar */}
                <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      {pdfExporting ? (
                        <SpinnerIcon className="h-4 w-4 animate-spin text-rose-600" />
                      ) : (
                        <span className="text-emerald-500">✓</span>
                      )}
                      <span className="font-extrabold">
                        {liveMonthlyPdfProgressState.currentMessage}
                      </span>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {liveMonthlyPdfProgressState.totalMonthlyDocs > 0
                        ? Math.round(
                          (liveMonthlyPdfProgressState.completedDocsCount /
                            liveMonthlyPdfProgressState.totalMonthlyDocs) *
                          100,
                        )
                        : 0}
                      % Selesai ({liveMonthlyPdfProgressState.completedDocsCount}/
                      {liveMonthlyPdfProgressState.totalMonthlyDocs} Dokumen)
                    </div>
                  </div>

                  {/* Main Animated Progress Bar */}
                  <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 via-purple-600 to-emerald-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${liveMonthlyPdfProgressState.totalMonthlyDocs > 0
                            ? Math.min(
                              100,
                              (liveMonthlyPdfProgressState.completedDocsCount /
                                liveMonthlyPdfProgressState.totalMonthlyDocs) *
                              100,
                            )
                            : 0
                          }%`,
                      }}
                    />
                  </div>

                  {/* Quick Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Petugas Aktif
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
                        {liveMonthlyPdfProgressState.currentUserName || "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Dokumen Terunduh
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {liveMonthlyPdfProgressState.completedDocsCount} /{" "}
                        {liveMonthlyPdfProgressState.totalMonthlyDocs}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Laporan Tercover
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {liveMonthlyPdfProgressState.totalReports} Laporan
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Ukuran Kertas
                      </span>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5 uppercase">
                        {paperFormat}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hierarchical Progress Tree View */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                    <span>Struktur Antrean &amp; Status Dokumen PDF Bulanan</span>
                  </h5>

                  <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
                    {liveMonthlyPdfProgressState.users.map((userGroup, uIdx) => {
                      const isUserRendering = userGroup.status === "rendering";
                      const isUserSuccess = userGroup.status === "success";
                      const isUserError = userGroup.status === "error";

                      return (
                        <div
                          key={userGroup.userName}
                          className={`p-3.5 sm:p-4 space-y-2.5 transition ${isUserRendering
                              ? "bg-rose-500/5"
                              : isUserError
                                ? "bg-red-500/5"
                                : ""
                            }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="shrink-0 flex items-center justify-center">
                                {isUserRendering ? (
                                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/50 shadow-xs animate-pulse">
                                    <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                                  </span>
                                ) : isUserSuccess ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/40 shadow-2xs">
                                    ✓
                                  </span>
                                ) : isUserError ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/40 shadow-2xs">
                                    ✕
                                  </span>
                                ) : (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-xs">
                                    ○
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                  {userGroup.userName}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                  Tim {userGroup.teamName}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                                  (Petugas #{uIdx + 1} •{" "}
                                  {userGroup.completedMonths}/
                                  {userGroup.totalMonths} Dokumen Bulanan selesai)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isUserRendering && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                  <SpinnerIcon className="h-3 w-3 animate-spin" />
                                  <span>Memproses Rekap...</span>
                                </span>
                              )}
                              {isUserSuccess && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  Dokumen Selesai ✓
                                </span>
                              )}
                              {isUserError && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                                  Error ✕
                                </span>
                              )}
                              {userGroup.status === "pending" && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                  Menunggu Antrean
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="ml-3 pl-3.5 sm:pl-4 border-l-2 border-dashed border-rose-500/30 dark:border-rose-800/40 space-y-1.5 py-0.5">
                            {userGroup.months.map((monthItem) => {
                              const isMonthRendering =
                                monthItem.status === "rendering";
                              const isMonthSuccess =
                                monthItem.status === "success";
                              const isMonthError = monthItem.status === "error";

                              return (
                                <div
                                  key={monthItem.id}
                                  className={`flex flex-wrap items-center justify-between gap-2.5 py-2 px-3 rounded-xl border transition-all text-xs ${isMonthRendering
                                      ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/20"
                                      : isMonthSuccess
                                        ? "bg-[var(--surface-muted)]/30 border-emerald-500/20"
                                        : isMonthError
                                          ? "bg-red-500/10 border-red-500/30"
                                          : "bg-[var(--surface-muted)]/15 border-transparent opacity-75"
                                    }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-[var(--text-muted)] font-mono font-bold text-xs select-none">
                                      └─
                                    </span>

                                    <div className="shrink-0 flex items-center justify-center">
                                      {isMonthRendering ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/25 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/50 animate-spin">
                                          <SpinnerIcon className="h-3 w-3" />
                                        </span>
                                      ) : isMonthSuccess ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                          ✓
                                        </span>
                                      ) : isMonthError ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-[10px] border border-red-500/30">
                                          ✕
                                        </span>
                                      ) : (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-[9px]">
                                          ○
                                        </span>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-[var(--text-primary)]">
                                        {monthItem.periodLabel}
                                      </span>
                                      <span className="text-[var(--text-muted)] text-[11px]">
                                        • {monthItem.reports.length} Hari Laporan • {monthItem.totalActivitiesCount} Aktivitas
                                      </span>
                                      <span className="text-[10.5px] font-mono text-[var(--text-muted)] opacity-80 truncate max-w-xs sm:max-w-md">
                                        ({monthItem.pdfFileName})
                                      </span>
                                      {monthItem.errorMessage && (
                                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                          ({monthItem.errorMessage})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {isMonthRendering && (
                                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 animate-pulse text-[11px]">
                                        <SpinnerIcon className="h-3 w-3 animate-spin" />
                                        <span>Merender PDF...</span>
                                      </span>
                                    )}
                                    {isMonthSuccess && (
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                        Dokumen Terunduh ✓
                                      </span>
                                    )}
                                    {isMonthError && (
                                      <span className="font-bold text-red-600 dark:text-red-400 text-[11px]">
                                        Gagal ✕
                                      </span>
                                    )}
                                    {monthItem.status === "pending" && (
                                      <span className="text-[11px] text-[var(--text-muted)] italic">
                                        Menunggu...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Footer on Progress Page */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
                  <button
                    type="button"
                    onClick={() => setViewMode("selection")}
                    disabled={pdfExporting}
                    className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40 cursor-pointer"
                  >
                    ← Kembali ke Seleksi Data
                  </button>

                  {pdfResult && (
                    <button
                      type="button"
                      onClick={() => setViewMode("selection")}
                      className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      Selesai &amp; Kembali
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* B3. Progress Page for Daily PDF Massal Export */}
          {pdfMode === "daily" &&
            livePdfProgressState &&
            (!exportProgressState || exportProgressState.type === "pdf") && (
              <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-rose-500/20 shadow-sm animate-fadeIn">
                {/* Header Progress PDF Page */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("selection")}
                      disabled={pdfExporting}
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
                        <span>Progres unduhan PDF Massal Harian</span>
                        {pdfExporting ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse border border-rose-500/30">
                            Sedang Merender...
                          </span>
                        ) : livePdfProgressState.overallStatus ===
                          "completed" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Selesai
                          </span>
                        ) : null}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Mengunduh dokumen PDF harian per petugas secara otomatis
                        ke perangkat Anda.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      Total: {livePdfProgressState.totalUsers} Petugas •{" "}
                      {livePdfProgressState.totalReports} PDF •{" "}
                      {livePdfProgressState.totalActivities} Aktivitas
                    </span>
                  </div>
                </div>

                {/* Metric Status Cards & Progress Bar */}
                <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      {pdfExporting ? (
                        <SpinnerIcon className="h-4 w-4 animate-spin text-rose-600" />
                      ) : (
                        <span className="text-emerald-500">✓</span>
                      )}
                      <span className="font-extrabold">
                        {livePdfProgressState.currentMessage}
                      </span>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {livePdfProgressState.totalReports > 0
                        ? Math.round(
                          (livePdfProgressState.downloadedReportsCount /
                            livePdfProgressState.totalReports) *
                          100,
                        )
                        : 0}
                      % Selesai ({livePdfProgressState.downloadedReportsCount}/
                      {livePdfProgressState.totalReports} File PDF)
                    </div>
                  </div>

                  {/* Main Animated Progress Bar */}
                  <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 via-purple-600 to-emerald-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${livePdfProgressState.totalReports > 0
                            ? Math.min(
                              100,
                              (livePdfProgressState.downloadedReportsCount /
                                livePdfProgressState.totalReports) *
                              100,
                            )
                            : 0
                          }%`,
                      }}
                    />
                  </div>

                  {/* Quick Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Petugas Aktif
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
                        {livePdfProgressState.currentUserName || "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        PDF Terunduh
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {livePdfProgressState.downloadedReportsCount} /{" "}
                        {livePdfProgressState.totalReports}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Aktivitas Tercover
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {livePdfProgressState.downloadedActivitiesCount} /{" "}
                        {livePdfProgressState.totalActivities}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        Ukuran Kertas
                      </span>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5 uppercase">
                        {paperFormat}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hierarchical Progress Tree View */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                    <span>Struktur Antrean &amp; Status Download PDF</span>
                  </h5>

                  <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
                    {livePdfProgressState.users.map((userGroup, uIdx) => {
                      const isUserDownloading =
                        userGroup.status === "downloading";
                      const isUserSuccess = userGroup.status === "success";
                      const isUserError = userGroup.status === "error";

                      return (
                        <div
                          key={userGroup.userName}
                          className={`p-3.5 sm:p-4 space-y-2.5 transition ${isUserDownloading
                              ? "bg-rose-500/5"
                              : isUserError
                                ? "bg-red-500/5"
                                : ""
                            }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="shrink-0 flex items-center justify-center">
                                {isUserDownloading ? (
                                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/50 shadow-xs animate-pulse">
                                    <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                                  </span>
                                ) : isUserSuccess ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/40 shadow-2xs">
                                    ✓
                                  </span>
                                ) : isUserError ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/40 shadow-2xs">
                                    ✕
                                  </span>
                                ) : (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-xs">
                                    ○
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                  {userGroup.userName}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                                  (Petugas #{uIdx + 1} •{" "}
                                  {userGroup.completedReports}/
                                  {userGroup.totalReports} PDF selesai)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isUserDownloading && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                  <SpinnerIcon className="h-3 w-3 animate-spin" />
                                  <span>Merender PDF...</span>
                                </span>
                              )}
                              {isUserSuccess && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  PDF Selesai ✓
                                </span>
                              )}
                              {isUserError && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                                  Error ✕
                                </span>
                              )}
                              {userGroup.status === "pending" && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                  Menunggu Antrean
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="ml-3 pl-3.5 sm:pl-4 border-l-2 border-dashed border-rose-500/30 dark:border-rose-800/40 space-y-1.5 py-0.5">
                            {userGroup.reports.map((reportItem) => {
                              const isRepDownloading =
                                reportItem.status === "downloading";
                              const isRepSuccess =
                                reportItem.status === "success";
                              const isRepError = reportItem.status === "error";

                              return (
                                <div
                                  key={reportItem.reportId}
                                  className={`flex flex-wrap items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl border transition-all text-xs ${isRepDownloading
                                      ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/20"
                                      : isRepSuccess
                                        ? "bg-[var(--surface-muted)]/30 border-emerald-500/20"
                                        : isRepError
                                          ? "bg-red-500/10 border-red-500/30"
                                          : "bg-[var(--surface-muted)]/15 border-transparent opacity-75"
                                    }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-[var(--text-muted)] font-mono font-bold text-xs select-none">
                                      └─
                                    </span>

                                    <div className="shrink-0 flex items-center justify-center">
                                      {isRepDownloading ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/25 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/50 animate-spin">
                                          <SpinnerIcon className="h-3 w-3" />
                                        </span>
                                      ) : isRepSuccess ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                          ✓
                                        </span>
                                      ) : isRepError ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-[10px] border border-red-500/30">
                                          ✕
                                        </span>
                                      ) : (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-[9px]">
                                          ○
                                        </span>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-[var(--text-primary)]">
                                        {formatWitaDate(reportItem.reportDate)}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                        Tim {reportItem.tim || "TRC"}
                                      </span>
                                      <span className="text-[var(--text-muted)] text-[11px]">
                                        • {reportItem.activitiesCount} Aktivitas
                                      </span>
                                      {reportItem.errorMessage && (
                                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                          ({reportItem.errorMessage})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {isRepDownloading && (
                                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 animate-pulse text-[11px]">
                                        <SpinnerIcon className="h-3 w-3 animate-spin" />
                                        <span>Merender PDF...</span>
                                      </span>
                                    )}
                                    {isRepSuccess && (
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                        Dokumen Terunduh ✓
                                      </span>
                                    )}
                                    {isRepError && (
                                      <span className="font-bold text-red-600 dark:text-red-400 text-[11px]">
                                        Gagal ✕
                                      </span>
                                    )}
                                    {reportItem.status === "pending" && (
                                      <span className="text-[11px] text-[var(--text-muted)] italic">
                                        Menunggu...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Footer on Progress Page */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
                  <button
                    type="button"
                    onClick={() => setViewMode("selection")}
                    disabled={pdfExporting}
                    className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40 cursor-pointer"
                  >
                    ← Kembali ke Seleksi Data
                  </button>

                  {pdfResult && (
                    <button
                      type="button"
                      onClick={() => setViewMode("selection")}
                      className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      Selesai &amp; Kembali
                    </button>
                  )}
                </div>
              </div>
            )}
        </>
      )}

    </div>
  );
}

