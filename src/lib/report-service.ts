import { DEFAULT_REPORT_RULES, normalizeReportRules, type ReportRules } from "../config/report-rules";
import { fallbackReportTemplateConfig } from "./report-template-defaults";
import type { AdminProfile, AdminSessionState } from "../types/admin";
import type { NotificationSettings } from "../types/notification-settings";
import { supabase } from "./supabase";
import { mapReportRow } from "./report-mappers";
import type {
  DraftReport,
  Report,
  ReporterDirectoryProfile,
} from "../types/report";

const PROOF_BUCKET = "daily-report-proofs";

type PendingPhotoMap = Record<number, File[]>;

type ReportRulesRow = {
  allow_any_report_date?: boolean;
  max_photos_per_activity?: number;
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
    fullName: row.full_name.toUpperCase(),
    role: row.role,
    isActive: row.is_active,
  };
}

function mapReporterDirectoryRow(
  row: ReporterDirectoryRow,
): ReporterDirectoryProfile {
  return {
    id: row.id,
    fullName: row.full_name.toUpperCase(),
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
  if (!supabase) {
    return [];
  }

  const templateFallback = fallbackReportTemplateConfig.notes;
  const { data, error } = await supabase
    .from("daily_reports")
    .select(`
      id,
      template_id,
      reporter_name,
      display_date_text,
      report_date,
      template_approver_coordinator_id,
      approver_coordinator_name,
      approver_coordinator_nip,
      template_approver_division_head_id,
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
    `)
    .order("report_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapReportRow({
      ...row,
      report_template_notes:
        (row.report_template as ReportTemplateRow | null)?.report_template_notes?.length
          ? (row.report_template as ReportTemplateRow).report_template_notes
          : templateFallback.map((note, index) => ({
              note_order: index + 1,
              note_text: note,
            })),
    }),
  );
}

export async function fetchReporterDirectoryNames() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("reporter_directory")
    .select("full_name, total_reports, last_reported_at")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.full_name.toUpperCase());
}

export async function fetchReporterDirectoryProfiles() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("reporter_directory")
    .select(
      "id, full_name, first_reported_at, last_reported_at, total_reports, is_active",
    )
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapReporterDirectoryRow(row as ReporterDirectoryRow),
  );
}

export async function fetchReportRules() {
  if (!supabase) {
    return DEFAULT_REPORT_RULES;
  }

  const { data, error } = await supabase.rpc("get_report_rules");

  if (error) {
    console.warn("Gagal memuat report_rules dari database, memakai fallback lokal.", error);
    return DEFAULT_REPORT_RULES;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const rules = row as ReportRulesRow | null;

  return normalizeReportRules({
    allowAnyReportDate: rules?.allow_any_report_date,
    maxPhotosPerActivity: rules?.max_photos_per_activity,
  });
}

export async function fetchNotificationSettings() {
  const fallback: NotificationSettings = {
    showAdminSoundSettings: false,
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

  if (!supabase) {
    return fallback;
  }

  const { data, error } = await supabase.rpc("get_notification_settings");

  if (error) {
    console.warn(
      "Gagal memuat notification_settings dari database, memakai fallback lokal.",
      error,
    );
    return fallback;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | NotificationSettingsRow
    | undefined;
  return {
    showAdminSoundSettings: Boolean(row?.show_admin_sound_settings),
    disableSoundResponsesForAllUsers: Boolean(
      row?.disable_sound_responses_for_all_users,
    ),
    success: {
      mode:
        row?.success?.mode === "specific"
          ? ("specific" as const)
          : ("random" as const),
      specificFile: row?.success?.specific_file ?? null,
    },
    fail: {
      mode:
        row?.fail?.mode === "specific"
          ? ("specific" as const)
          : ("random" as const),
      specificFile: row?.fail?.specific_file ?? null,
    },
  };
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
        console.error(error);
        onChange(null);
      });
  });

  return () => data.subscription.unsubscribe();
}

export function subscribeReportData(onChange: () => void) {
  if (!supabase) {
    return () => {};
  }

  const client = supabase;
  const channel = client
    .channel("silahar-report-data")
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

  return () => {
    void client.removeChannel(channel);
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

  const normalizedRules = normalizeReportRules(rules);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "report_rules",
      value: {
        allow_any_report_date: normalizedRules.allowAnyReportDate,
        max_photos_per_activity: normalizedRules.maxPhotosPerActivity,
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
  if (!supabase || !name.trim()) {
    return false;
  }

  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");

  const { data, error } = await supabase
    .from("reporter_directory")
    .select("id")
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function deleteReportFromDatabase(report: Report) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const storagePaths = report.activities
    .flatMap((activity) => activity.photos.map((photo) => photo.storagePath))
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: removeStorageError } = await supabase.storage
      .from(PROOF_BUCKET)
      .remove(storagePaths);

    if (removeStorageError) {
      throw removeStorageError;
    }
  }

  const { error } = await supabase.from("daily_reports").delete().eq("id", report.id);

  if (error) {
    throw error;
  }
}

export async function renameReporterDirectoryProfile(
  reporterId: string,
  nextName: string,
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { error } = await supabase.rpc("rename_reporter_directory_profile", {
    reporter_id_input: reporterId,
    next_full_name_input: nextName.trim().toUpperCase(),
  });

  if (error) {
    throw error;
  }
}

