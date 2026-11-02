import { saveAs } from "file-saver";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  askConfirmation,
  showError,
  showInfo,
  showSuccess,
} from "../../lib/alerts";
import {
  buildInitialBulkUploadProgressState,
  deleteDeviceBackupReports,
  getAllDeviceBackupReports,
  parseDeviceBackupJsonFile,
  type BulkUploadItemProgress,
  type BulkUploadProgressState,
  type BulkUploadResult
} from "../../lib/browser-cache-recovery";
import {
  deduplicateReporterNames,
  isSameReporterName,
} from "../../lib/reporter-name";
import { formatWitaDate, getWitaToday } from "../../lib/time";
import type { Report } from "../../types/report";

import { SpinnerIcon } from "./shared";
const inputClassName = "field-input";

export function BulkUploadPanel(props: {
  reports: Report[];
  onHandleBulkUploadDeviceBackup?: (
    backupReports: Report[],
    selectedActivitiesByReportId: Record<string, number[]>,
    conflictResolutions?: Record<string, "overwrite" | "skip">,
    onItemProgress?: (progress: BulkUploadItemProgress) => void,
    onProgressStateChange?: (state: BulkUploadProgressState) => void,
  ) => Promise<BulkUploadResult>;
  deviceBackupBulkUploading?: boolean;
  onRefreshReports?: () => Promise<void> | void;
}) {
  const [viewMode, setViewMode] = useState<"selection" | "progress">(
    "selection",
  );
  const [sourceType, setSourceType] = useState<"device" | "json">("device");
  const [deviceReports, setDeviceReports] = useState<Report[]>([]);
  const [importedReports, setImportedReports] = useState<Report[]>([]);
  const [importedFileName, setImportedFileName] = useState("");
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const [syncStatusFilter, setSyncStatusFilter] = useState<
    "all" | "draft" | "synced"
  >("all");
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
  const [liveProgressState, setLiveProgressState] =
    useState<BulkUploadProgressState | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(
    null,
  );
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingItems, setConflictingItems] = useState<
    Array<{ backupReport: Report; dbReport: Report; }>
  >([]);
  const [conflictResolutions, setConflictResolutions] = useState<
    Record<string, "overwrite" | "skip">
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromDevice = async () => {
    setDeviceLoading(true);
    setUploadResult(null);
    try {
      const data = await getAllDeviceBackupReports(props.reports);
      setDeviceReports(data);
      const sel: Record<string, number[]> = {};
      const expU: Record<string, boolean> = {};
      data.forEach((r) => {
        sel[r.id] = (r.activities || []).map((a) => a.no);
        expU[r.nama] = true;
      });
      setSelectedActivities(sel);
      setExpandedUsers(expU);
    } catch {
      // safe fallback
    } finally {
      setDeviceLoading(false);
    }
  };

  useEffect(() => {
    void loadFromDevice();
  }, [props.reports]);

  const handleJsonFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirmed = await askConfirmation(
      "Impor File JSON Cadangan",
      `Apakah Anda yakin ingin mengimpor data laporan cadangan dari file "${file.name}"?`,
      "Ya, Impor File",
    );
    if (!confirmed) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    try {
      setImportedFileName(file.name);
      const parsed = await parseDeviceBackupJsonFile(file);
      setImportedReports(parsed);
      setSourceType("json");
      setUploadResult(null);
      const sel: Record<string, number[]> = {};
      const expU: Record<string, boolean> = {};
      parsed.forEach((r) => {
        sel[r.id] = (r.activities || []).map((a) => a.no);
        expU[r.nama] = true;
      });
      setSelectedActivities(sel);
      setExpandedUsers(expU);
    } catch (err: any) {
      await showError(
        "Gagal Membaca JSON",
        "Gagal membaca file JSON: " + (err?.message || "Format tidak valid"),
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const currentDataset =
    sourceType === "device" ? deviceReports : importedReports;

  // Daftar nama user unik untuk dropdown filter
  const allUniqueUsers = useMemo(() => {
    return deduplicateReporterNames(
      currentDataset.map((r) => r.nama || "Tanpa Nama"),
    ).sort((a, b) => a.localeCompare(b));
  }, [currentDataset]);

  // Logika Filtering & Sorting
  const visibleReports = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return currentDataset
      .filter((report) => {
        // Filter user
        if (
          selectedUserFilter !== "all" &&
          report.nama !== selectedUserFilter
        ) {
          return false;
        }

        // Filter status sync database
        const isDraft =
          report.source === "local" || report.id.startsWith("draft-");
        if (syncStatusFilter === "draft" && !isDraft) return false;
        if (syncStatusFilter === "synced" && isDraft) return false;

        // Search kata kunci
        if (
          q &&
          !report.nama.toLowerCase().includes(q) &&
          !report.reportDate.includes(q) &&
          !(report.activities || []).some((a) =>
            (a?.description || "").toLowerCase().includes(q),
          )
        ) {
          return false;
        }

        // Filter tanggal
        if (dateFrom && report.reportDate < dateFrom) {
          return false;
        }
        if (dateTo && report.reportDate > dateTo) {
          return false;
        }

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
  }, [
    currentDataset,
    keyword,
    selectedUserFilter,
    syncStatusFilter,
    dateFrom,
    dateTo,
    sortMode,
  ]);

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

  // Statistik Ringkasan Data
  const totalActivitiesCount = useMemo(() => {
    return visibleReports.reduce(
      (sum, r) => sum + (r.activities?.length || 0),
      0,
    );
  }, [visibleReports]);

  const totalPhotosCount = useMemo(() => {
    return visibleReports.reduce((sum, r) => {
      const photoSum = (r.activities || []).reduce(
        (p, a) => p + (a.photos?.length || 0),
        0,
      );
      return sum + photoSum;
    }, 0);
  }, [visibleReports]);

  const totalVisibleActivities = totalActivitiesCount;

  const selectedReportsCount = useMemo(() => {
    return visibleReports.filter(
      (r) => (selectedActivities[r.id] || []).length > 0,
    ).length;
  }, [visibleReports, selectedActivities]);

  const selectedActivitiesCount = useMemo(() => {
    return visibleReports.reduce((sum, r) => {
      const sel = selectedActivities[r.id] || [];
      return sum + sel.length;
    }, 0);
  }, [visibleReports, selectedActivities]);

  const selectedUsersCount = useMemo(() => {
    const selectedUserNames = visibleReports
      .filter((r) => (selectedActivities[r.id] || []).length > 0)
      .map((r) => r.nama);
    return deduplicateReporterNames(selectedUserNames).length;
  }, [visibleReports, selectedActivities]);

  const draftReportsCount = useMemo(() => {
    return currentDataset.filter(
      (r) => r.source === "local" || r.id.startsWith("draft-"),
    ).length;
  }, [currentDataset]);

  const syncedReportsCount = useMemo(() => {
    return currentDataset.length - draftReportsCount;
  }, [currentDataset, draftReportsCount]);

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

  const expandAll = () => {
    const expU: Record<string, boolean> = {};
    const expR: Record<string, boolean> = {};
    visibleReports.forEach((r) => {
      expU[r.nama] = true;
      expR[r.id] = true;
    });
    setExpandedUsers(expU);
    setExpandedReports(expR);
  };

  const collapseAll = () => {
    setExpandedUsers({});
    setExpandedReports({});
  };

  const handleDeleteSingleReport = async (report: Report) => {
    const confirmed = await askConfirmation(
      "Hapus Cadangan Laporan",
      `Hapus cadangan laporan tanggal ${formatWitaDate(report.reportDate)} (${report.nama})? Data lokal ini akan dihapus permanen dari browser.`,
      "Ya, Hapus",
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteDeviceBackupReports([report.id]);
      await showSuccess("Sukses", "Cadangan laporan berhasil dihapus.");
      await loadFromDevice();
    } catch (err: any) {
      await showInfo(
        "Gagal",
        "Gagal menghapus cadangan: " +
        (err?.message || "Kesalahan tak terduga"),
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    const selectedIds = visibleReports
      .filter((r) => (selectedActivities[r.id] || []).length > 0)
      .map((r) => r.id);

    if (selectedIds.length === 0) {
      await showInfo(
        "Pilih Data",
        "Pilih setidaknya satu laporan cadangan untuk dihapus.",
      );
      return;
    }

    const confirmed = await askConfirmation(
      "Hapus Cadangan Terpilih",
      `Hapus ${selectedIds.length} laporan cadangan terpilih dari browser? Data lokal ini akan dihapus secara permanen.`,
      "Ya, Hapus Semua",
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteDeviceBackupReports(selectedIds);
      await showSuccess(
        "Sukses",
        `${selectedIds.length} cadangan laporan berhasil dihapus.`,
      );
      await loadFromDevice();
    } catch (err: any) {
      await showInfo(
        "Gagal",
        "Gagal menghapus cadangan: " +
        (err?.message || "Kesalahan tak terduga"),
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleExportSelectedJson = async () => {
    const reportsToExport = visibleReports.filter(
      (r) => (selectedActivities[r.id] || []).length > 0,
    );
    const target =
      reportsToExport.length > 0 ? reportsToExport : visibleReports;
    if (target.length === 0) {
      void showInfo(
        "Informasi",
        "Tidak ada data cadangan yang dapat diexport.",
      );
      return;
    }
    const confirmed = await askConfirmation(
      "Export Cadangan JSON",
      `Apakah Anda yakin ingin mengunduh file JSON cadangan dari ${target.length} laporan terpilih?`,
      "Ya, Unduh JSON",
    );
    if (!confirmed) return;

    const jsonStr = JSON.stringify(target, null, 2);
    const blob = new Blob([jsonStr], {
      type: "application/json;charset=utf-8",
    });
    const filename = `cadangan-silahar-${getWitaToday()}-${target.length}-laporan.json`;
    saveAs(blob, filename);
    void showSuccess(
      "Sukses Export",
      `Berhasil mengunduh JSON cadangan (${target.length} laporan).`,
    );
  };

  const executeUploadProcess = async (
    resolutions?: Record<string, "overwrite" | "skip">,
  ) => {
    setShowConflictModal(false);
    const initialProgress = buildInitialBulkUploadProgressState(
      currentDataset,
      selectedActivities,
    );
    setLiveProgressState(initialProgress);
    setViewMode("progress");
    setUploadResult(null);

    try {
      const result = await props.onHandleBulkUploadDeviceBackup!(
        currentDataset,
        selectedActivities,
        resolutions,
        undefined,
        (state) => {
          setLiveProgressState({ ...state });
        },
      );
      setUploadResult(result);
      if (result.progressState) {
        setLiveProgressState(result.progressState);
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        uploadedReportsCount: 0,
        uploadedActivitiesCount: 0,
        errors: [err?.message || "Kesalahan tak terduga saat upload"],
      });
    }
  };

  const handleStartUpload = async () => {
    if (!props.onHandleBulkUploadDeviceBackup) return;
    if (selectedActivitiesCount === 0) {
      await showInfo(
        "Pilih Data",
        "Pilih setidaknya satu aktivitas untuk diunggah ke database.",
      );
      return;
    }

    const confirmed = await askConfirmation(
      "Upload Cadangan ke Database",
      `Apakah Anda yakin ingin mengunggah ${selectedActivitiesCount} aktivitas dari ${selectedReportsCount} laporan cadangan terpilih ke database Supabase?`,
      "Ya, Lanjutkan Upload",
    );
    if (!confirmed) return;

    // Deteksi Bentrok / Konflik Duplikasi Tanggal di Database
    const selectedReports = visibleReports.filter(
      (r) => (selectedActivities[r.id] || []).length > 0,
    );

    const conflicts: Array<{ backupReport: Report; dbReport: Report; }> = [];
    for (const backupReport of selectedReports) {
      const matchingDbReport = props.reports.find(
        (dbR) =>
          !dbR.id.startsWith("draft-") &&
          dbR.source !== "local" &&
          isSameReporterName(dbR.nama, backupReport.nama) &&
          dbR.reportDate === backupReport.reportDate,
      );
      if (matchingDbReport) {
        conflicts.push({ backupReport, dbReport: matchingDbReport });
      }
    }

    if (conflicts.length > 0) {
      const initialResolutions: Record<string, "overwrite" | "skip"> = {};
      conflicts.forEach((c) => {
        initialResolutions[c.backupReport.id] = "overwrite";
      });
      setConflictResolutions(initialResolutions);
      setConflictingItems(conflicts);
      setShowConflictModal(true);
    } else {
      await executeUploadProcess({});
    }
  };

  return (
    <div className="settings-data-tools grid gap-5">
      {/* Kartu Header & Pilihan Sumber Cadangan */}
      <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-[var(--border-soft)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceType("device");
                void loadFromDevice();
              }}
              disabled={
                deviceLoading || props.deviceBackupBulkUploading || deleting
              }
              className={`h-[42px] px-4 text-xs font-bold rounded-xl transition flex items-center gap-2 border cursor-pointer ${sourceType === "device"
                  ? "bg-purple-600 text-white border-purple-600 shadow-md"
                  : "bg-[var(--surface-muted)] text-[var(--text-primary)] border-[var(--border-soft)] hover:bg-[var(--surface-panel-strong)]"
                }`}
            >
              {deviceLoading ? (
                <SpinnerIcon />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect width="20" height="14" x="2" y="3" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              )}
              <span>Data Perangkat Ini ({deviceReports.length})</span>
            </button>

            <label
              className={`h-[42px] px-4 text-xs font-bold rounded-xl transition flex items-center gap-2 border cursor-pointer ${props.deviceBackupBulkUploading || deleting
                  ? "opacity-50 pointer-events-none"
                  : ""
                } ${sourceType === "json"
                  ? "bg-purple-600 text-white border-purple-600 shadow-md"
                  : "bg-[var(--surface-muted)] text-[var(--text-primary)] border-[var(--border-soft)] hover:bg-[var(--surface-panel-strong)]"
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonFileUpload}
                disabled={props.deviceBackupBulkUploading || deleting}
                className="hidden"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span>
                {importedFileName
                  ? `File: ${importedFileName.slice(0, 16)}...`
                  : "Impor cadangan JSON"}
              </span>
            </label>


          </div>
        </div>

        {/* Dynamic Metric Cards Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Total Cadangan
            </span>
            <div className="text-xl font-extrabold text-[var(--text-primary)]">
              {currentDataset.length}{" "}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Laporan
              </span>
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] truncate">
              {visibleReports.length} laporan sesuai filter
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Total Aktivitas
            </span>
            <div className="text-xl font-extrabold text-[var(--text-primary)]">
              {totalActivitiesCount}{" "}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Rincian
              </span>
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] truncate">
              {selectedActivitiesCount} terpilih
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Lampiran Foto
            </span>
            <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
              {totalPhotosCount}{" "}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Foto
              </span>
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] truncate">
              Tersimpan di cache
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Status Database
            </span>
            <div className="flex items-center gap-2 text-xs font-bold mt-1">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {draftReportsCount} Draft
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {syncedReportsCount} DB
              </span>
            </div>
          </div>
        </div>

        {/* Security & Safety Note & View Switcher */}
        <div className="pt-3 border-t border-[var(--border-soft)]/50 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold text-sm">✓</span>
            <span className="font-medium">
              Mengunggah cadangan tidak menghapus salinan lokal. Gunakan aksi Hapus untuk menghapus cadangan yang dipilih.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("selection")}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${viewMode === "selection"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                }`}
            >
              1. Kelola &amp; Seleksi
            </button>
            <button
              type="button"
              onClick={() => setViewMode("progress")}
              disabled={!liveProgressState}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${viewMode === "progress"
                  ? "bg-purple-600 text-white shadow-xs"
                  : liveProgressState
                    ? "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    : "opacity-40 cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-muted)]"
                }`}
            >
              {props.deviceBackupBulkUploading && (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>2. Progres Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: PROGRES UPLOAD PAGE (DEDICATED TREE PROGRESS VIEW) */}
      {/* ========================================================= */}
      {viewMode === "progress" && liveProgressState && (
        <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-purple-500/20 shadow-sm animate-fadeIn">
          {/* Header Progress Page */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setViewMode("selection")}
                disabled={props.deviceBackupBulkUploading}
                className="btn-secondary h-[40px] px-3 text-xs flex items-center gap-2 rounded-xl disabled:opacity-40"
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
                <span>Kembali ke Kelola Data</span>
              </button>
              <div>
                <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Progres Sinkronisasi Bertahap ke Database</span>
                  {props.deviceBackupBulkUploading ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-purple-500/20 text-purple-600 dark:text-purple-400 animate-pulse border border-purple-500/30">
                      Sedang Berjalan...
                    </span>
                  ) : liveProgressState.overallStatus === "completed" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Selesai
                    </span>
                  ) : null}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Mengunggah data cadangan secara bertahap per user dan per
                  laporan ke Supabase.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Total: {liveProgressState.totalUsers} Petugas •{" "}
                {liveProgressState.totalReports} Laporan •{" "}
                {liveProgressState.totalActivities} Aktivitas
              </span>
            </div>
          </div>

          {/* Metric Status Cards & Progress Bar */}
          <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                {props.deviceBackupBulkUploading ? (
                  <SpinnerIcon className="h-4 w-4 animate-spin text-purple-600" />
                ) : (
                  <span className="text-emerald-500">✓</span>
                )}
                <span className="font-extrabold">
                  {liveProgressState.currentMessage}
                </span>
              </div>
              <div className="text-[var(--text-muted)]">
                {liveProgressState.totalReports > 0
                  ? Math.round(
                    (liveProgressState.uploadedReportsCount /
                      liveProgressState.totalReports) *
                    100,
                  )
                  : 0}
                % Selesai ({liveProgressState.uploadedReportsCount}/
                {liveProgressState.totalReports} Laporan)
              </div>
            </div>

            {/* Main Animated Progress Bar */}
            <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${liveProgressState.totalReports > 0
                      ? Math.min(
                        100,
                        (liveProgressState.uploadedReportsCount /
                          liveProgressState.totalReports) *
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
                  {liveProgressState.currentUserName || "-"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                  Laporan Diproses
                </span>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {liveProgressState.uploadedReportsCount} /{" "}
                  {liveProgressState.totalReports}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                  Aktivitas Terunggah
                </span>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {liveProgressState.uploadedActivitiesCount} /{" "}
                  {liveProgressState.totalActivities}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                  Status Keamanan
                </span>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Cache Utuh 100%
                </p>
              </div>
            </div>
          </div>

          {/* Hierarchical Progress Tree View */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
              <span>Struktur Antrean &amp; Status Unggah</span>
            </h5>

            <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
              {liveProgressState.users.map((userGroup, uIdx) => {
                const isUserUploading = userGroup.status === "uploading";
                const isUserSuccess = userGroup.status === "success";
                const isUserError = userGroup.status === "error";

                return (
                  <div
                    key={userGroup.userName}
                    className={`p-3.5 sm:p-4 space-y-2.5 transition ${isUserUploading
                        ? "bg-purple-500/5"
                        : isUserError
                          ? "bg-red-500/5"
                          : ""
                      }`}
                  >
                    {/* Level 1: Compact User Progress Node ('o user') */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 flex items-center justify-center">
                          {isUserUploading ? (
                            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/50 shadow-xs animate-pulse">
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
                            (Petugas #{uIdx + 1} • {userGroup.completedReports}/
                            {userGroup.totalReports} selesai)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUserUploading && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                            <SpinnerIcon className="h-3 w-3 animate-spin" />
                            <span>Mengunggah...</span>
                          </span>
                        )}
                        {isUserSuccess && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Selesai ✓
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

                    {/* Level 2: Nested Reports Nodes ('- o date') */}
                    <div className="ml-3 pl-3.5 sm:pl-4 border-l-2 border-dashed border-purple-500/30 dark:border-purple-800/40 space-y-1.5 py-0.5">
                      {userGroup.reports.map((reportItem) => {
                        const isRepUploading =
                          reportItem.status === "uploading";
                        const isRepSuccess = reportItem.status === "success";
                        const isRepError = reportItem.status === "error";

                        return (
                          <div
                            key={reportItem.reportId}
                            className={`flex flex-wrap items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl border transition-all text-xs ${isRepUploading
                                ? "bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20"
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
                                {isRepUploading ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/25 text-purple-600 dark:text-purple-300 font-bold border border-purple-500/50 animate-spin">
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
                                  • {reportItem.selectedActivitiesCount}{" "}
                                  Aktivitas
                                </span>
                                {reportItem.errorMessage && (
                                  <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                    ({reportItem.errorMessage})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isRepUploading && (
                                <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 animate-pulse text-[11px]">
                                  <SpinnerIcon className="h-3 w-3 animate-spin" />
                                  <span>Mengunggah...</span>
                                </span>
                              )}
                              {isRepSuccess && (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  Tersinkronisasi ✓
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
              disabled={props.deviceBackupBulkUploading}
              className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40"
            >
              ← Kembali ke Kelola Data
            </button>

            {uploadResult && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("selection");
                    void loadFromDevice();
                  }}
                  className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                >
                  Selesai &amp; Muat Ulang Data
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: SELECTION & MANAGEMENT VIEW (FULL FILTERING & ACTIONS) */}
      {/* ========================================================= */}
      {viewMode === "selection" && (
        <>
          {/* ─── Filter & Search Card ─── */}
          <div className="surface-card rounded-[24px] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-purple-500 shrink-0"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Filter & Pencarian
                </h4>
                {(keyword ||
                  selectedUserFilter !== "all" ||
                  syncStatusFilter !== "all" ||
                  dateFrom ||
                  dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeyword("");
                        setSelectedUserFilter("all");
                        setSyncStatusFilter("all");
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="text-[10.5px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-lg hover:bg-rose-500/10 transition"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Reset Filter
                    </button>
                  )}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-medium">
                Menampilkan{" "}
                <strong className="text-[var(--text-primary)]">
                  {visibleReports.length}
                </strong>{" "}
                dari {currentDataset.length} laporan
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <label className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Cari Nama / Uraian / Tanggal
                </span>
                <input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                  {allUniqueUsers.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Status Database
                </span>
                <select
                  value={syncStatusFilter}
                  onChange={(e) =>
                    setSyncStatusFilter(
                      e.target.value as "all" | "draft" | "synced",
                    )
                  }
                  className={inputClassName}
                >
                  <option value="all">Semua Status</option>
                  <option value="draft">Draft Perangkat (Belum di DB)</option>
                  <option value="synced">Sudah Tersinkron DB</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Dari Tanggal
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
          </div>

          {/* ─── Sort & Selection Controls Bar ─── */}
          <div className="surface-card rounded-[20px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Sort & Expand/Collapse */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 shrink-0 opacity-60"
                >
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="m21 8-4-4-4 4" />
                  <path d="M17 4v16" />
                </svg>
                <select
                  value={sortMode}
                  onChange={(e) =>
                    setSortMode(
                      e.target.value as "newest" | "oldest" | "user_asc",
                    )
                  }
                  className="field-input h-[34px] py-0 px-2.5 text-xs rounded-lg"
                >
                  <option value="newest">Terbaru (Tanggal ↓)</option>
                  <option value="oldest">Terlama (Tanggal ↑)</option>
                  <option value="user_asc">Abjad Nama (A-Z)</option>
                </select>
              </label>

              <span className="h-4 w-px bg-[var(--border-soft)]" />

              <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  Buka Semua
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  Tutup Semua
                </button>
              </div>
            </div>

            {/* Right: Selection Shortcuts */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectAllVisible()}
                disabled={visibleReports.length === 0}
                className="h-[32px] px-3 text-[11px] font-bold rounded-lg border border-purple-500/25 bg-purple-500/8 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={() => clearAllVisible()}
                disabled={selectedActivitiesCount === 0}
                className="h-[32px] px-3 text-[11px] font-bold rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)] transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Lepas Semua
              </button>
            </div>
          </div>

          {/* ─── Selected Items Summary & Action Buttons ─── */}
          <div className="surface-card rounded-[20px] p-4 space-y-3">
            {/* Selection Summary Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded-lg font-extrabold text-[11px] ${selectedActivitiesCount > 0 ? "bg-purple-600 text-white" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}
                >
                  {selectedActivitiesCount > 0 ? "✓" : "—"}
                </span>
                <span className="font-semibold text-[var(--text-muted)]">
                  Terpilih:
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-soft)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 text-purple-500 shrink-0"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <strong className="text-[var(--text-primary)]">
                    {selectedUsersCount}
                  </strong>
                  <span className="text-[var(--text-muted)]">Petugas</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-soft)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 text-indigo-500 shrink-0"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <strong className="text-[var(--text-primary)]">
                    {selectedReportsCount}
                  </strong>
                  <span className="text-[var(--text-muted)]">Laporan</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${selectedActivitiesCount > 0 ? "bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400" : "bg-[var(--surface-muted)] border-[var(--border-soft)]"}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 shrink-0"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <strong
                    className={
                      selectedActivitiesCount > 0
                        ? "font-extrabold"
                        : "text-[var(--text-primary)]"
                    }
                  >
                    {selectedActivitiesCount}
                  </strong>
                  <span className="text-[var(--text-muted)]">
                    / {totalVisibleActivities} Aktivitas
                  </span>
                </span>
              </div>
            </div>

            {/* Action Buttons Row - Grouped by Intent */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-soft)]/60">
              {/* ── Group 1: Export Actions (left) ── */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Export JSON */}
                <button
                  type="button"
                  onClick={handleExportSelectedJson}
                  disabled={visibleReports.length === 0}
                  className="h-[38px] px-3 text-[11px] font-bold rounded-xl border border-indigo-500/25 bg-indigo-500/8 hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                  title="Unduh cadangan sebagai file JSON"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  JSON
                </button>

              </div>

              {/* ── Spacer ── */}
              <div className="flex-1 min-w-[8px]" />

              {/* ── Group 2: Destructive + Primary Actions (right) ── */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Hapus Terpilih */}
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={deleting || selectedReportsCount === 0}
                  className="h-[38px] px-3 text-[11px] font-bold rounded-xl border border-red-500/25 bg-red-500/8 hover:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                  title="Hapus cadangan terpilih dari browser"
                >
                  {deleting ? (
                    <SpinnerIcon className="h-3.5 w-3.5" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  )}
                  Hapus ({selectedReportsCount})
                </button>

                {/* Upload ke Database - Primary CTA */}
                <button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={
                    props.deviceBackupBulkUploading ||
                    deleting ||
                    selectedActivitiesCount === 0 ||
                    !props.onHandleBulkUploadDeviceBackup
                  }
                  className="h-[38px] px-4 text-[11px] font-extrabold rounded-xl shadow-md flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-none transition-all disabled:opacity-40 disabled:shadow-none cursor-pointer"
                >
                  {props.deviceBackupBulkUploading ? (
                    <>
                      <SpinnerIcon className="h-3.5 w-3.5" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Upload ke DB ({selectedActivitiesCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Result Banners */}
          {uploadResult && (
            <div
              className={`rounded-2xl p-4 sm:p-5 border space-y-2 animate-fadeIn ${uploadResult.uploadedReportsCount > 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span>
                    {uploadResult.uploadedReportsCount > 0 ? "✓" : "✕"}
                  </span>
                  <span>
                    {uploadResult.uploadedReportsCount > 0
                      ? `Sukses mengunggah ${uploadResult.uploadedReportsCount} laporan (${uploadResult.uploadedActivitiesCount} aktivitas) ke Supabase!`
                      : "Tidak ada laporan yang berhasil diunggah."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode("progress")}
                  className="text-xs font-bold underline cursor-pointer"
                >
                  Lihat Detail Progres
                </button>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="text-xs space-y-1 mt-1 font-mono text-red-600 dark:text-red-400">
                  {uploadResult.errors.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Compact Unified Selection & Management Tree Container */}
          <div className="space-y-4">
            {groupedByUser.length === 0 ? (
              <div className="surface-card rounded-[24px] p-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-[var(--surface-muted)] mx-auto flex items-center justify-center text-[var(--text-muted)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Tidak Ada Data Laporan Cadangan yang Ditemukan
                </h4>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Belum ada data laporan tersimpan pada cache perangkat ini atau
                  file JSON yang sesuai dengan kriteria filter Anda.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
                {groupedByUser.map(([userName, userReports]) => {
                  const isUserExpanded = expandedUsers[userName] ?? true;
                  const userTotalActivities = userReports.reduce(
                    (sum, r) => sum + (r.activities?.length || 0),
                    0,
                  );
                  const userSelectedActivities = userReports.reduce(
                    (sum, r) => {
                      const sel = selectedActivities[r.id] || [];
                      return sum + sel.length;
                    },
                    0,
                  );

                  const isUserFullyChecked =
                    userTotalActivities > 0 &&
                    userSelectedActivities === userTotalActivities;
                  const isUserPartiallyChecked =
                    userSelectedActivities > 0 && !isUserFullyChecked;

                  return (
                    <div key={userName} className="transition">
                      {/* Level 1: Compact User Row */}
                      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-muted)]/30 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isUserFullyChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = isUserPartiallyChecked;
                            }}
                            onChange={() => toggleUser(userReports)}
                            className="h-4 w-4 accent-purple-600 rounded cursor-pointer shrink-0"
                          />
                          <div
                            onClick={() => toggleExpandUser(userName)}
                            className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
                          >
                            <div className="h-7 w-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                              {userName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                                {userName}
                              </h4>
                              <span className="text-xs text-[var(--text-muted)] font-medium">
                                ({userReports.length} Tanggal •{" "}
                                {userSelectedActivities}/{userTotalActivities}{" "}
                                Aktivitas Terpilih)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleExpandUser(userName)}
                            className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-[var(--surface-muted)]"
                          >
                            <span>
                              {isUserExpanded ? "Sembunyikan" : "Buka"}
                            </span>
                            <svg
                              viewBox="0 0 24 24"
                              className={`h-3.5 w-3.5 transition-transform ${isUserExpanded ? "rotate-180" : ""
                                }`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Level 2: Compact Reports List with Tree Guideline */}
                      {isUserExpanded && (
                        <div className="ml-3 sm:ml-4 pl-3.5 sm:pl-4 border-l-2 border-dashed border-purple-500/30 dark:border-purple-800/40 pr-3 sm:pr-4 pb-3 pt-1 space-y-2 bg-[var(--surface-muted)]/10">
                          {userReports.map((report) => {
                            const isReportExpanded =
                              expandedReports[report.id] ?? false;
                            const reportActivities = report.activities || [];
                            const reportSelectedNos =
                              selectedActivities[report.id] || [];
                            const isReportFullyChecked =
                              reportActivities.length > 0 &&
                              reportSelectedNos.length ===
                              reportActivities.length;
                            const isReportPartiallyChecked =
                              reportSelectedNos.length > 0 &&
                              !isReportFullyChecked;

                            const isDraft =
                              report.source === "local" ||
                              report.id.startsWith("draft-");

                            return (
                              <div
                                key={report.id}
                                className="rounded-xl border border-[var(--border-soft)]/60 bg-[var(--surface-panel-strong)] p-2.5 sm:p-3 space-y-2 shadow-2xs"
                              >
                                {/* Report Date Header & Status Badge & Single Delete */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isReportFullyChecked}
                                      ref={(el) => {
                                        if (el)
                                          el.indeterminate =
                                            isReportPartiallyChecked;
                                      }}
                                      onChange={() => toggleReport(report)}
                                      className="h-3.5 w-3.5 accent-purple-600 rounded cursor-pointer shrink-0"
                                    />
                                    <div
                                      onClick={() =>
                                        toggleExpandReport(report.id)
                                      }
                                      className="flex items-center gap-2 cursor-pointer select-none flex-wrap min-w-0"
                                    >
                                      <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                                        {formatWitaDate(report.reportDate)}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                        Tim {report.tim || "TRC"}
                                      </span>

                                      {/* Status Sync Badge */}
                                      {isDraft ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                          Draft Perangkat
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                          Sudah di DB
                                        </span>
                                      )}

                                      <span className="text-[11px] text-[var(--text-muted)]">
                                        ({reportSelectedNos.length}/
                                        {reportActivities.length} aktivitas)
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Hapus Single Report Button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDeleteSingleReport(report)
                                      }
                                      disabled={deleting}
                                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition cursor-pointer disabled:opacity-40"
                                      title="Hapus cadangan laporan ini dari perangkat"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-3.5 w-3.5"
                                      >
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleExpandReport(report.id)
                                      }
                                      className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-md hover:bg-[var(--surface-muted)]"
                                    >
                                      <span>
                                        {isReportExpanded
                                          ? "Tutup Rincian"
                                          : "Rincian Aktivitas"}
                                      </span>
                                      <svg
                                        viewBox="0 0 24 24"
                                        className={`h-3 w-3 transition-transform ${isReportExpanded ? "rotate-180" : ""
                                          }`}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <polyline points="6 9 12 15 18 9" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Level 3: Compact Individual Activities List */}
                                {isReportExpanded && (
                                  <div className="pl-4 sm:pl-6 space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                                    {reportActivities.length === 0 ? (
                                      <p className="text-xs text-[var(--text-muted)] italic py-1">
                                        Tidak ada aktivitas tercatat pada
                                        laporan ini.
                                      </p>
                                    ) : (
                                      reportActivities.map(
                                        (activity, actIdx) => {
                                          const isActChecked =
                                            reportSelectedNos.includes(
                                              activity.no,
                                            );
                                          const photosCount =
                                            activity.photos?.length || 0;

                                          return (
                                            <label
                                              key={activity.no ?? actIdx}
                                              className={`flex items-start gap-2.5 cursor-pointer select-none py-1.5 px-2.5 rounded-lg transition text-xs ${isActChecked
                                                  ? "bg-purple-500/8 text-[var(--text-primary)] font-medium"
                                                  : "opacity-60 hover:opacity-100"
                                                }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isActChecked}
                                                onChange={() =>
                                                  toggleActivity(
                                                    report.id,
                                                    activity.no,
                                                  )
                                                }
                                                className="mt-0.5 h-3.5 w-3.5 accent-purple-600 rounded cursor-pointer shrink-0"
                                              />
                                              <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                                  #{activity.no ?? actIdx + 1}
                                                </span>
                                                <span className="text-[var(--text-muted)]">
                                                  [
                                                  {activity.startTime &&
                                                    activity.endTime
                                                    ? `${activity.startTime}-${activity.endTime}`
                                                    : "-"}
                                                  ]
                                                </span>
                                                <span className="text-[var(--text-primary)] truncate">
                                                  {activity.description ||
                                                    "(Tanpa uraian)"}
                                                </span>
                                                {photosCount > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                    {photosCount} Foto
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        },
                                      )
                                    )}
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
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL RESOLUSI KONFLIK UPLOAD DATABASE DUPLIKAT TANGGAL */}
      {/* ========================================================= */}
      {showConflictModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="surface-card rounded-[28px] max-w-2xl w-full p-6 space-y-5 border border-amber-500/30 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header Modal */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border-soft)]">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                      Deteksi Data Duplikat di Database
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Terdapat {conflictingItems.length} laporan cadangan yang
                      tanggal &amp; petugasnya sudah ada di Supabase database.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Banner Opsi Penanganan */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1">
                <p className="font-semibold">Opsi Penanganan Per Laporan:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11.5px] opacity-90">
                  <li>
                    <strong className="text-purple-600 dark:text-purple-300">
                      Timpa Data DB (Overwrite)
                    </strong>
                    : Memperbarui data laporan di database dengan data cadangan
                    ini.
                  </li>
                  <li>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      Pertahankan Data DB (Skip)
                    </strong>
                    : Mempertahankan data lama di database dan tidak mengunggah
                    cadangan ini.
                  </li>
                </ul>
              </div>

              {/* Quick Batch Options */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[var(--text-primary)]">
                  Pilihan Massal Cepat:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, "overwrite" | "skip"> = {};
                      conflictingItems.forEach((c) => {
                        next[c.backupReport.id] = "overwrite";
                      });
                      setConflictResolutions(next);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition cursor-pointer"
                  >
                    Timpa Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, "overwrite" | "skip"> = {};
                      conflictingItems.forEach((c) => {
                        next[c.backupReport.id] = "skip";
                      });
                      setConflictResolutions(next);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
                  >
                    Pertahankan Semua DB
                  </button>
                </div>
              </div>

              {/* Scrollable Items List */}
              <div className="overflow-y-auto max-h-[340px] space-y-3 pr-1 divide-y divide-[var(--border-soft)]">
                {conflictingItems.map(({ backupReport, dbReport }) => {
                  const currentChoice =
                    conflictResolutions[backupReport.id] || "overwrite";
                  return (
                    <div
                      key={backupReport.id}
                      className="pt-3 first:pt-0 space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-[var(--text-primary)]">
                            {backupReport.nama}{" "}
                            <span className="font-normal text-[var(--text-muted)]">
                              ({formatWitaDate(backupReport.reportDate)})
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3 mt-0.5">
                            <span>
                              Cadangan Lokal:{" "}
                              {backupReport.activities?.length || 0} Aktivitas
                            </span>
                            <span>•</span>
                            <span>
                              Di Database: {dbReport.activities?.length || 0}{" "}
                              Aktivitas
                            </span>
                          </div>
                        </div>

                        {/* Pill Selector per Item */}
                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() =>
                              setConflictResolutions((prev) => ({
                                ...prev,
                                [backupReport.id]: "overwrite",
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${currentChoice === "overwrite"
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-primary)]"
                              }`}
                          >
                            Timpa Data DB
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConflictResolutions((prev) => ({
                                ...prev,
                                [backupReport.id]: "skip",
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${currentChoice === "skip"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-primary)]"
                              }`}
                          >
                            Pertahankan Data DB
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="btn-secondary h-[42px] px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal Upload
                </button>
                <button
                  type="button"
                  onClick={() => void executeUploadProcess(conflictResolutions)}
                  className="btn-primary h-[42px] px-5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-md"
                >
                  Lanjutkan Upload ({conflictingItems.length} Laporan)
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}


    </div>
  );
}

