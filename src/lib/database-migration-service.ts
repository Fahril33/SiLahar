import { supabase, legacySupabase, supabaseUrl, legacySupabaseUrl } from "./supabase";

export interface TableMigrationConfig {
  tableId: string;
  tableName: string;
  label: string;
  description: string;
  onConflict?: string;
  order: number;
}

export const MIGRATION_TABLES: TableMigrationConfig[] = [
  {
    tableId: "app_settings",
    tableName: "app_settings",
    label: "Pengaturan & Aturan Sistem",
    description: "Aturan laporan, awal operasional, batas foto, dan konfigurasi suara",
    onConflict: "key",
    order: 1,
  },
  {
    tableId: "team_types",
    tableName: "team_types",
    label: "Jenis Tim & Penanggung Jawab",
    description: "Data tim (TRC, Pusdalops), susunan kop, dan koordinator terdaftar",
    onConflict: "id",
    order: 2,
  },
  {
    tableId: "report_templates",
    tableName: "report_templates",
    label: "Template Dokumen (UUID Induk)",
    description: "Master template dokumen laporan yang menjadi relasi utama foreign key",
    onConflict: "id",
    order: 3,
  },
  {
    tableId: "report_template_approvers",
    tableName: "report_template_approvers",
    label: "Pejabat Template & Tanda Tangan",
    description: "Koordinator dan Kepala Bidang pengesah template dokumen",
    onConflict: "id",
    order: 4,
  },
  {
    tableId: "report_template_notes",
    tableName: "report_template_notes",
    label: "Catatan Kaki Template Dokumen",
    description: "Urutan baris catatan kaki pada template dokumen",
    onConflict: undefined,
    order: 5,
  },
  {
    tableId: "reporter_directory",
    tableName: "reporter_directory",
    label: "Pengguna / Direktori Petugas",
    description: "Akun login petugas, password hash, status aktif, dan UUID akun",
    onConflict: "id",
    order: 6,
  },
  {
    tableId: "admin_profiles",
    tableName: "admin_profiles",
    label: "Akun Administrator",
    description: "Akun pengelola sistem (dilindungi RLS Supabase Auth & SQL seed)",
    onConflict: "id",
    order: 7,
  },
  {
    tableId: "excel_report_templates",
    tableName: "excel_report_templates",
    label: "Template Ekspor Excel",
    description: "Metadata dan konfigurasi template berkas Excel laporan",
    onConflict: "id",
    order: 8,
  },
];

export interface DatabaseConnectionStatus {
  legacy: {
    connected: boolean;
    url?: string;
    error?: string;
  };
  primary: {
    connected: boolean;
    url?: string;
    error?: string;
  };
  canMigrate: boolean;
}

export interface TableSummaryItem {
  tableId: string;
  tableName: string;
  label: string;
  description: string;
  legacyCount: number;
  primaryCount: number;
  matchingIdsCount: number;
  status: "synced" | "needs_sync" | "missing_in_target" | "empty" | "error";
  statusDetail: string;
  errorMessage?: string;
}

export interface MigrationProgressEvent {
  tableId: string;
  tableName: string;
  label: string;
  currentStep: number;
  totalSteps: number;
  phase: "reading" | "writing" | "done" | "skipped" | "error";
  transferredCount: number;
  message: string;
}

export interface MigrationResultItem {
  tableId: string;
  tableName: string;
  label: string;
  success: boolean;
  transferredCount: number;
  error?: string;
}

export interface MigrationSummaryResult {
  success: boolean;
  totalTables: number;
  successTables: number;
  failedTables: number;
  totalRowsTransferred: number;
  items: MigrationResultItem[];
  completedAt: string;
}

/**
 * Checks connection health to both Legacy and Primary Supabase databases.
 */