export async function deleteReporterDirectoryTrace(reporterId: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { data, error: reportFetchError } = await supabase
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

  if (reportFetchError) {
    throw reportFetchError;
  }

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
    const { error: removeStorageError } = await supabase.storage
      .from(PROOF_BUCKET)
      .remove(storagePaths);

    if (removeStorageError) {
      throw removeStorageError;
    }
  }

  const { error } = await supabase.rpc("delete_reporter_directory_trace", {
    reporter_id_input: reporterId,
  });

  if (error) {
    throw error;
  }
}

async function upsertReporterDirectory(name: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const uppercaseName = name.trim().toUpperCase();
  const { data, error } = await supabase.rpc("upsert_reporter_directory_for_report", {
    reporter_name_input: uppercaseName,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Gagal mendapatkan ID reporter dari database.");
  }

  return data as string;
}

async function upsertReportRow(draft: DraftReport, existingReport: Report | null) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const reporterDirectoryId = await upsertReporterDirectory(draft.nama);

  const payload = {
    template_id:
      draft.templateId && draft.templateId !== fallbackReportTemplateConfig.id
        ? draft.templateId
        : existingReport?.templateId ?? null,
    reporter_directory_id: reporterDirectoryId,
    reporter_name: draft.nama,
    report_date: draft.reportDate,
    template_approver_coordinator_id: draft.approverCoordinatorTemplateId,
    approver_coordinator_name: draft.approverCoordinator,
    approver_coordinator_nip: draft.approverCoordinatorNip,
    template_approver_division_head_id: draft.approverDivisionHeadTemplateId,
    approver_division_head_name: draft.approverDivisionHead,
    approver_division_head_title: draft.approverDivisionHeadTitle,
    approver_division_head_nip: draft.approverDivisionHeadNip,
    created_by_role: existingReport?.createdByRole ?? "anonymous",
    created_by_label: existingReport?.createdByLabel ?? "Pengguna umum",
    updated_by_role: "anonymous" as const,
    updated_by_label: "Pengguna umum",
  };

  if (existingReport) {
    const { data, error } = await supabase
      .from("daily_reports")
      .update(payload)
      .eq("id", existingReport.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return data.id as string;
  }

  const { data, error } = await supabase
    .from("daily_reports")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function saveReportToDatabase(
  draft: DraftReport,
  pendingPhotos: PendingPhotoMap,
  existingReport: Report | null,
  reportRules: ReportRules = DEFAULT_REPORT_RULES,
  onStage?: (stageId: string, detail?: string) => void,
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  onStage?.("prepare", "Memeriksa draft dan sinkronisasi data pelapor.");

  if (existingReport) {
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

  const reportId = await upsertReportRow(draft, existingReport);

  onStage?.("activities", "Mencatat detail aktivitas ke database.");
  const activityPayload = draft.activities.map((activity) => ({
    report_id: reportId,
    activity_order: activity.no,
    activity_description: activity.description,
    start_time_text: activity.startTime,
    end_time_text: activity.endTime,
  }));

  const { data: insertedActivities, error: activitiesError } = await supabase
    .from("daily_report_activities")
    .insert(activityPayload)
    .select("id, activity_order");

  if (activitiesError) {
    throw activitiesError;
  }

  for (const activity of insertedActivities ?? []) {
    const sourceActivity = draft.activities.find((item) => item.no === activity.activity_order);
    const keptExistingPhotos = (sourceActivity?.photos ?? []).slice(0, reportRules.maxPhotosPerActivity);
    const files = (pendingPhotos[activity.activity_order] ?? []).slice(
      0,
      reportRules.maxPhotosPerActivity,
    );
    const photoRows: Array<{
      activity_id: string;
      storage_path: string;
      public_url: string;
      original_file_name: string;
      sort_order: number;
    }> = [];

    if (files.length > 0) {
      onStage?.("photos", `Mengunggah foto aktivitas ke-${activity.activity_order}.`);
    } else if (keptExistingPhotos.length > 0) {
      onStage?.(
        "photos",
        `Mempertahankan foto aktivitas ke-${activity.activity_order} tanpa kompresi ulang.`,
      );
    }

    for (const [index, photo] of keptExistingPhotos.entries()) {
      photoRows.push({
        activity_id: activity.id,
        storage_path: photo.storagePath,
        public_url: photo.publicUrl,
        original_file_name: photo.originalFileName,
        sort_order: index + 1,
      });
    }

    for (const [index, file] of files.entries()) {
      const storagePath = `${reportId}/${activity.id}/${Date.now()}-${index}-${sanitizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(storagePath, file, { upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(storagePath);

      photoRows.push({
        activity_id: activity.id,
        storage_path: storagePath,
        public_url: publicUrlData.publicUrl,
        original_file_name: file.name,
        sort_order: keptExistingPhotos.length + index + 1,
      });
    }

    if (photoRows.length > 0) {
      const { error: photoInsertError } = await supabase
        .from("daily_report_activity_photos")
        .insert(photoRows);

      if (photoInsertError) {
        throw photoInsertError;
      }
    }
  }

  onStage?.("finalize", "Menyegarkan data terbaru dari database.");
  const reports = await fetchReports();
  return reports.find((report) => report.id === reportId) ?? null;
}
