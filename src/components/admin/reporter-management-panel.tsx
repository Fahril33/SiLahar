import { useEffect, useMemo, useState } from "react";
import { adminGetReporterPasswords } from "../../lib/report-service";
import { formatWitaDateTime } from "../../lib/time";
import { AdminReporterStatsView } from "../admin-reporter-stats-view";
import {
  AdminReporterToolbar,
  type ReporterSortMode,
} from "../admin-reporter-toolbar";
import { ClearableTextInput, SpinnerIcon } from "./shared";
import type { AdminDashboardViewProps } from "./types";
import type { ReporterDirectoryProfile } from "../../types/report";
import { normalizeReporterName } from "../../lib/reporter-name";

type DbFilterMode = "all" | "both" | "primary-only" | "legacy-only";

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
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function KeyIcon(props: { className?: string }) {
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
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

function EyeIcon(props: { className?: string }) {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: { className?: string }) {
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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
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
      className={props.className || "h-4 w-4"}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function EditIcon(props: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function ChartIcon(props: { className?: string }) {
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
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function CopyIcon(props: { className?: string }) {
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
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-3.5 w-3.5"}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-purple-500 to-pink-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

export function ReporterManagementPanel(props: AdminDashboardViewProps) {
  const [reporterSearch, setReporterSearch] = useState("");
  const [reporterSortMode, setReporterSortMode] = useState<ReporterSortMode>("name-asc");
  const [dbFilter, setDbFilter] = useState<DbFilterMode>("all");
  const [editingReporter, setEditingReporter] = useState<ReporterDirectoryProfile | null>(null);
  const [deletingReporter, setDeletingReporter] = useState<ReporterDirectoryProfile | null>(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Draft states for currently edited reporter
  const [editDraftName, setEditDraftName] = useState("");
  const [editDraftPassword, setEditDraftPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    let alive = true;
    adminGetReporterPasswords()
      .then((data) => {
        if (!alive) return;
        setPasswords(data);
      })
      .catch((err) => {
        console.error("Gagal memuat password user:", err);
      });
    return () => {
      alive = false;
    };
  }, [props.reporterProfiles]);

  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(
    null,
  );

  const selectedReporter =
    props.reporterProfiles.find(
      (reporter) => reporter.id === selectedReporterId,
    ) ?? null;

  // Correlate live report counts from props.reports per reporter and per database
  const reporterReportsMap = useMemo(() => {
    const map = new Map<string, { total: number; primary: number; legacy: number }>();
    for (const r of props.reports) {
      const name = (r.nama || "").trim();
      if (!name) continue;
      const norm = normalizeReporterName(name);
      const cur = map.get(norm) || { total: 0, primary: 0, legacy: 0 };
      cur.total++;
      if (r.databaseAccount === "legacy") {
        cur.legacy++;
      } else {
        cur.primary++;
      }
      map.set(norm, cur);
    }
    return map;
  }, [props.reports]);

  // Enriched reporter information with database presence flags and audited counts
  const enrichedReporters = useMemo(() => {
    return props.reporterProfiles.map((rep) => {
      const norm = normalizeReporterName(rep.fullName);
      const live = reporterReportsMap.get(norm);
      const primaryCount = rep.actualAudited
        ? rep.primaryReportsCount ?? 0
        : (rep.primaryReportsCount ?? 0) || (live?.primary ?? 0);
      const legacyCount = rep.actualAudited
        ? rep.legacyReportsCount ?? 0
        : (rep.legacyReportsCount ?? 0) || (live?.legacy ?? 0);
      const syncedCount = rep.syncedReportsCount ?? 0;
      const primaryOnlyCount =
        rep.primaryOnlyReportsCount ?? Math.max(0, primaryCount - syncedCount);
      const legacyOnlyCount =
        rep.legacyOnlyReportsCount ?? Math.max(0, legacyCount - syncedCount);
      const totalReports = rep.actualAudited
        ? rep.totalReports
        : Math.max(rep.totalReports || 0, live?.total ?? 0);

      const inPrimary =
        (rep.dbSources?.includes("primary") ?? false) ||
        primaryCount > 0 ||
        Boolean(rep.primaryId);
      const inLegacy =
        (rep.dbSources?.includes("legacy") ?? false) ||
        legacyCount > 0 ||
        Boolean(rep.legacyId);

      return {
        ...rep,
        totalReports,
        primaryCount,
        legacyCount,
        syncedCount,
        primaryOnlyCount,
        legacyOnlyCount,
        inPrimary,
        inLegacy,
        isSyncedBoth: inPrimary && inLegacy,
        isOrphanReportOnly: false,
      };
    });
  }, [props.reporterProfiles, reporterReportsMap]);

  // Overall database statistics for top dashboard summary cards
  const statsSummary = useMemo(() => {
    const totalUsers = enrichedReporters.length;
    let bothDbs = 0;
    let primaryOnly = 0;
    let legacyOnly = 0;
    let totalAllReports = 0;
    let totalPrimaryReports = 0;
    let totalLegacyReports = 0;
    let totalSyncedReports = 0;

    for (const r of enrichedReporters) {
      if (r.inPrimary && r.inLegacy) bothDbs++;
      else if (r.inPrimary) primaryOnly++;
      else if (r.inLegacy) legacyOnly++;
      totalAllReports += r.totalReports;
      totalPrimaryReports += r.primaryCount;
      totalLegacyReports += r.legacyCount;
      totalSyncedReports += r.syncedCount;
    }

    return {
      totalUsers,
      bothDbs,
      primaryOnly,
      legacyOnly,
      totalPrimary: bothDbs + primaryOnly,
      totalLegacy: bothDbs + legacyOnly,
      totalAllReports,
      totalPrimaryReports,
      totalLegacyReports,
      totalSyncedReports,
    };
  }, [enrichedReporters]);

  // Filtered & Sorted Reporters
  const visibleReporters = useMemo(() => {
    const query = reporterSearch.trim().toLowerCase();

    return enrichedReporters
      .filter((reporter) => {
        // 1. Search Query filter (matches full name or UUID)
        const matchName = reporter.fullName.toLowerCase().includes(query);
        const matchId = reporter.id.toLowerCase().includes(query);
        const matchPrimaryId = (reporter.primaryId || "").toLowerCase().includes(query);
        const matchLegacyId = (reporter.legacyId || "").toLowerCase().includes(query);
        if (!matchName && !matchId && !matchPrimaryId && !matchLegacyId) {
          return false;
        }

        // 2. Database Filter
        if (dbFilter === "both" && !reporter.isSyncedBoth) return false;
        if (dbFilter === "primary-only" && (!reporter.inPrimary || reporter.inLegacy)) return false;
        if (dbFilter === "legacy-only" && (!reporter.inLegacy || reporter.inPrimary)) return false;

        return true;
      })
      .slice()
      .sort((left, right) => {
        if (reporterSortMode === "name-desc") {
          return right.fullName.localeCompare(left.fullName);
        }
        if (reporterSortMode === "reports-desc") {
          return (right.totalReports || 0) - (left.totalReports || 0);
        }
        if (reporterSortMode === "join-time") {
          return (right.firstReportedAt ?? "").localeCompare(
            left.firstReportedAt ?? "",
          );
        }
        return left.fullName.localeCompare(right.fullName);
      });
  }, [enrichedReporters, reporterSearch, dbFilter, reporterSortMode]);

  function handleStartEdit(reporter: ReporterDirectoryProfile) {
    setEditingReporter(reporter);
    setEditDraftName(reporter.fullName);
    setEditDraftPassword(passwords[reporter.id] ?? "123123123");
    setShowEditPassword(false);
  }

  async function handleSaveEdit() {
    if (!editingReporter) return;
    props.onChangeAdminReporterDraftName(editingReporter.id, editDraftName);
    try {
      await props.onHandleRenameReporterProfile(editingReporter, editDraftPassword);
      setPasswords((prev) => ({
        ...prev,
        [editingReporter.id]: editDraftPassword,
      }));
      setEditingReporter(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirmDeleteTrace() {
    if (!deletingReporter) return;
    if (!deleteAdminPassword.trim()) {
      setDeleteError("Password administrator wajib diisi untuk otorisasi penghapusan.");
      return;
    }
    setDeleteError(null);
    try {
      await props.onHandleDeleteReporterTrace(deletingReporter, deleteAdminPassword);
      setDeletingReporter(null);
      setDeleteAdminPassword("");
      setDeleteError(null);
    } catch (err: any) {
      setDeleteError(err.message || "Gagal menghapus jejak pengguna.");
    }
  }

  function handleCopyId(id: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  if (selectedReporter) {
    return (
      <AdminReporterStatsView
        reporter={selectedReporter}
        reports={props.reports}
        loading={props.loading}
        onBack={() => setSelectedReporterId(null)}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {/* 1. Dashboard Overview Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Total Pengguna
          </span>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
            {statsSummary.totalUsers}
          </p>
          <span className="mt-1 block text-xs text-[var(--text-muted)]">
            {statsSummary.totalAllReports} laporan unik terkumpul
          </span>
        </div>

        <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <DatabaseIcon className="h-3 w-3" />
            <span>DB Utama</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {statsSummary.totalPrimary}
          </p>
          <span className="mt-1 block text-xs text-emerald-700/80 dark:text-emerald-300/80">
            {statsSummary.totalPrimaryReports} laporan • {statsSummary.primaryOnly} khusus
          </span>
        </div>

        <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <DatabaseIcon className="h-3 w-3" />
            <span>DB Lama</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {statsSummary.totalLegacy}
          </p>
          <span className="mt-1 block text-xs text-amber-700/80 dark:text-amber-300/80">
            {statsSummary.totalLegacyReports} laporan • {statsSummary.legacyOnly} belum termigrasi
          </span>
        </div>

        <div className="rounded-[20px] border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Sinkron 2 DB
          </span>
          <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {statsSummary.bothDbs}
          </p>
          <span className="mt-1 block text-xs text-indigo-700/80 dark:text-indigo-300/80">
            {statsSummary.totalSyncedReports} salinan laporan identik
          </span>
        </div>
      </div>

      {/* 2. Database Filter Chips & Search Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Database Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-[16px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-1.5 text-xs">
          <button
            type="button"
            onClick={() => setDbFilter("all")}
            className={`rounded-[10px] px-3 py-1.5 font-medium transition ${
              dbFilter === "all"
                ? "bg-[var(--primary)] text-white shadow-xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Semua ({statsSummary.totalUsers})
          </button>
          <button
            type="button"
            onClick={() => setDbFilter("both")}
            className={`flex items-center gap-1 rounded-[10px] px-3 py-1.5 font-medium transition ${
              dbFilter === "both"
                ? "bg-indigo-600 text-white shadow-xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <DatabaseIcon className="h-3 w-3" />
            <span>Sinkron 2 DB ({statsSummary.bothDbs})</span>
          </button>
          <button
            type="button"
            onClick={() => setDbFilter("primary-only")}
            className={`rounded-[10px] px-3 py-1.5 font-medium transition ${
              dbFilter === "primary-only"
                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Hanya DB Utama ({statsSummary.primaryOnly})
          </button>
          <button
            type="button"
            onClick={() => setDbFilter("legacy-only")}
            className={`rounded-[10px] px-3 py-1.5 font-medium transition ${
              dbFilter === "legacy-only"
                ? "bg-amber-600 text-white shadow-xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Hanya DB Lama ({statsSummary.legacyOnly})
          </button>
        </div>

        {/* Search & Sort Toolbar */}
        <div className="w-full sm:w-auto">
          <AdminReporterToolbar
            searchValue={reporterSearch}
            onSearchChange={setReporterSearch}
            sortMode={reporterSortMode}
            onSortModeChange={setReporterSortMode}
            disabled={props.adminSubmitting}
          />
        </div>
      </div>

      {/* 3. Empty State */}
      {visibleReporters.length === 0 ? (
        <div className="surface-card rounded-[24px] p-8 text-center text-sm text-[var(--text-muted)]">
          <p className="font-semibold text-[var(--text-primary)]">
            Tidak ada pengguna ditemukan
          </p>
          <p className="mt-1 text-xs">
            {reporterSearch.trim()
              ? `Tidak ada data yang cocok dengan kueri "${reporterSearch}".`
              : "Belum ada data pengguna yang sesuai dengan filter yang dipilih."}
          </p>
        </div>
      ) : null}

      {/* 4. Revamped User Cards List */}
      <div className="grid gap-3.5">
        {visibleReporters.map((reporter) => {
          const isDeleting =
            props.adminActiveAction === "delete-reporter" &&
            props.adminActiveItemId === reporter.id;
          const currentPassword = passwords[reporter.id] ?? "123123123";
          const isPasswordVisible = Boolean(showPasswordMap[reporter.id]);
          const avatarGradient = getAvatarGradient(reporter.fullName);
          const initial = (reporter.fullName.trim()[0] || "?").toUpperCase();

          return (
            <article
              key={reporter.id}
              className="surface-card rounded-[24px] border border-[var(--border-soft)] p-4 transition hover:border-[var(--border-strong)] sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Left: Avatar, Name, Database Badges, and Metadata */}
                <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:gap-4">
                  {/* Avatar */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradient} text-lg font-bold text-white shadow-xs`}
                  >
                    {initial}
                  </div>

                  {/* Info Column */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReporterId(reporter.id)}
                        className="truncate text-left text-base font-bold text-[var(--text-primary)] transition hover:text-[var(--primary)]"
                        title="Klik untuk melihat statistik detail pengguna"
                      >
                        {reporter.fullName}
                      </button>

                      {/* DATABASE RELATION BADGES */}
                      {reporter.isSyncedBoth ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          <DatabaseIcon className="h-3 w-3" />
                          <span>Sinkron di 2 DB</span>
                        </span>
                      ) : (
                        <>
                          {reporter.inPrimary && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <DatabaseIcon className="h-3 w-3" />
                              <span>DB Utama</span>
                            </span>
                          )}
                          {reporter.inLegacy && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <DatabaseIcon className="h-3 w-3" />
                              <span>DB Lama</span>
                            </span>
                          )}
                        </>
                      )}

                      {/* Active Status Badge */}
                      {reporter.isOrphanReportOnly ? (
                        <span className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                          Riwayat Laporan Ada
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Aktif
                        </span>
                      )}
                    </div>

                    {/* Meta & Database Distribution */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text-primary)]">
                        {reporter.totalReports} total laporan
                      </span>

                      {/* Specific per-DB Breakdown */}
                      {(reporter.inPrimary || reporter.inLegacy) && (
                        <span className="inline-flex items-center gap-1 text-[11px] opacity-80">
                          ({[
                            `${reporter.primaryCount} di DB Utama`,
                            `${reporter.legacyCount} di DB Lama`,
                            reporter.syncedCount > 0
                              ? `${reporter.syncedCount} salinan 2 DB`
                              : null,
                            reporter.legacyOnlyCount > 0 && reporter.inPrimary
                              ? `${reporter.legacyOnlyCount} belum migrasi`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")})
                        </span>
                      )}

                      {reporter.firstReportedAt ? (
                        <span>
                          Awal: {formatWitaDateTime(reporter.firstReportedAt)}
                        </span>
                      ) : null}

                      {reporter.lastReportedAt ? (
                        <span>
                          Terakhir: {formatWitaDateTime(reporter.lastReportedAt)}
                        </span>
                      ) : null}

                      {/* UUID with Copy Button */}
                      {!reporter.isOrphanReportOnly ? (
                        <button
                          type="button"
                          onClick={() => handleCopyId(reporter.id)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono transition hover:bg-[var(--surface-elevated)]"
                          title="Salin UUID pengguna"
                        >
                          {copiedId === reporter.id ? (
                            <>
                              <CheckIcon className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon className="h-3 w-3 opacity-60" />
                              <span className="opacity-75">{reporter.id.slice(0, 8)}...</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-[var(--text-muted)] opacity-70">
                          (Tanpa Akun Direktori)
                        </span>
                      )}

                      {/* Password Quick Preview (only if directory profile exists) */}
                      {!reporter.isOrphanReportOnly && (
                        <div className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-2 py-0.5 text-[11px]">
                          <KeyIcon className="h-3 w-3 opacity-60" />
                          <span className="font-mono">
                            {isPasswordVisible ? currentPassword : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswordMap((prev) => ({
                                ...prev,
                                [reporter.id]: !prev[reporter.id],
                              }))
                            }
                            className="ml-0.5 opacity-60 hover:opacity-100"
                            title={isPasswordVisible ? "Sembunyikan" : "Tampilkan password"}
                          >
                            {isPasswordVisible ? (
                              <EyeOffIcon className="h-3 w-3" />
                            ) : (
                              <EyeIcon className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedReporterId(reporter.id)}
                    disabled={props.adminSubmitting}
                    className="btn-ghost flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--text-primary)]"
                    title="Lihat riwayat dan grafik aktivitas pengguna"
                  >
                    <ChartIcon className="h-3.5 w-3.5 opacity-70" />
                    <span>Statistik</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(reporter)}
                    disabled={props.adminSubmitting}
                    className="btn-secondary flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold"
                  >
                    <EditIcon className="h-3.5 w-3.5 opacity-70" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeletingReporter(reporter);
                      setDeleteAdminPassword("");
                      setDeleteError(null);
                      setShowDeletePassword(false);
                    }}
                    disabled={props.adminSubmitting}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 disabled:opacity-60 dark:text-red-400"
                    title="Hapus jejak pengguna beserta seluruh laporannya di semua database"
                  >
                    {isDeleting ? (
                      <SpinnerIcon className="h-3.5 w-3.5" />
                    ) : (
                      <TrashIcon className="h-3.5 w-3.5" />
                    )}
                    <span>Hapus Jejak</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* 5. Revamped Edit User Modal */}
      {editingReporter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-card w-full max-w-lg rounded-[28px] border border-[var(--border-soft)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Edit Data Pengguna
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Perbarui profil petugas dan password akun di direktori sistem
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingReporter(null)}
                className="rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              {/* Database status banner */}
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-3 text-xs text-[var(--text-muted)]">
                <DatabaseIcon className="h-4 w-4 text-[var(--primary)]" />
                <span>
                  Status Sinkronisasi:{" "}
                  <strong className="text-[var(--text-primary)]">
                    {editingReporter.dbSources?.includes("primary") &&
                    editingReporter.dbSources?.includes("legacy")
                      ? "Terhubung ke DB Utama & DB Lama"
                      : editingReporter.dbSources?.includes("primary")
                        ? "Terhubung ke DB Utama"
                        : "Terhubung ke DB Lama"}
                  </strong>
                </span>
              </div>

              {/* Name Input */}
              <ClearableTextInput
                label="Nama Pengguna Publik"
                value={editDraftName}
                onChange={setEditDraftName}
                onClear={() => setEditDraftName("")}
              />

              {/* Password Input with Toggle & Default Button */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Password Akun
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditDraftPassword("123123123")}
                    className="text-[11px] font-medium text-[var(--primary)] transition hover:underline"
                  >
                    Gunakan default (123123123)
                  </button>
                </div>
                <div className="relative mt-1.5 flex items-center">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editDraftPassword}
                    onChange={(e) => setEditDraftPassword(e.target.value)}
                    className="field-input w-full pr-10 font-mono text-sm"
                    placeholder="Masukkan password baru..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                    title={showEditPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showEditPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-4 py-3 text-xs text-[var(--text-muted)]">
                <p>
                  Nama terbaru otomatis disinkronisasikan ke riwayat laporan yang
                  tersimpan di database aktif.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--border-soft)] pt-4">
              <button
                type="button"
                onClick={() => setEditingReporter(null)}
                disabled={props.adminSubmitting}
                className="btn-ghost rounded-xl px-4 py-2 text-sm disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={props.adminSubmitting || !editDraftName.trim()}
                className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {props.adminActiveAction === "rename-reporter" && (
                  <SpinnerIcon className="h-4 w-4" />
                )}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Revamped Hapus Jejak Confirmation Modal */}
      {deletingReporter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-card w-full max-w-md rounded-[28px] border border-red-500/30 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10">
                <TrashIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Hapus Jejak Pengguna?
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Tindakan ini menghapus seluruh riwayat dan akun secara permanen
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4 text-xs">
              <div className="font-semibold text-[var(--text-primary)]">
                Petugas: {deletingReporter.fullName}
              </div>
              <ul className="mt-2.5 space-y-1.5 text-[var(--text-muted)]">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span>Akun di direktori petugas (DB Utama & DB Lama)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span>
                    Semua laporan harian ({deletingReporter.totalReports} laporan)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span>Seluruh foto bukti kegiatan yang tersimpan di storage</span>
                </li>
              </ul>
            </div>

            {/* Admin Password Input for Authorization */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Password Administrator
              </label>
              <p className="mb-1.5 text-[11px] text-[var(--text-muted)]">
                Masukkan password akun admin Anda untuk mengonfirmasi otorisasi penghapusan di semua database:
              </p>
              <div className="relative flex items-center">
                <input
                  type={showDeletePassword ? "text" : "password"}
                  value={deleteAdminPassword}
                  onChange={(e) => {
                    setDeleteAdminPassword(e.target.value);
                    setDeleteError(null);
                  }}
                  className="field-input w-full pr-10 font-mono text-sm"
                  placeholder="Password admin Anda..."
                  disabled={props.adminSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                  title={showDeletePassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showDeletePassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              {deleteError && (
                <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {deleteError}
                </div>
              )}
            </div>

            <p className="mt-4 text-xs font-medium text-red-600 dark:text-red-400">
              Peringatan: Seluruh jejak pengguna ini di semua database akan
              dihapus tanpa dapat dipulihkan kembali.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--border-soft)] pt-4">
              <button
                type="button"
                onClick={() => setDeletingReporter(null)}
                disabled={props.adminSubmitting}
                className="btn-ghost rounded-xl px-4 py-2 text-sm disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTrace}
                disabled={props.adminSubmitting || !deleteAdminPassword.trim()}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {props.adminActiveAction === "delete-reporter" && (
                  <SpinnerIcon className="h-4 w-4" />
                )}
                <span>Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
