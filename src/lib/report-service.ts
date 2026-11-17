import type { SupabaseClient } from "@supabase/supabase-js";
import { type ReportRules, initialReportRules } from "../types/report-rules";
import { fallbackReportTemplateConfig } from "./report-template-defaults";
import { resolveAccountForDate } from "./database-routing-service";
import type { AdminProfile, AdminSessionState } from "../types/admin";
import type { NotificationSettings } from "../types/notification-settings";
import {
  supabase,
  legacySupabase,
  legacySupabaseUrl,
  getReadSupabaseClients,
  getSettingsSupabaseClients,
  getClientForUrl,
} from "./supabase";
import { logSafeError, logSafeWarn } from "./logger";
import { mapReportRow } from "./report-mappers";
import {
  formatReporterNameForDatabase,
  isAdminName,
  normalizeReporterName,
} from "./reporter-name";
import {
  loadCachedReporterNames,
  saveCachedReporterNames,
  loadDeviceSubmittedNames,
  saveDeviceSubmittedNames,
  loadCachedReports,
  saveCachedReports,
} from "./storage";
import type {
  DraftReport,
  Report,
  ReporterDirectoryProfile,
} from "../types/report";
import { optimizeReportImage } from "./image-optimizer";
import { getWitaToday } from "./time";

const PROOF_BUCKET = "daily-report-proofs";

type PendingPhotoMap = Record<number, File[]>;

type ReportRulesRow = {
  allow_any_report_date?: boolean;
  max_photos_per_activity?: number;
  system_start_date?: string;
};

type NotificationSettingsRow = {
  show_admin_sound_settings?: boolean;
  disable_sound_responses_for_all_users?: boolean;
  success?: {
    mode?: "random" | "specific";
    specific_file?: string | null;
  };
  fail?: {
    mode?: "random" | "specific";
    specific_file?: string | null;
  };
};

type ReportTemplateNoteRow = {
  note_order: number;
  note_text: string;
};

type AdminProfileRow = {
  id: string;
  full_name: string;
  role: "admin" | "super_admin";
  is_active: boolean;
};

type ReporterDirectoryRow = {
  id: string;
  full_name: string;
  first_reported_at: string | null;
  last_reported_at: string | null;
  total_reports: number | null;
  is_active: boolean;
};

type ReporterTraceReportRow = {
  id: string;
  daily_report_activities?: Array<{
    daily_report_activity_photos?: Array<{
      storage_path: string;
    }>;
  }>;
};

type ReportTemplateRow = {
  report_template_notes?: ReportTemplateNoteRow[];
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function mapAdminProfile(row: AdminProfileRow): AdminProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
  };
}

function mapReporterDirectoryRow(
  row: ReporterDirectoryRow,
): ReporterDirectoryProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    firstReportedAt: row.first_reported_at,
    lastReportedAt: row.last_reported_at,
    totalReports: Number(row.total_reports ?? 0),
    isActive: row.is_active,
  };
}

async function removeExistingAssets(report: Report, client: SupabaseClient = supabase!) {
  if (!client) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { error: deleteActivitiesError } = await client
    .from("daily_report_activities")
    .delete()
    .eq("report_id", report.id);

  if (deleteActivitiesError) {
    throw deleteActivitiesError;
  }
}

export async function fetchReports() {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    return [];
  }

  const templateFallback = fallbackReportTemplateConfig.notes;
  const selectQuery = `
      id,
      template_id,
      reporter_name,
      tim,
      display_date_text,
      report_date,
      template_approver_coordinator_id,
      approver_coordinator_name,
      approver_coordinator_nip,
      approver_coordinator_role:template_approver_coordinator_id (
        scope_label,
        signature_url
      ),
      template_approver_division_head_id,
      approver_division_head_role:template_approver_division_head_id (
        scope_label,
        signature_url
      ),
      approver_division_head_name,
      approver_division_head_title,
      approver_division_head_nip,
      created_at,
      updated_at,
      created_by_role,
      created_by_label,
      updated_by_role,
      updated_by_label,
      report_template:report_templates (
        report_template_notes (
          note_order,
          note_text
        )
      ),
      daily_report_activities (
        id,
        activity_order,
        activity_description,
        start_time_text,
        end_time_text,
        daily_report_activity_photos (
          id,
          activity_id,
          storage_path,
          public_url,
          original_file_name,
          sort_order,
          created_at
        )
      )
    `;

  const fetchClientReports = async (client: (typeof clients)[0]) => {
    const allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await client
        .from("daily_reports")
        .select(selectQuery)
        .order("report_date", { ascending: false })
        .order("updated_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        logSafeWarn("Gagal fetch daily_reports dari client Supabase:", error);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      allRows.push(...data);
      if (data.length < pageSize) {
        break;
      }
      from += pageSize;
    }

    // Evaluasi aturan routing periode database yang diatur admin
    const filteredRows = allRows.filter((row) => {
      const routedAccount = resolveAccountForDate(row.report_date);
      // Jika aturan menetapkan periode ini dari DB Baru, jangan ambil dari database legacy
      if (client === legacySupabase && supabase && routedAccount === "primary") {
        return false;
      }
      return true;
    });

    return filteredRows.map((row) =>
      mapReportRow(
        {
          ...row,
          report_template_notes:
            (row.report_template as ReportTemplateRow | null)?.report_template_notes?.length
              ? (row.report_template as ReportTemplateRow).report_template_notes
              : templateFallback.map((note, index) => ({
                  note_order: index + 1,
                  note_text: note,
                })),
        },
        client,
      ),
    );
  };

  const results = await Promise.all(clients.map((c) => fetchClientReports(c)));

  // Kumpulkan kunci tanggal & nama laporan dari DB baru agar salinan di legacy selalu terdeduplikasi
  const primaryKeys = new Set<string>();
  for (const list of results) {
    for (const rep of list) {
      if (rep.databaseAccount !== "legacy") {
        primaryKeys.add(`${rep.reportDate}_${normalizeReporterName(rep.nama)}`);
      }
    }
  }

  // Deduplikasi by ID dan (reportDate + normalized nama): primary client (new database) takes precedence
  const reportMap = new Map<string, Report>();
  for (const list of results) {
    for (const report of list) {
      if (report.databaseAccount === "legacy") {
        const key = `${report.reportDate}_${normalizeReporterName(report.nama)}`;
        if (primaryKeys.has(key)) {
          continue;
        }
      }

      if (!reportMap.has(report.id)) {
        reportMap.set(report.id, report);
      }
    }
  }

  const merged = Array.from(reportMap.values());
  merged.sort((a, b) => {
    const dateComp = b.reportDate.localeCompare(a.reportDate);
    if (dateComp !== 0) return dateComp;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return merged;
}

export async function fetchReporterDirectoryNames() {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    return [];
  }

  const nameSet = new Set<string>();

  await Promise.all(
    clients.map(async (client) => {
      try {
        const { data, error } = await client
          .from("reporter_directory")
          .select("full_name")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (error) {
          logSafeWarn("Gagal fetch reporter_directory dari salah satu client:", error);
          return;
        }

        for (const row of data ?? []) {
          if (row.full_name && !isAdminName(row.full_name)) {
            nameSet.add(row.full_name.trim());
          }
        }
      } catch (err) {
        logSafeWarn("Error fetch reporter_directory:", err);
      }
    }),
  );

  return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
}

