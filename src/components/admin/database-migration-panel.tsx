import { useEffect, useState } from "react";
import {
  checkDatabaseConnections,
  fetchMigrationSummary,
  executeDatabaseMigration,
  type DatabaseConnectionStatus,
  type TableSummaryItem,
  type MigrationProgressEvent,
  type MigrationSummaryResult,
} from "../../lib/database-migration-service";
import { askConfirmation, showError, showSuccess } from "../../lib/alerts";
import { SpinnerIcon } from "./shared";
import type { AdminSessionState } from "../../types/admin";

export function DatabaseMigrationPanel(props: {
  adminSession?: AdminSessionState | null;
  onReloadReports?: () => Promise<void>;
}) {
  const [connections, setConnections] = useState<DatabaseConnectionStatus | null>(null);
  const [summaries, setSummaries] = useState<TableSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({});
  const [currentProgress, setCurrentProgress] = useState<MigrationProgressEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [migrationResult, setMigrationResult] = useState<MigrationSummaryResult | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const conn = await checkDatabaseConnections();
      setConnections(conn);

      if (conn.canMigrate) {
        const sum = await fetchMigrationSummary();
        setSummaries(sum);
        // Default select all tables that have data in legacy
        const initialSelected: Record<string, boolean> = {};
        sum.forEach((s) => {
          initialSelected[s.tableId] = s.legacyCount > 0;
        });
        setSelectedTables(initialSelected);
      }
    } catch (err: any) {
      void showError("Pemeriksaan Gagal", err.message || "Gagal memeriksa database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function toggleTable(tableId: string) {
    if (migrating) return;
    setSelectedTables((prev) => ({
      ...prev,
      [tableId]: !prev[tableId],
    }));
  }

  function toggleAll(selectAll: boolean) {
    if (migrating) return;
    const next: Record<string, boolean> = {};
    summaries.forEach((s) => {
      next[s.tableId] = selectAll;
    });
    setSelectedTables(next);
  }

  async function handleStartMigration() {
    const selectedIds = Object.keys(selectedTables).filter((id) => selectedTables[id]);
    if (selectedIds.length === 0) {
      void showError("Peringatan", "Pilih minimal satu tabel yang ingin dimigrasikan.");
      return;
    }

    const confirmed = await askConfirmation(
      "Mulai Migrasi Database?",
      `Sistem akan menyalin data dari Database Lama ke Database Baru untuk ${selectedIds.length} tabel terpilih dengan mempertahankan UUID dan relasi identik. Data yang sudah ada dengan ID sama akan diperbarui (upsert).`,
      "Ya, Mulai Migrasi",
    );
    if (!confirmed) return;

    setMigrating(true);
    setMigrationResult(null);
    setLogs([]);

    const initialLog = `[${new Date().toLocaleTimeString()}] Memulai migrasi ${selectedIds.length} tabel...`;
    setLogs([initialLog]);

    try {
      const result = await executeDatabaseMigration(selectedIds, (event) => {
        setCurrentProgress(event);
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${event.message}`,
        ]);
      });

      setMigrationResult(result);

      if (result.success) {
        void showSuccess(
          "Migrasi Selesai",
          `Berhasil menyalin ${result.totalRowsTransferred} baris data pada ${result.successTables} tabel ke Database Baru.`,
        );
      } else {
        void showError(
          "Migrasi Sebagian Selesai",
          `${result.successTables} tabel berhasil, ${result.failedTables} tabel gagal. Periksa log detail di bawah.`,
        );
      }

      // Refresh row count summaries
      const refreshed = await fetchMigrationSummary();
      setSummaries(refreshed);

      // Trigger dashboard reload so changes take effect
      if (props.onReloadReports) {
        void props.onReloadReports();
      }
    } catch (err: any) {
      void showError("Migrasi Terhenti", err.message || "Terjadi kesalahan saat migrasi.");
    } finally {
      setMigrating(false);
      setCurrentProgress(null);
    }
  }

  const selectedCount = Object.values(selectedTables).filter(Boolean).length;
  const totalLegacyRows = summaries.reduce((acc, curr) => acc + curr.legacyCount, 0);
  const syncedTablesCount = summaries.filter((s) => s.status === "synced").length;
  const needsSyncTablesCount = summaries.filter(
    (s) => s.status === "needs_sync" || s.status === "missing_in_target",
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. Database Connection Status Header */}
      <div className="surface-card rounded-[22px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm">
        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
          Status Koneksi Antar Database
        </h4>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Migrasi ini memindahkan data master pengaturan, pengguna, dan template dari Database Lama ke Database Baru dengan mempertahankan UUID yang sama persis agar seluruh relasi foreign key terpenuhi.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Database Lama */}
          <div className="p-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-500" />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Database Lama (Sumber Data)
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate font-mono">
                {connections?.legacy.url}
              </p>
              {connections?.legacy.error && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">
                  {connections.legacy.error}
                </p>
              )}
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                connections?.legacy.connected
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
              }`}
            >
              {connections?.legacy.connected ? "Terhubung" : "Terputus"}
            </span>
          </div>

          {/* Database Baru */}
          <div className="p-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Database Baru (Tujuan Migrasi)
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate font-mono">
                {connections?.primary.url}
              </p>
              {connections?.primary.error && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">
                  {connections.primary.error}
                </p>
              )}
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                connections?.primary.connected
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
              }`}
            >
              {connections?.primary.connected ? "Terhubung" : "Terputus"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Table Comparison & Selection List */}
      <div className="surface-card rounded-[22px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              Daftar Tabel Referensi Sistem
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Pilih tabel yang ingin disinkronkan ke Database Baru ({selectedCount} dari {summaries.length} terpilih).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loading || migrating}
              onClick={() => toggleAll(true)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]/80 transition"
            >
              Pilih Semua
            </button>
            <button
              type="button"
              disabled={loading || migrating}
              onClick={() => toggleAll(false)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]/80 transition"
            >
              Kosongkan
            </button>
            <button
              type="button"
              disabled={loading || migrating}
              onClick={loadData}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--border-soft)] hover:bg-[var(--surface-muted)] transition flex items-center gap-1.5"
              title="Perbarui hitungan baris"
            >
              {loading && <SpinnerIcon />}
              <span>{loading ? "Memindai…" : "Pindai Ulang"}</span>
            </button>
          </div>
        </div>

        {/* Overall Sync Summary Banner */}
        {summaries.length > 0 && !loading && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              needsSyncTablesCount === 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base font-bold shrink-0">
                {needsSyncTablesCount === 0 ? "✓" : "⚠"}
              </span>
              <p className="font-semibold leading-relaxed">
                {needsSyncTablesCount === 0
                  ? "Seluruh tabel referensi sistem sudah 100% identik antara Database Lama dan Database Baru (seluruh UUID dan nilai sama persis)."
                  : `Terdapat ${needsSyncTablesCount} tabel yang belum identik atau belum disalin ke Database Baru.`}
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/40 dark:bg-black/30 shrink-0 border border-current/20">
              {syncedTablesCount} / {summaries.length} Identik
            </span>
          </div>
        )}

        {/* Table Rows */}
        <div className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden">
          {summaries.map((item) => {
            const isSelected = Boolean(selectedTables[item.tableId]);
            return (
              <div
                key={item.tableId}
                onClick={() => toggleTable(item.tableId)}
                className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition ${
                  isSelected
                    ? "bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10"
                    : "bg-transparent hover:bg-[var(--surface-muted)]/40 opacity-75"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={migrating}
                    onChange={() => toggleTable(item.tableId)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">
                        {item.tableName}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 shrink-0 text-right">
                  <div className="text-xs font-semibold">
                    <span className="text-blue-600 dark:text-blue-400 font-mono" title="Jumlah data di DB Lama">
                      {item.legacyCount} lama
                    </span>
                    <span className="text-[var(--text-muted)] mx-1">vs</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono" title="Jumlah data di DB Baru">
                      {item.primaryCount} baru
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0 border ${
                      item.status === "synced"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : item.status === "needs_sync"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : item.status === "missing_in_target"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30"
                    }`}
                  >
                    <span>
                      {item.status === "synced" ? "✓" : item.status === "needs_sync" ? "⚠" : item.status === "missing_in_target" ? "✕" : "○"}
                    </span>
                    <span>{item.statusDetail}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            Total sumber: <strong>{totalLegacyRows} baris</strong> pada {summaries.length} tabel.
          </p>
          <button
            type="button"
            disabled={migrating || loading || selectedCount === 0 || !connections?.canMigrate}
            onClick={handleStartMigration}
            className="w-full sm:w-auto btn-primary px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            {migrating && <SpinnerIcon />}
            <span>
              {migrating
                ? "Sedang Memigrasikan Data…"
                : `Salin ${selectedCount} Tabel ke Database Baru`}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Real-Time Migration Progress Bar & Logs */}
      {(migrating || currentProgress || migrationResult) && (
        <div className="surface-card rounded-[22px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              {migrating ? "Progres Migrasi Data" : "Hasil Migrasi Terakhir"}
            </h4>
            {currentProgress && (
              <span className="text-xs font-bold text-[var(--primary)]">
                Langkah {currentProgress.currentStep} dari {currentProgress.totalSteps}
              </span>
            )}
          </div>

          {currentProgress && (
            <div>
              <div className="w-full h-2.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                  style={{
                    width: `${Math.round((currentProgress.currentStep / currentProgress.totalSteps) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[var(--text-primary)] font-medium mt-2">
                {currentProgress.message}
              </p>
            </div>
          )}

          {migrationResult && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold ${
                migrationResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              }`}
            >
              <p className="font-bold text-sm mb-1">
                {migrationResult.success ? "✓ Migrasi Berhasil Sempurna" : "⚠ Migrasi Selesai dengan Catatan"}
              </p>
              <p>
                Berhasil menyalin <strong>{migrationResult.totalRowsTransferred} baris</strong> data pada{" "}
                <strong>{migrationResult.successTables} tabel</strong>.
                {migrationResult.failedTables > 0 && ` (${migrationResult.failedTables} tabel gagal dipindahkan).`}
              </p>
            </div>
          )}

          {/* Log Window */}
          {logs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Log Riwayat Operasi
              </span>
              <div className="p-3 rounded-xl bg-black/80 text-emerald-400 font-mono text-[10.5px] max-h-48 overflow-y-auto space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