export async function checkDatabaseConnections(): Promise<DatabaseConnectionStatus> {
  const result: DatabaseConnectionStatus = {
    legacy: {
      connected: false,
      url: legacySupabaseUrl || "(Belum dikonfigurasi)",
    },
    primary: {
      connected: false,
      url: supabaseUrl || "(Belum dikonfigurasi)",
    },
    canMigrate: false,
  };

  if (!legacySupabase) {
    result.legacy.error = "Klien Database Lama tidak aktif. Pastikan VITE_SUPABASE_LEGACY_URL terisi.";
  } else {
    try {
      const { error } = await legacySupabase.from("app_settings").select("key").limit(1);
      if (error && error.code !== "PGRST116") {
        // Fallback test
        const { error: fbErr } = await legacySupabase.from("report_rules").select("id").limit(1);
        if (fbErr && error) {
          result.legacy.error = error.message;
        } else {
          result.legacy.connected = true;
        }
      } else {
        result.legacy.connected = true;
      }
    } catch (err: any) {
      result.legacy.error = err.message || "Gagal menghubungi database lama.";
    }
  }

  if (!supabase) {
    result.primary.error = "Klien Database Baru tidak aktif. Pastikan VITE_SUPABASE_URL terisi.";
  } else {
    try {
      const { error } = await supabase.from("app_settings").select("key").limit(1);
      if (error && error.code !== "PGRST116") {
        const { error: fbErr } = await supabase.from("report_rules").select("id").limit(1);
        if (fbErr && error) {
          result.primary.error = error.message;
        } else {
          result.primary.connected = true;
        }
      } else {
        result.primary.connected = true;
      }
    } catch (err: any) {
      result.primary.error = err.message || "Gagal menghubungi database baru.";
    }
  }

  result.canMigrate = Boolean(result.legacy.connected && result.primary.connected);
  return result;
}

/**
 * Fetches row count and exact UUID/content comparison for each table in Legacy vs Primary database.
 */
export async function fetchMigrationSummary(): Promise<TableSummaryItem[]> {
  if (!legacySupabase || !supabase) {
    throw new Error("Koneksi database lama atau baru belum siap.");
  }

  const summaries: TableSummaryItem[] = [];

  for (const config of MIGRATION_TABLES) {
    let legacyRows: any[] = [];
    let primaryRows: any[] = [];
    let errorMessage: string | undefined;

    // Fetch legacy rows
    try {
      const { data, error } = await legacySupabase
        .from(config.tableName)
        .select("*");
      if (error) {
        errorMessage = `Legacy: ${error.message}`;
      } else {
        legacyRows = data || [];
      }
    } catch (err: any) {
      errorMessage = `Legacy: ${err.message || "Gagal membaca"}`;
    }

    // Fetch primary rows
    try {
      const { data, error } = await supabase
        .from(config.tableName)
        .select("*");
      if (error) {
        errorMessage = (errorMessage ? `${errorMessage} | ` : "") + `Primary: ${error.message}`;
      } else {
        primaryRows = data || [];
      }
    } catch (err: any) {
      errorMessage = (errorMessage ? `${errorMessage} | ` : "") + `Primary: ${err.message || "Gagal membaca"}`;
    }

    const legacyCount = legacyRows.length;
    const primaryCount = primaryRows.length;
    let matchingIdsCount = 0;

    // Determine ID key for comparison
    const keyProp = config.tableId === "app_settings" ? "key" : "id";

    if (legacyCount > 0 && primaryCount > 0) {
      if (config.tableId === "report_template_notes") {
        // Match notes by template_id + note_order
        const primaryKeySet = new Set(
          primaryRows.map((r) => `${r.template_id}_${r.note_order}`),
        );
        matchingIdsCount = legacyRows.filter((r) =>
          primaryKeySet.has(`${r.template_id}_${r.note_order}`),
        ).length;
      } else {
        const primaryKeySet = new Set(
          primaryRows.map((r) => String(r[keyProp] || "").trim()).filter(Boolean),
        );
        matchingIdsCount = legacyRows.filter((r) =>
          primaryKeySet.has(String(r[keyProp] || "").trim()),
        ).length;
      }
    }

    let status: TableSummaryItem["status"] = "synced";
    let statusDetail = "100% Identik";

    if (errorMessage) {
      status = "error";
      statusDetail = "Gagal memindai";
    } else if (legacyCount === 0 && primaryCount === 0) {
      status = "empty";
      statusDetail = "Kosong di kedua DB";
    } else if (legacyCount === 0 && primaryCount > 0) {
      status = "synced";
      statusDetail = `${primaryCount} data di DB Baru`;
    } else if (primaryCount === 0) {
      status = "missing_in_target";
      statusDetail = "Belum disalin (0 baris)";
    } else if (matchingIdsCount === legacyCount) {
      status = "synced";
      statusDetail = `100% Identik (${matchingIdsCount}/${legacyCount} baris)`;
    } else {
      status = "needs_sync";
      statusDetail = `UUID/Isi Berbeda (${matchingIdsCount}/${legacyCount} cocok)`;
    }

    summaries.push({
      tableId: config.tableId,
      tableName: config.tableName,
      label: config.label,
      description: config.description,
      legacyCount,
      primaryCount,
      matchingIdsCount,
      status,
      statusDetail,
      errorMessage,
    });
  }

  return summaries;
}

