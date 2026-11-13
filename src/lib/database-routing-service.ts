import { supabase, legacySupabase } from "./supabase";
import type {
  DatabasePeriodRoutingConfig,
  DatabaseTargetAccount,
} from "../types/database-routing";

const STORAGE_KEY = "silahar_database_period_routing_v1";

export const DEFAULT_DATABASE_PERIOD_ROUTING: DatabasePeriodRoutingConfig = {
  defaultAccount: "primary",
  preferPrimaryOnDuplicate: true,
  redirectLegacyPhotoUrls: true,
  rules: [
    {
      id: "rule-jan-aug-2026",
      name: "Periode Awal Tahun (Januari - Agustus 2026)",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      targetAccount: "legacy",
      description: "Data laporan historis sebelum migrasi diambil dari Database Lama.",
      enabled: true,
    },
    {
      id: "rule-sept-oct-2026",
      name: "Periode Transisi Migrasi (September - Oktober 2026)",
      startDate: "2026-09-01",
      endDate: "2026-10-31",
      targetAccount: "primary",
      description: "Data laporan periode September & Oktober diambil dari Database Baru.",
      enabled: true,
    },
    {
      id: "rule-nov-onwards-2026",
      name: "Periode Berjalan (November 2026 ke Depan)",
      startDate: "2026-11-01",
      endDate: "",
      targetAccount: "primary",
      description: "Seluruh laporan operasional baru dan berjalan murni menggunakan Database Baru.",
      enabled: true,
    },
  ],
};

let inMemoryConfig: DatabasePeriodRoutingConfig | null = null;

export function getCachedDatabasePeriodRouting(): DatabasePeriodRoutingConfig {
  if (inMemoryConfig) return inMemoryConfig;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rules)) {
        inMemoryConfig = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  inMemoryConfig = DEFAULT_DATABASE_PERIOD_ROUTING;
  return inMemoryConfig;
}

export function setCachedDatabasePeriodRouting(config: DatabasePeriodRoutingConfig): void {
  inMemoryConfig = config;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Resolves which database account ("primary" or "legacy") should provide data for a given reportDate (YYYY-MM-DD).
 */
export function resolveAccountForDate(
  reportDate?: string | null,
  customConfig?: DatabasePeriodRoutingConfig,
): DatabaseTargetAccount {
  // If legacySupabase is not configured at all, always use primary
  if (!legacySupabase) return "primary";

  const config = customConfig || getCachedDatabasePeriodRouting();
  if (!reportDate || typeof reportDate !== "string" || reportDate.trim() === "") {
    return config.defaultAccount;
  }

  const cleanDate = reportDate.trim().slice(0, 10);

  // Check matching enabled rules in order
  for (const rule of config.rules) {
    if (!rule.enabled) continue;

    const startMatch = !rule.startDate || cleanDate >= rule.startDate.trim();
    const endMatch = !rule.endDate || cleanDate <= rule.endDate.trim();

    if (startMatch && endMatch) {
      return rule.targetAccount;
    }
  }

  return config.defaultAccount;
}

/**
 * Loads database routing configuration from database app_settings.
 */
export async function fetchDatabasePeriodRouting(): Promise<DatabasePeriodRoutingConfig> {
  // 1. Try reading from primary database first
  const targetClient = supabase || legacySupabase;
  if (!targetClient) {
    return getCachedDatabasePeriodRouting();
  }

  try {
    const { data, error } = await targetClient
      .from("app_settings")
      .select("value")
      .eq("key", "database_period_routing")
      .maybeSingle();

    if (!error && data?.value && Array.isArray((data.value as any)?.rules)) {
      const val = data.value as DatabasePeriodRoutingConfig;
      setCachedDatabasePeriodRouting(val);
      return val;
    }
  } catch (err) {
    console.warn("Gagal membaca database_period_routing dari database:", err);
  }

  return getCachedDatabasePeriodRouting();
}

/**
 * Saves database routing configuration to primary database and updates cache.
 */
export async function saveDatabasePeriodRouting(
  config: DatabasePeriodRoutingConfig,
): Promise<void> {
  const updatedConfig: DatabasePeriodRoutingConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  setCachedDatabasePeriodRouting(updatedConfig);

  const targetClient = supabase || legacySupabase;
  if (!targetClient) {
    throw new Error("Koneksi Supabase belum siap.");
  }

  const { error } = await targetClient.from("app_settings").upsert(
    {
      key: "database_period_routing",
      value: updatedConfig,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    throw new Error(`Gagal menyimpan pengaturan routing database: ${error.message}`);
  }
}