type AuditReportRow = {
  id: string;
  reporter_directory_id?: string | null;
  reporter_name: string | null;
  report_date: string | null;
  display_date_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UniqueDbReport = {
  canonicalKey: string;
  ids: Set<string>;
  dateKey: string;
  displayKey: string;
};

async function fetchDailyReportAuditRows(
  client: SupabaseClient,
): Promise<{ rows: AuditReportRow[]; ok: boolean }> {
  const pageSize = 1000;
  let selectCols =
    "id, reporter_directory_id, reporter_name, report_date, display_date_text, created_at, updated_at";
  const fallbackCols =
    "id, reporter_directory_id, reporter_name, report_date, updated_at";

  const rows: AuditReportRow[] = [];
  let from = 0;

  while (true) {
    let { data, error } = await client
      .from("daily_reports")
      .select(selectCols)
      .order("report_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error && from === 0 && selectCols !== fallbackCols) {
      selectCols = fallbackCols;
      const retry = await client
        .from("daily_reports")
        .select(selectCols)
        .order("report_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      logSafeWarn("Gagal audit daily_reports dari client Supabase:", error);
      return { rows, ok: false };
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...(data as unknown as AuditReportRow[]));
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return { rows, ok: true };
}

function dedupeUserDbReports(rows: AuditReportRow[]): UniqueDbReport[] {
  const map = new Map<string, UniqueDbReport>();
  for (const row of rows) {
    const dateKey = row.report_date ? row.report_date.trim().slice(0, 10) : "";
    const displayKey = row.display_date_text
      ? normalizeReporterName(row.display_date_text)
      : "";
    const canonicalKey = dateKey || displayKey || row.id;
    const existing = map.get(canonicalKey);
    if (existing) {
      existing.ids.add(row.id);
      if (!existing.dateKey && dateKey) existing.dateKey = dateKey;
      if (!existing.displayKey && displayKey) existing.displayKey = displayKey;
    } else {
      map.set(canonicalKey, {
        canonicalKey,
        ids: new Set([row.id]),
        dateKey,
        displayKey,
      });
    }
  }
  return Array.from(map.values());
}

function countCrossDbSyncedReports(
  primaryList: UniqueDbReport[],
  legacyList: UniqueDbReport[],
): number {
  if (primaryList.length === 0 || legacyList.length === 0) return 0;

  const matchedPrimary = new Set<number>();
  const matchedLegacy = new Set<number>();

  // Index primary report IDs -> index
  const primaryIdToIndex = new Map<string, number>();
  primaryList.forEach((p, idx) => {
    for (const id of p.ids) {
      if (!primaryIdToIndex.has(id)) {
        primaryIdToIndex.set(id, idx);
      }
    }
  });

  // Pass 1: exact ID match
  legacyList.forEach((leg, lIdx) => {
    for (const id of leg.ids) {
      const pIdx = primaryIdToIndex.get(id);
      if (pIdx !== undefined && !matchedPrimary.has(pIdx)) {
        matchedPrimary.add(pIdx);
        matchedLegacy.add(lIdx);
        break;
      }
    }
  });

  // Pass 2: report_date (YYYY-MM-DD) match
  const primaryDateToIndices = new Map<string, number[]>();
  primaryList.forEach((p, idx) => {
    if (matchedPrimary.has(idx) || !p.dateKey) return;
    const arr = primaryDateToIndices.get(p.dateKey) || [];
    arr.push(idx);
    primaryDateToIndices.set(p.dateKey, arr);
  });

  legacyList.forEach((leg, lIdx) => {
    if (matchedLegacy.has(lIdx) || !leg.dateKey) return;
    const candidates = primaryDateToIndices.get(leg.dateKey);
    if (!candidates) return;
    const pIdx = candidates.find((idx) => !matchedPrimary.has(idx));
    if (pIdx !== undefined) {
      matchedPrimary.add(pIdx);
      matchedLegacy.add(lIdx);
    }
  });

  // Pass 3: normalized display_date_text match
  const primaryDisplayToIndices = new Map<string, number[]>();
  primaryList.forEach((p, idx) => {
    if (matchedPrimary.has(idx) || !p.displayKey) return;
    const arr = primaryDisplayToIndices.get(p.displayKey) || [];
    arr.push(idx);
    primaryDisplayToIndices.set(p.displayKey, arr);
  });

  legacyList.forEach((leg, lIdx) => {
    if (matchedLegacy.has(lIdx) || !leg.displayKey) return;
    const candidates = primaryDisplayToIndices.get(leg.displayKey);
    if (!candidates) return;
    const pIdx = candidates.find((idx) => !matchedPrimary.has(idx));
    if (pIdx !== undefined) {
      matchedPrimary.add(pIdx);
      matchedLegacy.add(lIdx);
    }
  });

  return matchedLegacy.size;
}

function pickTimestamp(
  current: string | null | undefined,
  candidate: string | null | undefined,
  mode: "earliest" | "latest",
): string | null {
  if (!candidate || candidate.trim() === "") return current ?? null;
  if (!current || current.trim() === "") return candidate;

  const curIsDateOnly = current.trim().length <= 10;
  const candIsDateOnly = candidate.trim().length <= 10;
  if (candIsDateOnly && !curIsDateOnly && candidate.slice(0, 10) === current.slice(0, 10)) {
    return current;
  }
  if (curIsDateOnly && !candIsDateOnly && current.slice(0, 10) === candidate.slice(0, 10)) {
    return candidate;
  }

  const cTime = Date.parse(current);
  const nTime = Date.parse(candidate);
  if (Number.isNaN(cTime)) return Number.isNaN(nTime) ? current : candidate;
  if (Number.isNaN(nTime)) return current;

  return mode === "earliest"
    ? nTime < cTime
      ? candidate
      : current
    : nTime > cTime
      ? candidate
      : current;
}

export async function fetchReporterDirectoryProfiles() {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    return [];
  }

  const profileMap = new Map<string, ReporterDirectoryProfile>();
  const auditResults = new Map<
    "primary" | "legacy",
    { rows: AuditReportRow[]; ok: boolean }
  >();

  await Promise.all(
    clients.map(async (client) => {
      const isPrimary = client === supabase;
      const accountType: "primary" | "legacy" = isPrimary ? "primary" : "legacy";

      const [dirRes, auditRes] = await Promise.all([
        (async () => {
          try {
            return await client
              .from("reporter_directory")
              .select(
                "id, full_name, first_reported_at, last_reported_at, total_reports, is_active",
              )
              .order("full_name", { ascending: true });
          } catch (err) {
            return { data: null, error: err };
          }
        })(),
        fetchDailyReportAuditRows(client),
      ]);

      auditResults.set(accountType, auditRes);

      if (dirRes.error) {
        logSafeWarn(
          "Gagal fetch reporter_directory profiles dari salah satu client:",
          dirRes.error,
        );
        return;
      }

      for (const row of dirRes.data ?? []) {
        const profile = mapReporterDirectoryRow(row as ReporterDirectoryRow);
        if (isAdminName(profile.fullName)) continue;

        const key = normalizeReporterName(profile.fullName);
        if (!key) continue;

        const existing = profileMap.get(key);
        const reportsCount = profile.totalReports || 0;

        if (!existing) {
          profileMap.set(key, {
            ...profile,
            dbSources: [accountType],
            primaryId: isPrimary ? profile.id : null,
            legacyId: !isPrimary ? profile.id : null,
            primaryReportsCount: isPrimary ? reportsCount : 0,
            legacyReportsCount: !isPrimary ? reportsCount : 0,
          });
        } else {
          const nextDbSources = Array.from(
            new Set([...(existing.dbSources || []), accountType]),
          );
          profileMap.set(key, {
            ...existing,
            id: isPrimary ? profile.id : existing.id,
            fullName: isPrimary ? profile.fullName : existing.fullName,
            primaryId: isPrimary ? profile.id : existing.primaryId,
            legacyId: !isPrimary ? profile.id : existing.legacyId,
            primaryReportsCount: isPrimary
              ? reportsCount
              : existing.primaryReportsCount || 0,
            legacyReportsCount: !isPrimary
              ? reportsCount
              : existing.legacyReportsCount || 0,
            dbSources: nextDbSources,
            totalReports: Math.max(
              existing.totalReports || 0,
              profile.totalReports || 0,
            ),
            firstReportedAt: pickTimestamp(
              existing.firstReportedAt,
              profile.firstReportedAt,
              "earliest",
            ),
            lastReportedAt: pickTimestamp(
              existing.lastReportedAt,
              profile.lastReportedAt,
              "latest",
            ),
            isActive: existing.isActive || profile.isActive,
          });
        }
      }
    }),
  );

  // Build ID lookup indices to correlate daily_reports even if reporter_name changed
  const profileByPrimaryId = new Map<string, string>();
  const profileByLegacyId = new Map<string, string>();
  for (const [key, profile] of profileMap.entries()) {
    if (profile.primaryId) profileByPrimaryId.set(profile.primaryId, key);
    if (profile.legacyId) profileByLegacyId.set(profile.legacyId, key);
  }

  const primaryReportsByUser = new Map<string, AuditReportRow[]>();
  const legacyReportsByUser = new Map<string, AuditReportRow[]>();

  const primaryAudit = auditResults.get("primary");
  const legacyAudit = auditResults.get("legacy");
  const primaryAuditOk = Boolean(primaryAudit?.ok);
  const legacyAuditOk = Boolean(legacyAudit?.ok);

  if (primaryAuditOk && primaryAudit) {
    for (const row of primaryAudit.rows) {
      let targetKey = row.reporter_directory_id
        ? profileByPrimaryId.get(row.reporter_directory_id) ??
          profileByLegacyId.get(row.reporter_directory_id)
        : undefined;
      if (!targetKey && row.reporter_name) {
        const nameKey = normalizeReporterName(row.reporter_name);
        if (profileMap.has(nameKey)) targetKey = nameKey;
      }
      if (!targetKey) continue;
      const arr = primaryReportsByUser.get(targetKey) || [];
      arr.push(row);
      primaryReportsByUser.set(targetKey, arr);
    }
  }

  if (legacyAuditOk && legacyAudit) {
    for (const row of legacyAudit.rows) {
      let targetKey = row.reporter_directory_id
        ? profileByLegacyId.get(row.reporter_directory_id) ??
          profileByPrimaryId.get(row.reporter_directory_id)
        : undefined;
      if (!targetKey && row.reporter_name) {
        const nameKey = normalizeReporterName(row.reporter_name);
        if (profileMap.has(nameKey)) targetKey = nameKey;
      }
      if (!targetKey) continue;
      const arr = legacyReportsByUser.get(targetKey) || [];
      arr.push(row);
      legacyReportsByUser.set(targetKey, arr);
    }
  }

  const hasLegacyClient = Boolean(legacySupabase);
  const bothAuditsOk =
    Boolean(supabase ? primaryAuditOk : true) &&
    Boolean(hasLegacyClient ? legacyAuditOk : true);

  for (const [key, profile] of profileMap.entries()) {
    const pRows = primaryReportsByUser.get(key) || [];
    const lRows = legacyReportsByUser.get(key) || [];

    const pUnique = dedupeUserDbReports(pRows);
    const lUnique = dedupeUserDbReports(lRows);

    const primaryCount = primaryAuditOk
      ? pUnique.length
      : profile.primaryReportsCount ?? 0;
    const legacyCount = legacyAuditOk
      ? lUnique.length
      : profile.legacyReportsCount ?? 0;

    let syncedCount = 0;
    let totalReports: number;
    let primaryOnlyCount: number;
    let legacyOnlyCount: number;

    if (bothAuditsOk) {
      syncedCount = hasLegacyClient
        ? countCrossDbSyncedReports(pUnique, lUnique)
        : 0;
      primaryOnlyCount = Math.max(0, primaryCount - syncedCount);
      legacyOnlyCount = Math.max(0, legacyCount - syncedCount);
      totalReports = primaryCount + legacyCount - syncedCount;
    } else {
      primaryOnlyCount = primaryCount;
      legacyOnlyCount = legacyCount;
      totalReports = Math.max(primaryCount, legacyCount);
    }

    const dbSourcesSet = new Set<"primary" | "legacy">(profile.dbSources || []);
    if (profile.primaryId || primaryCount > 0) dbSourcesSet.add("primary");
    if (profile.legacyId || legacyCount > 0) dbSourcesSet.add("legacy");

    let firstReportedAt = profile.firstReportedAt;
    let lastReportedAt = profile.lastReportedAt;
    for (const r of pRows) {
      firstReportedAt = pickTimestamp(
        firstReportedAt,
        r.created_at || r.updated_at || r.report_date,
        "earliest",
      );
      lastReportedAt = pickTimestamp(
        lastReportedAt,
        r.updated_at || r.created_at || r.report_date,
        "latest",
      );
    }
    for (const r of lRows) {
      firstReportedAt = pickTimestamp(
        firstReportedAt,
        r.created_at || r.updated_at || r.report_date,
        "earliest",
      );
      lastReportedAt = pickTimestamp(
        lastReportedAt,
        r.updated_at || r.created_at || r.report_date,
        "latest",
      );
    }

    profileMap.set(key, {
      ...profile,
      dbSources: Array.from(dbSourcesSet),
      primaryReportsCount: primaryCount,
      legacyReportsCount: legacyCount,
      syncedReportsCount: syncedCount,
      primaryOnlyReportsCount: primaryOnlyCount,
      legacyOnlyReportsCount: legacyOnlyCount,
      totalReports,
      actualAudited: bothAuditsOk,
      firstReportedAt,
      lastReportedAt,
    });
  }

  return Array.from(profileMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

export async function fetchReportRules(): Promise<ReportRules> {
  const clients = getSettingsSupabaseClients();
  if (clients.length === 0) {
    return initialReportRules;
  }

  for (const client of clients) {
    try {
      const { data: settingData, error: settingError } = await client
        .from("app_settings")
        .select("value")
        .eq("key", "report_rules")
        .maybeSingle();

      if (!settingError && settingData?.value) {
        const val = settingData.value as {
          allow_any_report_date?: boolean;
          max_photos_per_activity?: number;
          system_start_date?: string;
        };
        return {
          allowAnyReportDate: Boolean(val.allow_any_report_date),
          maxPhotosPerActivity: Math.max(1, Number(val.max_photos_per_activity) || 1),
          systemStartDate: val.system_start_date || "",
        };
      }

      const { data, error } = await client.rpc("get_report_rules");
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        const rules = row as ReportRulesRow | null;
        if (rules) {
          return {
            allowAnyReportDate: Boolean(rules.allow_any_report_date),
            maxPhotosPerActivity: Math.max(1, Number(rules.max_photos_per_activity) || 1),
            systemStartDate: rules.system_start_date || "",
          };
        }
      }
    } catch {
      // try next client
    }
  }

  return initialReportRules;
}

export async function fetchNotificationSettings() {
  const fallback: NotificationSettings = {
    showAdminSoundSettings: true,
    disableSoundResponsesForAllUsers: false,
    success: {
      mode: "random",
      specificFile: null,
    },
    fail: {
      mode: "random",
      specificFile: null,
    },
  };

  const clients = getSettingsSupabaseClients();
  if (clients.length === 0) {
    return fallback;
  }

  for (const client of clients) {
    try {
      const { data, error } = await client.rpc("get_notification_settings");
      if (!error && data) {
        const row = (Array.isArray(data) ? data[0] : data) as
          | NotificationSettingsRow
          | undefined;
        if (row) {
          return {
            showAdminSoundSettings:
              row.show_admin_sound_settings !== undefined
                ? Boolean(row.show_admin_sound_settings)
                : true,
            disableSoundResponsesForAllUsers: Boolean(
              row.disable_sound_responses_for_all_users,
            ),
            success: {
              mode:
                row.success?.mode === "specific"
                  ? ("specific" as const)
                  : ("random" as const),
              specificFile: row.success?.specific_file ?? null,
            },
            fail: {
              mode:
                row.fail?.mode === "specific"
                  ? ("specific" as const)
                  : ("random" as const),
              specificFile: row.fail?.specific_file ?? null,
            },
          };
        }
      }
    } catch {
      // try next client
    }
  }

  return fallback;
}

export async function saveNotificationSettingsToDatabase(
  settings: NotificationSettings,
) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  let savedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    try {
      const { error } = await client.from("app_settings").upsert(
        {
          key: "notification_settings",
          value: {
            show_admin_sound_settings: settings.showAdminSoundSettings,
            disable_sound_responses_for_all_users:
              settings.disableSoundResponsesForAllUsers,
            success: {
              mode: settings.success.mode,
              specific_file: settings.success.specificFile,
            },
            fail: {
              mode: settings.fail.mode,
              specific_file: settings.fail.specificFile,
            },
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      if (!error) {
        savedAny = true;
      } else {
        lastError = error;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!savedAny && lastError) {
    throw lastError;
  }

  return fetchNotificationSettings();
}

async function fetchAdminProfile(userId: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Akun ini belum terdaftar sebagai admin aktif.");
  }

  return mapAdminProfile(data as AdminProfileRow);
}

export async function getActiveAdminSession() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session?.user) {
    return null;
  }

  const profile = await fetchAdminProfile(data.session.user.id);

  return {
    session: data.session,
    user: data.session.user,
    profile,
  } satisfies AdminSessionState;
}

export function subscribeAdminSession(
  onChange: (session: AdminSessionState | null) => void,
) {
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      onChange(null);
      return;
    }

    void fetchAdminProfile(session.user.id)
      .then((profile) => onChange({ session, user: session.user, profile }))
      .catch((error) => {
        logSafeError(error, "Auth/ProfileSubscription");
        onChange(null);
      });
  });

  return () => data.subscription.unsubscribe();
}

