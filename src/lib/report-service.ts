import { defaultDraft } from "../data/mock";
import { DEFAULT_REPORT_RULES, normalizeReportRules, type ReportRules } from "../config/report-rules";
import { supabase } from "./supabase";
import { mapReportRow } from "./report-mappers";
import type { DraftReport, Report } from "../types/report";

const PROOF_BUCKET = "daily-report-proofs";

type PendingPhotoMap = Record<number, File[]>;

type ReportRulesRow = {
  max_photos_per_activity?: number;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
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

  const { data, error } = await supabase
    .from("daily_reports")
    .select(`
      id,
      reporter_name,
      display_date_text,
      report_date,
      approver_coordinator_name,
      approver_coordinator_nip,
      approver_division_head_name,
      approver_division_head_title,
      approver_division_head_nip,
      created_at,
      updated_at,
      created_by_role,
      created_by_label,
      updated_by_role,
      updated_by_label,
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

  const templateNotes = defaultDraft.notes;

  return (data ?? []).map((row) =>
    mapReportRow({
      ...row,
      report_template_notes: templateNotes.map((note, index) => ({
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
    maxPhotosPerActivity: rules?.max_photos_per_activity,
  });
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
    reporter_directory_id: reporterDirectoryId,
    reporter_name: draft.nama,
    display_date_text: draft.tanggal,
    report_date: draft.reportDate,
    approver_coordinator_name: draft.approverCoordinator,
    approver_coordinator_nip: draft.approverCoordinatorNip,
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
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

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
    const files = (pendingPhotos[activity.activity_order] ?? []).slice(0, reportRules.maxPhotosPerActivity);

    if (files.length === 0) {
      continue;
    }

    const photoRows: Array<{
      activity_id: string;
      storage_path: string;
      public_url: string;
      original_file_name: string;
      sort_order: number;
    }> = [];

    const sourceActivity = draft.activities.find((item) => item.no === activity.activity_order);
    const keptExistingPhotos = (sourceActivity?.photos ?? []).slice(0, reportRules.maxPhotosPerActivity);

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

  const reports = await fetchReports();
  return reports.find((report) => report.id === reportId) ?? null;
}
