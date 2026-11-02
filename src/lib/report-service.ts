import { type ReportRules, initialReportRules } from "../types/report-rules";
import { fallbackReportTemplateConfig } from "./report-template-defaults";
import type { AdminProfile, AdminSessionState } from "../types/admin";
import type { NotificationSettings } from "../types/notification-settings";
import {
  supabase,
  getReadSupabaseClients,
  getClientForUrl,
} from "./supabase";
import { logSafeError, logSafeWarn } from "./logger";
import { mapReportRow } from "./report-mappers";
import {
  formatReporterNameForDatabase,
  isAdminName,
  normalizeReporterName,
} from "./reporter-name";
import type {
  DraftReport,
  Report,
  ReporterDirectoryProfile,
} from "../types/report";
import { optimizeReportImage } from "./image-optimizer";

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

async function removeExistingAssets(report: Report) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { error: deleteActivitiesError } = await supabase
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

    return allRows.map((row) =>
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

  // Deduplikasi by ID: primary client (new database) takes precedence
  const reportMap = new Map<string, Report>();
  for (const list of results) {
    for (const report of list) {
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

export async function fetchReporterDirectoryProfiles() {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    return [];
  }

  const profileMap = new Map<string, ReporterDirectoryProfile>();

  await Promise.all(
    clients.map(async (client) => {
      try {
        const { data, error } = await client
          .from("reporter_directory")
          .select(
            "id, full_name, first_reported_at, last_reported_at, total_reports, is_active",
          )
          .order("full_name", { ascending: true });

        if (error) {
          logSafeWarn("Gagal fetch reporter_directory profiles dari salah satu client:", error);
          return;
        }

        for (const row of (data ?? [])) {
          const profile = mapReporterDirectoryRow(row as ReporterDirectoryRow);
          if (isAdminName(profile.fullName)) continue;

          const key = profile.fullName.trim().toUpperCase();
          const existing = profileMap.get(key);
          if (!existing) {
            profileMap.set(key, profile);
          } else {
            profileMap.set(key, {
              ...existing,
              totalReports: (existing.totalReports || 0) + (profile.totalReports || 0),
              firstReportedAt:
                existing.firstReportedAt && profile.firstReportedAt
                  ? existing.firstReportedAt < profile.firstReportedAt
                    ? existing.firstReportedAt
                    : profile.firstReportedAt
                  : existing.firstReportedAt || profile.firstReportedAt,
              lastReportedAt:
                existing.lastReportedAt && profile.lastReportedAt
                  ? existing.lastReportedAt > profile.lastReportedAt
                    ? existing.lastReportedAt
                    : profile.lastReportedAt
                  : existing.lastReportedAt || profile.lastReportedAt,
              isActive: existing.isActive || profile.isActive,
            });
          }
        }
      } catch (err) {
        logSafeWarn("Error fetch reporter_directory profiles:", err);
      }
    }),
  );

  return Array.from(profileMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

export async function fetchReportRules(): Promise<ReportRules> {
  const clients = getReadSupabaseClients();
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

  const clients = getReadSupabaseClients();
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
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { error } = await supabase.from("app_settings").upsert(
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

  if (error) {
    throw error;
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
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function saveReportRulesToDatabase(rules: ReportRules) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const normalizedRules: ReportRules = {
    allowAnyReportDate: rules.allowAnyReportDate ?? false,
    maxPhotosPerActivity: Math.max(1, Number(rules.maxPhotosPerActivity) || 1),
    systemStartDate: rules.systemStartDate || "",
  };
  const { error } = await supabase.from("app_settings").upsert(
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

  if (error) {
    throw error;
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

export async function deleteReporterDirectoryTrace(reporterId: string) {
  const clients = getReadSupabaseClients();
  if (clients.length === 0) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  let deletedAny = false;
  let lastError: any = null;

  for (const client of clients) {
    try {
      const { data, error: reportFetchError } = await client
        .from("daily_reports")
        .select(
          `
          id,
          daily_report_activities (
            daily_report_activity_photos (
              storage_path
            )
          )
        `,
        )
        .eq("reporter_directory_id", reporterId);

      if (!reportFetchError && data) {
        const storagePaths = ((data ?? []) as ReporterTraceReportRow[])
          .flatMap((report) =>
            (report.daily_report_activities ?? []).flatMap((activity) =>
              (activity.daily_report_activity_photos ?? []).map(
                (photo) => photo.storage_path,
              ),
            ),
          )
          .filter(Boolean);

        if (storagePaths.length > 0) {
          await client.storage.from(PROOF_BUCKET).remove(storagePaths);
        }
      }

      const { error } = await client.rpc("delete_reporter_directory_trace", {
        reporter_id_input: reporterId,
      });

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

export async function updateReporterProfile(reporterId: string, nextName: string, nextPass: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }
  const { error } = await supabase.rpc("update_reporter_profile", {
    reporter_id: reporterId,
    next_name: nextName,
    next_password: nextPass
  });
  if (error) {
    throw error;
  }
}

export async function adminGetReporterPasswords(): Promise<Record<string, string>> {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }
  const { data, error } = await supabase.rpc("admin_get_reporter_passwords");
  if (error) {
    throw error;
  }
  const res: Record<string, string> = {};
  if (data) {
    for (const row of data) {
      res[row.id] = row.password;
    }
  }
  return res;
}

async function upsertReporterDirectory(name: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { data, error } = await supabase.rpc("upsert_reporter_directory_for_report", {
    reporter_name_input: formatReporterNameForDatabase(name),
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Gagal mendapatkan ID reporter dari database.");
  }

  return data as string;
}

async function upsertReportRow(draft: DraftReport, existingReport: Report | null, reportId: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const reporterDirectoryId = await upsertReporterDirectory(draft.nama);

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

  if (existingReport && existingReport.source !== "local") {
    const { data, error } = await supabase
      .from("daily_reports")
      .update(payload)
      .eq("id", existingReport.id)
      .select("id")
      .maybeSingle();

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
  const { data, error } = await supabase
    .from("daily_reports")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .maybeSingle();

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
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const reportId = existingReport?.id ?? generateUUID();

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
          const { error: uploadError } = await supabase.storage
            .from(PROOF_BUCKET)
            .upload(storagePath, file, {
              upsert: false,
              contentType: file.type || "image/jpeg",
            });

          if (uploadError) {
            throw uploadError;
          }
          newUploadedPaths.push(storagePath);

          const { data: publicUrlData } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(storagePath);
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
      await supabase.storage.from(PROOF_BUCKET).remove(newUploadedPaths).catch(console.error);
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
      const { error: removeStorageError } = await supabase.storage
        .from(PROOF_BUCKET)
        .remove(deletedStoragePaths);

      if (removeStorageError) {
        throw removeStorageError;
      }
    }

    await removeExistingAssets(existingReport);
  }

  // Insert or update the report row
  await upsertReportRow(draft, existingReport, reportId);

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

  const { error: activitiesError } = await supabase
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
    const { error: photoInsertError } = await supabase
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