export function subscribeReportData(onChange: () => void) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    return () => {};
  }

  const channels = clients.map((client, idx) => {
    return client
      .channel(`silahar-report-data-${idx}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_reports" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_report_activities" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_report_activity_photos",
        },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reporter_directory" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "excel_report_templates" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_templates" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_template_notes" },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_template_approvers" },
        () => onChange(),
      )
      .subscribe();
  });

  return () => {
    channels.forEach((channel, idx) => {
      void clients[idx]?.removeChannel(channel);
    });
  };
}

export async function signInAdminAccount(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session?.user) {
    throw new Error("Sesi login admin belum berhasil dibuat.");
  }

  // Also log into legacySupabase if available so admin permissions are active across both databases
  if (legacySupabase) {
    try {
      await legacySupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    } catch (legErr) {
      logSafeWarn("Catatan autentikasi database legacy:", legErr);
    }
  }

  try {
    const profile = await fetchAdminProfile(data.session.user.id);

    return {
      session: data.session,
      user: data.session.user,
      profile,
    } satisfies AdminSessionState;
  } catch (error) {
    await supabase.auth.signOut();
    throw error;
  }
}

export async function signOutAdminAccount() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }
  if (legacySupabase) {
    try {
      await legacySupabase.auth.signOut();
    } catch {}
  }
}

export async function saveReportRulesToDatabase(rules: ReportRules) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const normalizedRules: ReportRules = {
    allowAnyReportDate: rules.allowAnyReportDate ?? false,
    maxPhotosPerActivity: Math.max(1, Number(rules.maxPhotosPerActivity) || 1),
    systemStartDate: rules.systemStartDate || "",
  };

  let savedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    try {
      const { error } = await client.from("app_settings").upsert(
        {
          key: "report_rules",
          value: {
            allow_any_report_date: normalizedRules.allowAnyReportDate,
            max_photos_per_activity: normalizedRules.maxPhotosPerActivity,
            system_start_date: normalizedRules.systemStartDate,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      if (!error) {
        savedAny = true;
      } else {
        lastError = error;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!savedAny && lastError) {
    throw lastError;
  }

  return fetchReportRules();
}

export async function checkReporterNameExists(name: string) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0 || !name.trim()) {
    return false;
  }

  const normalized = normalizeReporterName(name);
  const checks = await Promise.all(
    clients.map(async (client) => {
      try {
        const { data, error } = await client
          .from("reporter_directory")
          .select("id")
          .eq("normalized_name", normalized)
          .maybeSingle();

        return !error && Boolean(data);
      } catch {
        return false;
      }
    }),
  );

  return checks.some(Boolean);
}

export async function deleteReportFromDatabase(report: Report) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  // Group photos by their respective client based on publicUrl
  for (const activity of report.activities) {
    for (const photo of activity.photos) {
      if (photo.storagePath) {
        const cleanPath = photo.storagePath
          .replace(/^daily-report-proofs\//, "")
          .replace(/^\/+/, "");
        const targetClient = getClientForUrl(photo.publicUrl) || supabase;
        try {
          await targetClient?.storage.from(PROOF_BUCKET).remove([cleanPath]);
        } catch (err) {
          logSafeWarn("Gagal menghapus photo storage:", err);
        }
      }
    }
  }

  // Delete from all databases where this report ID might exist (primary and legacy)
  let deletedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    try {
      const { error } = await client
        .from("daily_reports")
        .delete()
        .eq("id", report.id);
      if (!error) {
        deletedAny = true;
      } else {
        lastError = error;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!deletedAny && lastError) {
    throw lastError;
  }
}

export async function renameReporterDirectoryProfile(
  reporterId: string,
  nextName: string,
) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  let updatedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    try {
      const { error } = await client.rpc("rename_reporter_directory_profile", {
        reporter_id_input: reporterId,
        next_full_name_input: formatReporterNameForDatabase(nextName),
      });
      if (!error) {
        updatedAny = true;
      } else {
        lastError = error;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!updatedAny && lastError) {
    throw lastError;
  }
}

export async function deleteReporterDirectoryTrace(
  reporterId: string,
  reporterName?: string,
  options?: {
    primaryId?: string | null;
    legacyId?: string | null;
  },
) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  let deletedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    const isPrimary = client === supabase;
    const initialTargetId = isPrimary
      ? options?.primaryId || reporterId
      : options?.legacyId || reporterId;

    try {
      // 1. Resolve actual user in this client by targetId OR by full_name
      // Note: Never use .or() with names that may contain commas!
      let clientUserId: string | null = null;
      if (initialTargetId && !initialTargetId.startsWith("orphan-")) {
        try {
          const { data: userById } = await client
            .from("reporter_directory")
            .select("id, full_name")
            .eq("id", initialTargetId)
            .maybeSingle();
          if (userById?.id) {
            clientUserId = userById.id;
          }
        } catch {}
      }

      if (!clientUserId && reporterName) {
        try {
          const { data: userByName } = await client
            .from("reporter_directory")
            .select("id, full_name")
            .eq("full_name", reporterName.trim())
            .maybeSingle();
          if (userByName?.id) {
            clientUserId = userByName.id;
          } else {
            const { data: userByIlike } = await client
              .from("reporter_directory")
              .select("id, full_name")
              .ilike("full_name", reporterName.trim())
              .maybeSingle();
            if (userByIlike?.id) {
              clientUserId = userByIlike.id;
            }
          }
        } catch {}
      }

      const resolvedTargetId = clientUserId || (initialTargetId && !initialTargetId.startsWith("orphan-") ? initialTargetId : null);

      // 2. Fetch all reports for this user in this client (both by reporter_directory_id and by reporter_name)
      // Query safely without PostgREST .or() to handle titles/names with commas
      const reportMap = new Map<string, ReporterTraceReportRow>();

      if (resolvedTargetId) {
        try {
          const { data: byIdReports } = await client
            .from("daily_reports")
            .select(`
              id,
              daily_report_activities (
                id,
                daily_report_activity_photos (
                  id,
                  storage_path
                )
              )
            `)
            .eq("reporter_directory_id", resolvedTargetId);

          for (const r of (byIdReports ?? [])) {
            reportMap.set(r.id, r as ReporterTraceReportRow);
          }
        } catch {}
      }

      if (reporterName) {
        const trimmedName = reporterName.trim();
        const formattedDbName = formatReporterNameForDatabase(reporterName);

        try {
          const { data: byNameReports } = await client
            .from("daily_reports")
            .select(`
              id,
              daily_report_activities (
                id,
                daily_report_activity_photos (
                  id,
                  storage_path
                )
              )
            `)
            .eq("reporter_name", trimmedName);

          for (const r of (byNameReports ?? [])) {
            reportMap.set(r.id, r as ReporterTraceReportRow);
          }
        } catch {}

        if (formattedDbName !== trimmedName) {
          try {
            const { data: byFormattedReports } = await client
              .from("daily_reports")
              .select(`
                id,
                daily_report_activities (
                  id,
                  daily_report_activity_photos (
                    id,
                    storage_path
                  )
                )
              `)
              .eq("reporter_name", formattedDbName);

            for (const r of (byFormattedReports ?? [])) {
              reportMap.set(r.id, r as ReporterTraceReportRow);
            }
          } catch {}
        }

        try {
          const { data: byIlikeReports } = await client
            .from("daily_reports")
            .select(`
              id,
              daily_report_activities (
                id,
                daily_report_activity_photos (
                  id,
                  storage_path
                )
              )
            `)
            .ilike("reporter_name", trimmedName);

          for (const r of (byIlikeReports ?? [])) {
            reportMap.set(r.id, r as ReporterTraceReportRow);
          }
        } catch {}
      }

      // 3. Delete related photos from storage bucket
      const allReports = Array.from(reportMap.values());
      const reportIds = Array.from(reportMap.keys());

      if (allReports.length > 0) {
        const storagePaths = allReports
          .flatMap((report) =>
            (report.daily_report_activities ?? []).flatMap((activity) =>
              (activity.daily_report_activity_photos ?? []).map(
                (photo) => {
                  const p = photo.storage_path;
                  return p ? p.replace(/^daily-report-proofs\//, "").replace(/^\/+/, "") : "";
                },
              ),
            ),
          )
          .filter(Boolean);

        if (storagePaths.length > 0) {
          try {
            await client.storage.from(PROOF_BUCKET).remove(storagePaths);
          } catch (storageErr) {
            logSafeWarn("Gagal menghapus storage photos:", storageErr);
          }
        }
      }

      // 4. Try RPC delete_reporter_directory_trace if resolvedTargetId exists
      if (resolvedTargetId) {
        try {
          const { error: rpcErr } = await client.rpc("delete_reporter_directory_trace", {
            reporter_id_input: resolvedTargetId,
          });
          if (!rpcErr) {
            deletedAny = true;
          }
        } catch {
          // ignore RPC errors and continue with direct deletion
        }
      }

      // 5. Direct delete child activities and photos, then reports from daily_reports
      if (reportIds.length > 0) {
        for (let i = 0; i < reportIds.length; i += 50) {
          const batch = reportIds.slice(i, i + 50);

          // Delete child photos and activities first to prevent FK constraint violations
          try {
            const { data: actRows } = await client
              .from("daily_report_activities")
              .select("id")
              .in("report_id", batch);

            const actIds = (actRows ?? []).map((a: any) => a.id).filter(Boolean);
            if (actIds.length > 0) {
              await client
                .from("daily_report_activity_photos")
                .delete()
                .in("activity_id", actIds);

              await client
                .from("daily_report_activities")
                .delete()
                .in("id", actIds);
            }
          } catch {}

          // Delete daily_reports batch
          try {
            const { error: repDelErr, count: repCount } = await client
              .from("daily_reports")
              .delete({ count: "exact" })
              .in("id", batch);

            if (!repDelErr && repCount && repCount > 0) {
              deletedAny = true;
            }
            if (repDelErr) {
              lastError = repDelErr;
            }
          } catch (batchErr) {
            lastError = batchErr;
          }
        }
      }

      // Also clean by reporter_name exact and ilike
      if (reporterName) {
        const trimmedName = reporterName.trim();
        const formattedDbName = formatReporterNameForDatabase(reporterName);

        try {
          const { error: delByNameErr, count: byNameCount } = await client
            .from("daily_reports")
            .delete({ count: "exact" })
            .eq("reporter_name", trimmedName);

          if (!delByNameErr && byNameCount && byNameCount > 0) {
            deletedAny = true;
          }
        } catch {}

        if (formattedDbName !== trimmedName) {
          try {
            const { count: byFmtCount } = await client
              .from("daily_reports")
              .delete({ count: "exact" })
              .eq("reporter_name", formattedDbName);

            if (byFmtCount && byFmtCount > 0) {
              deletedAny = true;
            }
          } catch {}
        }

        try {
          const { error: delByIlikeErr, count: byIlikeCount } = await client
            .from("daily_reports")
            .delete({ count: "exact" })
            .ilike("reporter_name", trimmedName);

          if (!delByIlikeErr && byIlikeCount && byIlikeCount > 0) {
            deletedAny = true;
          }
        } catch {}
      }

      // Also clean by reporter_directory_id
      if (resolvedTargetId) {
        try {
          const { error: delByIdErr, count: byIdCount } = await client
            .from("daily_reports")
            .delete({ count: "exact" })
            .eq("reporter_directory_id", resolvedTargetId);

          if (!delByIdErr && byIdCount && byIdCount > 0) {
            deletedAny = true;
          }
          if (delByIdErr) {
            lastError = delByIdErr;
          }
        } catch (delIdErr) {
          lastError = delIdErr;
        }

        // 6. Delete reporter_directory entry by ID
        try {
          const { error: userDelErr, count: userCount } = await client
            .from("reporter_directory")
            .delete({ count: "exact" })
            .eq("id", resolvedTargetId);

          if (!userDelErr && userCount && userCount > 0) {
            deletedAny = true;
          }
          if (userDelErr) {
            lastError = userDelErr;
          }
        } catch (delUserErr) {
          lastError = delUserErr;
        }
      }

      // Also delete reporter_directory entry by full_name
      if (reporterName) {
        try {
          const { count: uNameCount } = await client
            .from("reporter_directory")
            .delete({ count: "exact" })
            .eq("full_name", reporterName.trim());

          if (uNameCount && uNameCount > 0) {
            deletedAny = true;
          }
        } catch {}

        try {
          const { count: uIlikeCount } = await client
            .from("reporter_directory")
            .delete({ count: "exact" })
            .ilike("full_name", reporterName.trim());

          if (uIlikeCount && uIlikeCount > 0) {
            deletedAny = true;
          }
        } catch {}
      }
    } catch (clientErr) {
      lastError = clientErr;
    }
  }

  // Also clean up local storage caches
  if (reporterName && typeof window !== "undefined") {
    try {
      const normTarget = normalizeReporterName(reporterName);
      const cached = loadCachedReporterNames().filter(
        (n) => normalizeReporterName(n) !== normTarget,
      );
      saveCachedReporterNames(cached);

      const devNames = loadDeviceSubmittedNames().filter(
        (n) => normalizeReporterName(n) !== normTarget,
      );
      saveDeviceSubmittedNames(devNames);

      const cachedReps = loadCachedReports().filter(
        (r) => normalizeReporterName(r.nama) !== normTarget,
      );
      saveCachedReports(cachedReps);
    } catch {}
  }

  if (!deletedAny) {
    if (lastError) {
      throw new Error(
        `Penghapusan gagal: ${lastError.message || lastError.error_description || JSON.stringify(lastError)}`,
      );
    }
    throw new Error(
      "Penghapusan gagal: Tidak ada data yang berhasil dihapus dari database. Pastikan sesi admin memiliki izin hak akses.",
    );
  }
}

export async function authenticateReporter(
  name: string,
  pass: string,
): Promise<ReporterDirectoryProfile | null> {
  if (isAdminName(name)) {
    return null;
  }
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  for (const client of clients) {
    try {
      const { data, error } = await client.rpc("authenticate_reporter", {
        reporter_name: name,
        pass: pass,
      });

      if (!error && data && data.length > 0) {
        const row = data[0];

        // If authenticated from legacy client, automatically sync profile to new primary database
        if (client !== supabase && supabase) {
          try {
            await supabase.rpc("register_reporter", {
              reporter_name: row.full_name,
              pass: pass,
            });
          } catch {
            // ignore if already registered
          }
        }

        return {
          id: row.id,
          fullName: row.full_name,
          firstReportedAt: row.first_reported_at,
          lastReportedAt: row.last_reported_at,
          totalReports: row.total_reports,
          isActive: row.is_active,
          password: pass,
        };
      }
    } catch {
      // try next client
    }
  }

  return null;
}

export async function registerReporter(name: string, pass: string): Promise<ReporterDirectoryProfile> {
  if (isAdminName(name)) {
    throw new Error("Akun administrator tidak dapat didaftarkan sebagai petugas.");
  }
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }
  const { data, error } = await supabase.rpc("register_reporter", {
    reporter_name: name,
    pass: pass
  });
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Registrasi gagal.");
  }
  const row = data[0];
  return {
    id: row.id,
    fullName: row.full_name,
    firstReportedAt: row.first_reported_at,
    lastReportedAt: row.last_reported_at,
    totalReports: row.total_reports,
    isActive: row.is_active,
    password: pass
  };
}

export async function updateReporterProfile(
  reporterId: string,
  nextName: string,
  nextPass: string,
  options?: {
    primaryId?: string | null;
    legacyId?: string | null;
    oldName?: string;
  },
) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  let updatedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    const isPrimary = client === supabase;
    let targetId = isPrimary
      ? options?.primaryId || reporterId
      : options?.legacyId || reporterId;

    try {
      // Find matching user in this client if oldName provided and targetId not found
      if (options?.oldName) {
        let userRow: { id: string } | null = null;
        if (targetId && !targetId.startsWith("orphan-")) {
          try {
            const { data } = await client
              .from("reporter_directory")
              .select("id")
              .eq("id", targetId)
              .maybeSingle();
            if (data?.id) userRow = data;
          } catch {}
        }
        if (!userRow) {
          try {
            const { data } = await client
              .from("reporter_directory")
              .select("id")
              .eq("full_name", options.oldName.trim())
              .maybeSingle();
            if (data?.id) userRow = data;
          } catch {}
        }
        if (userRow?.id) {
          targetId = userRow.id;
        }
      }

      const { error } = await client.rpc("update_reporter_profile", {
        reporter_id: targetId,
        next_name: nextName,
        next_password: nextPass,
      });

      if (!error) {
        updatedAny = true;
      } else {
        // Fallback: direct update if RPC is missing
        const { error: directErr } = await client
          .from("reporter_directory")
          .update({
            full_name: nextName,
            normalized_name: formatReporterNameForDatabase(nextName),
          })
          .eq("id", targetId);

        if (!directErr) {
          updatedAny = true;
        } else {
          lastError = error;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!updatedAny && lastError) {
    throw lastError;
  }
}

export async function adminGetReporterPasswords(): Promise<Record<string, string>> {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const res: Record<string, string> = {};
  for (const client of clients) {
    try {
      // Check if client is authenticated before calling admin-only RPC to avoid 400 network error
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) {
        continue;
      }

      const { data, error } = await client.rpc("admin_get_reporter_passwords");
      if (!error && data) {
        for (const row of data) {
          if (!res[row.id]) {
            res[row.id] = row.password;
          }
        }
      }
    } catch {
      // continue next client
    }
  }

  return res;
}

export async function resolveTargetClientForReport(
  existingReport: Report | null,
  reportId?: string,
): Promise<{ client: SupabaseClient; account: "primary" | "legacy" }> {
  // If legacySupabase is not configured, always return primary supabase
  if (!legacySupabase) {
    if (!supabase) throw new Error("Supabase client belum terkonfigurasi.");
    return { client: supabase, account: "primary" };
  }

  // 0. Evaluasi aturan routing periode database
  const routedAccount = resolveAccountForDate(existingReport?.reportDate);
  if (routedAccount === "primary" && supabase) {
    return { client: supabase, account: "primary" };
  }

  // 1. If explicitly tagged as legacy
  if (existingReport?.databaseAccount === "legacy") {
    return { client: legacySupabase, account: "legacy" };
  }

  // 2. If existingReport photos point to legacySupabaseUrl
  if (
    existingReport?.activities?.some((a) =>
      a.photos?.some((p) => p.publicUrl?.includes(legacySupabaseUrl || "___never___")),
    )
  ) {
    return { client: legacySupabase, account: "legacy" };
  }

  const targetId = existingReport?.id || reportId;
  if (!targetId) {
    return { client: supabase || legacySupabase, account: supabase ? "primary" : "legacy" };
  }

  // 3. Verify where this report actually exists: check primary first
  if (supabase) {
    try {
      const { data } = await supabase
        .from("daily_reports")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();

      if (data?.id) {
        return { client: supabase, account: "primary" };
      }
    } catch {
      // continue to legacy check
    }
  }

  // 4. Check legacy
  try {
    const { data: legacyData } = await legacySupabase
      .from("daily_reports")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();

    if (legacyData?.id) {
      return { client: legacySupabase, account: "legacy" };
    }
  } catch {
    // fallback
  }

  return { client: supabase || legacySupabase, account: supabase ? "primary" : "legacy" };
}

async function upsertReporterDirectory(name: string, client: SupabaseClient = supabase!) {
  if (!client) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const formattedName = formatReporterNameForDatabase(name);
  const { data, error } = await client.rpc("upsert_reporter_directory_for_report", {
    reporter_name_input: formattedName,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Gagal mendapatkan ID reporter dari database.");
  }

  // Also sync reporter directory to primary database if we are targeting legacy
  if (client !== supabase && supabase) {
    try {
      await supabase.rpc("upsert_reporter_directory_for_report", {
        reporter_name_input: formattedName,
      });
    } catch {
      // ignore sync error
    }
  }

  return data as string;
}

async function upsertReportRow(
  draft: DraftReport,
  existingReport: Report | null,
  reportId: string,
  targetClient: SupabaseClient = supabase!,
) {
  if (!targetClient) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const reporterDirectoryId = await upsertReporterDirectory(draft.nama, targetClient);

  const isValidUuid = (id: string | null | undefined): id is string =>
    Boolean(
      id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    );

  const resolveTemplateId = (primary: string | null | undefined, fallback: string | null | undefined) =>
    isValidUuid(primary) ? primary : isValidUuid(fallback) ? fallback : null;

  const payload: any = {
    template_id: resolveTemplateId(draft.templateId, existingReport?.templateId),
    reporter_directory_id: reporterDirectoryId,
    reporter_name: formatReporterNameForDatabase(draft.nama),
    tim: draft.tim ?? "PUSDALOPS",
    report_date: draft.reportDate,
    template_approver_coordinator_id: resolveTemplateId(
      draft.approverCoordinatorTemplateId,
      existingReport?.approverCoordinatorTemplateId,
    ),
    approver_coordinator_name: draft.approverCoordinator,
    approver_coordinator_nip: draft.approverCoordinatorNip,
    template_approver_division_head_id: resolveTemplateId(
      draft.approverDivisionHeadTemplateId,
      existingReport?.approverDivisionHeadTemplateId,
    ),
    approver_division_head_name: draft.approverDivisionHead,
    approver_division_head_title: draft.approverDivisionHeadTitle,
    approver_division_head_nip: draft.approverDivisionHeadNip,
    created_by_role: existingReport?.createdByRole ?? "anonymous",
    created_by_label: existingReport?.createdByLabel ?? "Pengguna umum",
    updated_by_role: "anonymous" as const,
    updated_by_label: "Pengguna umum",
  };

  // Defensive FK verification: ensure template and approver IDs exist in targetClient
  try {
    if (payload.template_id) {
      const { data: tCheck } = await targetClient
        .from("report_templates")
        .select("id")
        .eq("id", payload.template_id)
        .maybeSingle();

      if (!tCheck) {
        // Fallback to active template in target database or null
        const { data: activeT } = await targetClient
          .from("report_templates")
          .select("id")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        payload.template_id = activeT?.id ?? null;
      }
    }

    if (payload.template_approver_coordinator_id) {
      const { data: cCheck } = await targetClient
        .from("report_template_approvers")
        .select("id")
        .eq("id", payload.template_approver_coordinator_id)
        .maybeSingle();

      if (!cCheck) {
        payload.template_approver_coordinator_id = null;
      }
    }

    if (payload.template_approver_division_head_id) {
      const { data: dCheck } = await targetClient
        .from("report_template_approvers")
        .select("id")
        .eq("id", payload.template_approver_division_head_id)
        .maybeSingle();

      if (!dCheck) {
        payload.template_approver_division_head_id = null;
      }
    }
  } catch (err) {
    console.warn("FK verification check encountered an error, falling back to safe payload:", err);
  }

  if (existingReport && existingReport.source !== "local") {
    let { data, error } = await targetClient
      .from("daily_reports")
      .update(payload)
      .eq("id", existingReport.id)
      .select("id")
      .maybeSingle();

    if (error && (error.code === "23503" || error.message.includes("foreign key constraint"))) {
      console.warn("FK constraint encountered during update, retrying with null template references:", error.message);
      payload.template_id = null;
      payload.template_approver_coordinator_id = null;
      payload.template_approver_division_head_id = null;
      const retry = await targetClient
        .from("daily_reports")
        .update(payload)
        .eq("id", existingReport.id)
        .select("id")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Laporan tidak dapat diperbarui. Kemungkinan tanggal laporan sudah lewat dan akses dibatasi oleh aturan sistem.",
      );
    }

    return data.id as string;
  }

  payload.id = existingReport?.id ?? reportId;
  let { data, error } = await targetClient
    .from("daily_reports")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .maybeSingle();

  if (error && (error.code === "23503" || error.message.includes("foreign key constraint"))) {
    console.warn("FK constraint encountered during insert, retrying with null template references:", error.message);
    payload.template_id = null;
    payload.template_approver_coordinator_id = null;
    payload.template_approver_division_head_id = null;
    const retry = await targetClient
      .from("daily_reports")
      .upsert(payload, { onConflict: "id" })
      .select("id")
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Laporan tidak dapat disimpan. Kemungkinan tanggal laporan tidak diizinkan oleh aturan sistem.",
    );
  }

  return data.id as string;
}

function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveReportToDatabase(
  draft: DraftReport,
  pendingPhotos: PendingPhotoMap,
  existingReport: Report | null,
  reportRules: ReportRules = initialReportRules,
  onStage?: (stageId: string, detail?: string) => void,
) {
  if (!supabase && !legacySupabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const reportId = existingReport?.id ?? generateUUID();
  const { client: targetClient } = await resolveTargetClientForReport(existingReport, reportId);

  // If allowAnyReportDate is enabled or this is a past date report, sync to targetClient app_settings
  if (reportRules.allowAnyReportDate || (existingReport && existingReport.reportDate !== getWitaToday())) {
    try {
      await targetClient.from("app_settings").upsert(
        {
          key: "report_rules",
          value: {
            allow_any_report_date: true,
            max_photos_per_activity: reportRules.maxPhotosPerActivity || 1,
            system_start_date: reportRules.systemStartDate || "",
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    } catch {
      // non-blocking
    }
  }

  // 1. Generate client-side UUIDs for each activity
  const activityIds = draft.activities.map(() => generateUUID());

  // 2. Upload all pending photos to Supabase Storage first (before making any database changes)
  const newUploadedPaths: string[] = [];
  const uploadsByActivityNo: Record<number, Array<{ storagePath: string; publicUrl: string; originalFileName: string }>> = {};

  try {
    for (const [index, activity] of draft.activities.entries()) {
      const files = (pendingPhotos[activity.no] ?? []).slice(0, reportRules.maxPhotosPerActivity);
      if (files.length > 0) {
        onStage?.("photos", `Mengunggah foto aktivitas ke-${activity.no}.`);
        const activityId = activityIds[index];
        const uploadedList = [];

        for (const [fileIndex, rawFile] of files.entries()) {
          // Kompresi ketat sebelum upload: downscale & kompresi ke WebP/JPEG (< 350 KB)
          const file = await optimizeReportImage(rawFile);
          const storagePath = `${reportId}/${activityId}/${Date.now()}-${fileIndex}-${sanitizeFileName(file.name)}`;

          let activeStorageClient = targetClient;
          let uploadResult = await activeStorageClient.storage
            .from(PROOF_BUCKET)
            .upload(storagePath, file, {
              upsert: false,
              contentType: file.type || "image/jpeg",
            });

          // Fallback to primary supabase storage if target is legacy and storage upload fails
          if (uploadResult.error && activeStorageClient !== supabase && supabase) {
            logSafeWarn("Gagal upload ke storage target, mencoba storage akun utama:", uploadResult.error);
            activeStorageClient = supabase;
            uploadResult = await activeStorageClient.storage
              .from(PROOF_BUCKET)
              .upload(storagePath, file, {
                upsert: false,
                contentType: file.type || "image/jpeg",
              });
          }

          if (uploadResult.error) {
            throw uploadResult.error;
          }
          newUploadedPaths.push(storagePath);

          const { data: publicUrlData } = activeStorageClient.storage.from(PROOF_BUCKET).getPublicUrl(storagePath);
          uploadedList.push({
            storagePath,
            publicUrl: publicUrlData.publicUrl,
            originalFileName: file.name,
          });
        }
        uploadsByActivityNo[activity.no] = uploadedList;
      }
    }
  } catch (err) {
    // If any file upload fails, clean up successfully uploaded files in this session
    if (newUploadedPaths.length > 0) {
      for (const c of getReadSupabaseClients()) {
        await c.storage.from(PROOF_BUCKET).remove(newUploadedPaths).catch(console.error);
      }
    }
    throw err;
  }

  // 3. Database operations (only executed if all storage uploads succeeded)
  onStage?.("prepare", "Memeriksa draft dan sinkronisasi data pelapor.");

  if (existingReport && existingReport.source !== "local") {
    const keptStoragePaths = new Set(
      draft.activities.flatMap((activity) => activity.photos.map((photo) => photo.storagePath)).filter(Boolean),
    );
    const deletedStoragePaths = existingReport.activities
      .flatMap((activity) => activity.photos.map((photo) => photo.storagePath))
      .filter((path) => !keptStoragePaths.has(path));

    if (deletedStoragePaths.length > 0) {
      for (const client of getReadSupabaseClients()) {
        try {
          await client.storage.from(PROOF_BUCKET).remove(deletedStoragePaths);
        } catch (err) {
          logSafeWarn("Gagal menghapus photo storage:", err);
        }
      }
    }

    await removeExistingAssets(existingReport, targetClient);
  }

  // Insert or update the report row
  await upsertReportRow(draft, existingReport, reportId, targetClient);

  // Insert the new activities
  onStage?.("activities", "Mencatat detail aktivitas ke database.");
  const activityPayload = draft.activities.map((activity, index) => ({
    id: activityIds[index],
    report_id: reportId,
    activity_order: activity.no,
    activity_description: activity.description,
    start_time_text: activity.startTime,
    end_time_text: activity.endTime,
  }));

  const { error: activitiesError } = await targetClient
    .from("daily_report_activities")
    .insert(activityPayload);

  if (activitiesError) {
    throw activitiesError;
  }

  // Insert the photos
  const photoRows: Array<{
    activity_id: string;
    storage_path: string;
    public_url: string;
    original_file_name: string;
    sort_order: number;
  }> = [];

  for (const [index, activity] of draft.activities.entries()) {
    const activityId = activityIds[index];
    const keptExistingPhotos = (activity.photos ?? []).slice(0, reportRules.maxPhotosPerActivity);
    const newUploads = uploadsByActivityNo[activity.no] ?? [];

    for (const [photoIndex, photo] of keptExistingPhotos.entries()) {
      photoRows.push({
        activity_id: activityId,
        storage_path: photo.storagePath,
        public_url: photo.publicUrl,
        original_file_name: photo.originalFileName,
        sort_order: photoIndex + 1,
      });
    }

    for (const [photoIndex, upload] of newUploads.entries()) {
      photoRows.push({
        activity_id: activityId,
        storage_path: upload.storagePath,
        public_url: upload.publicUrl,
        original_file_name: upload.originalFileName,
        sort_order: keptExistingPhotos.length + photoIndex + 1,
      });
    }
  }

  if (photoRows.length > 0) {
    const { error: photoInsertError } = await targetClient
      .from("daily_report_activity_photos")
      .insert(photoRows);

    if (photoInsertError) {
      throw photoInsertError;
    }
  }

  onStage?.("finalize", "Menyegarkan data terbaru dari database.");
  const reports = await fetchReports();
  return reports.find((report) => report.id === reportId) ?? null;
}