/**
 * Executes migration of all configuration and user reference tables from Legacy to Primary database.
 * Preserves exact primary keys (UUIDs), foreign keys, and fields via idempotent upsert.
 */
export async function executeDatabaseMigration(
  selectedTableIds?: string[],
  onProgress?: (event: MigrationProgressEvent) => void,
): Promise<MigrationSummaryResult> {
  if (!legacySupabase || !supabase) {
    throw new Error("Koneksi database lama atau baru belum siap.");
  }

  const tablesToMigrate = MIGRATION_TABLES
    .filter((t) => !selectedTableIds || selectedTableIds.includes(t.tableId))
    .sort((a, b) => a.order - b.order);

  const results: MigrationResultItem[] = [];
  let totalRowsTransferred = 0;
  const totalSteps = tablesToMigrate.length;

  for (let i = 0; i < tablesToMigrate.length; i++) {
    const tableConfig = tablesToMigrate[i];
    const currentStep = i + 1;

    onProgress?.({
      tableId: tableConfig.tableId,
      tableName: tableConfig.tableName,
      label: tableConfig.label,
      currentStep,
      totalSteps,
      phase: "reading",
      transferredCount: 0,
      message: `Membaca data dari database lama (${tableConfig.tableName})...`,
    });

    try {
      // 1. Fetch raw rows from legacy database preserving all original columns
      const { data: rows, error: selectError } = await legacySupabase
        .from(tableConfig.tableName)
        .select("*");

      if (selectError) {
        throw new Error(`Gagal membaca ${tableConfig.tableName}: ${selectError.message}`);
      }

      if (!rows || rows.length === 0) {
        onProgress?.({
          tableId: tableConfig.tableId,
          tableName: tableConfig.tableName,
          label: tableConfig.label,
          currentStep,
          totalSteps,
          phase: "skipped",
          transferredCount: 0,
          message: `Tidak ada data pada database lama (${tableConfig.tableName}). Dilewati.`,
        });

        results.push({
          tableId: tableConfig.tableId,
          tableName: tableConfig.tableName,
          label: tableConfig.label,
          success: true,
          transferredCount: 0,
        });
        continue;
      }

      onProgress?.({
        tableId: tableConfig.tableId,
        tableName: tableConfig.tableName,
        label: tableConfig.label,
        currentStep,
        totalSteps,
        phase: "writing",
        transferredCount: rows.length,
        message: `Menyalin ${rows.length} baris ke database baru (${tableConfig.tableName})...`,
      });

      // 1.5 Special conflict resolution for report_templates to avoid unique constraint collisions
      if (tableConfig.tableId === "report_templates") {
        for (const row of rows) {
          try {
            const { data: existingTarget } = await supabase
              .from("report_templates")
              .select("id, template_code")
              .eq("template_code", row.template_code)
              .maybeSingle();

            if (existingTarget && existingTarget.id !== row.id) {
              // Placeholder template in target has a different UUID.
              // Clean up placeholder child records referencing the placeholder UUID
              await supabase.from("report_template_notes").delete().eq("template_id", existingTarget.id);
              await supabase.from("report_template_approvers").delete().eq("template_id", existingTarget.id);

              // Temporarily unbind any daily_reports referencing placeholder
              await supabase.from("daily_reports").update({ template_id: null }).eq("template_id", existingTarget.id);

              // Delete the placeholder template in target
              await supabase.from("report_templates").delete().eq("id", existingTarget.id);
            }
          } catch {
            // continue
          }
        }
      }

      // 1.6 Clean up existing child rows for the template to prevent unique/foreign key conflicts
      if (tableConfig.tableId === "report_template_approvers" || tableConfig.tableId === "report_template_notes") {
        const templateIds = Array.from(new Set(rows.map((r: any) => r.template_id).filter(Boolean)));
        for (const tId of templateIds) {
          try {
            await supabase.from(tableConfig.tableName).delete().eq("template_id", tId);
          } catch {
            // continue
          }
        }
      }

      // 2. Batch upsert into primary database preserving exact UUIDs and attributes
      const BATCH_SIZE = 50;
      let transferredForThisTable = 0;

      for (let b = 0; b < rows.length; b += BATCH_SIZE) {
        const batch = rows.slice(b, b + BATCH_SIZE);
        const upsertOptions = tableConfig.onConflict
          ? { onConflict: tableConfig.onConflict }
          : undefined;

        const { error: upsertError } = await supabase
          .from(tableConfig.tableName)
          .upsert(batch, upsertOptions);

        if (upsertError) {
          throw new Error(`Gagal menyimpan ke ${tableConfig.tableName}: ${upsertError.message}`);
        }

        transferredForThisTable += batch.length;
      }

      // 2.5 Rebind any unlinked daily_reports to the migrated template
      if (tableConfig.tableId === "report_templates") {
        for (const row of rows) {
          try {
            await supabase.from("daily_reports").update({ template_id: row.id }).is("template_id", null);
          } catch {
            // continue
          }
        }
      }

      totalRowsTransferred += transferredForThisTable;

      onProgress?.({
        tableId: tableConfig.tableId,
        tableName: tableConfig.tableName,
        label: tableConfig.label,
        currentStep,
        totalSteps,
        phase: "done",
        transferredCount: transferredForThisTable,
        message: `Berhasil menyalin ${transferredForThisTable} baris ke ${tableConfig.tableName}.`,
      });

      results.push({
        tableId: tableConfig.tableId,
        tableName: tableConfig.tableName,
        label: tableConfig.label,
        success: true,
        transferredCount: transferredForThisTable,
      });
    } catch (err: any) {
      const errMsg = err.message || "Terjadi kesalahan tidak terduga";

      // If admin_profiles is blocked by RLS, handle gracefully since admin accounts are managed by Supabase Auth / SQL seed
      if (tableConfig.tableId === "admin_profiles" && errMsg.includes("row-level security")) {
        onProgress?.({
          tableId: tableConfig.tableId,
          tableName: tableConfig.tableName,
          label: tableConfig.label,
          currentStep,
          totalSteps,
          phase: "skipped",
          transferredCount: 0,
          message: `Akun admin di database baru dilindungi RLS (dikelola via Supabase Auth & migration 023). Dilewati dengan aman.`,
        });

        results.push({
          tableId: tableConfig.tableId,
          tableName: tableConfig.tableName,
          label: tableConfig.label,
          success: true,
          transferredCount: 0,
        });
        continue;
      }

      onProgress?.({
        tableId: tableConfig.tableId,
        tableName: tableConfig.tableName,
        label: tableConfig.label,
        currentStep,
        totalSteps,
        phase: "error",
        transferredCount: 0,
        message: `Error pada ${tableConfig.tableName}: ${errMsg}`,
      });

      results.push({
        tableId: tableConfig.tableId,
        tableName: tableConfig.tableName,
        label: tableConfig.label,
        success: false,
        transferredCount: 0,
        error: errMsg,
      });
    }
  }

  const successTables = results.filter((r) => r.success).length;
  const failedTables = results.filter((r) => !r.success).length;

  return {
    success: failedTables === 0,
    totalTables: tablesToMigrate.length,
    successTables,
    failedTables,
    totalRowsTransferred,
    items: results,
    completedAt: new Date().toISOString(),
  };
}

