import type { Report, ReportActivity, ReportActivityPhoto } from "../types/report";

type PhotoRow = {
  id: string;
  activity_id: string;
  storage_path: string;
  public_url: string;
  original_file_name: string;
  sort_order: number;
  created_at: string;
};

type ActivityRow = {
  id: string;
  activity_order: number;
  activity_description: string;
  start_time_text: string;
  end_time_text: string;
  daily_report_activity_photos?: PhotoRow[];
};

type ReportRow = {
  id: string;
  reporter_name: string;
  display_date_text: string;
  report_date: string;
  approver_coordinator_name: string | null;
  approver_coordinator_nip: string | null;
  approver_division_head_name: string | null;
  approver_division_head_title: string | null;
  approver_division_head_nip: string | null;
  created_at: string;
  updated_at: string;
  created_by_role: "admin" | "anonymous";
  created_by_label: string;
  updated_by_role: "admin" | "anonymous";
  updated_by_label: string;
  daily_report_activities?: ActivityRow[];
  report_template_notes?: { note_order: number; note_text: string }[];
};

function mapPhoto(row: PhotoRow): ReportActivityPhoto {
  return {
    id: row.id,
    activityId: row.activity_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    originalFileName: row.original_file_name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapActivity(row: ActivityRow): ReportActivity {
  return {
    id: row.id,
    no: row.activity_order,
    description: row.activity_description,
    startTime: row.start_time_text,
    endTime: row.end_time_text,
    photos: (row.daily_report_activity_photos ?? []).sort((a, b) => a.sort_order - b.sort_order).map(mapPhoto),
  };
}

export function mapReportRow(row: ReportRow): Report {
  return {
    id: row.id,
    nama: row.reporter_name.toUpperCase(),
    tanggal: row.display_date_text.toUpperCase(),
    reportDate: row.report_date,
    activities: (row.daily_report_activities ?? []).sort((a, b) => a.activity_order - b.activity_order).map(mapActivity),
    approverCoordinator: row.approver_coordinator_name ?? "",
    approverCoordinatorNip: row.approver_coordinator_nip ?? "",
    approverDivisionHead: row.approver_division_head_name ?? "",
    approverDivisionHeadTitle: row.approver_division_head_title ?? "",
    approverDivisionHeadNip: row.approver_division_head_nip ?? "",
    notes: (row.report_template_notes ?? []).sort((a, b) => a.note_order - b.note_order).map((note) => note.note_text),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByRole: row.created_by_role,
    createdByLabel: row.created_by_label,
    updatedByRole: row.updated_by_role,
    updatedByLabel: row.updated_by_label,
  };
}
