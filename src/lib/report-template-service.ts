import { fallbackReportTemplateConfig } from "./report-template-defaults";
import { supabase } from "./supabase";
import type {
  ReportTemplateApprover,
  ReportTemplateApproverDraft,
  ReportTemplateApproverRole,
  ReportTemplateConfig,
} from "../types/report-template";

type ReportTemplateNoteRow = {
  note_order: number;
  note_text: string;
};

type ReportTemplateApproverRow = {
  id: string;
  template_id: string;
  approver_role: ReportTemplateApproverRole;
  scope_label: string;
  official_name: string;
  official_title: string | null;
  official_nip: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ReportTemplateConfigRow = {
  id: string;
  template_code: string;
  template_name: string;
  organization_name: string | null;
  budget_year: number | null;
  is_active: boolean;
  updated_at: string;
  report_template_notes?: ReportTemplateNoteRow[];
  report_template_approvers?: ReportTemplateApproverRow[];
};

function mapApproverRow(row: ReportTemplateApproverRow): ReportTemplateApprover {
  return {
    id: row.id,
    templateId: row.template_id,
    approverRole: row.approver_role,
    scopeLabel: row.scope_label,
    officialName: row.official_name,
    officialTitle: row.official_title ?? "",
    officialNip: row.official_nip ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplateRow(row: ReportTemplateConfigRow): ReportTemplateConfig {
  return {
    id: row.id,
    templateCode: row.template_code,
    templateName: row.template_name,
    organizationName: row.organization_name ?? "",
    budgetYear: row.budget_year,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    notes: (row.report_template_notes ?? [])
      .slice()
      .sort((left, right) => left.note_order - right.note_order)
      .map((note) => note.note_text),
    approvers: (row.report_template_approvers ?? [])
      .slice()
      .sort((left, right) =>
        left.approver_role.localeCompare(right.approver_role),
      )
      .map(mapApproverRow),
  };
}

export function createApproverDraftFromTemplate(
  template: ReportTemplateConfig | null | undefined,
  role: ReportTemplateApproverRole,
): ReportTemplateApproverDraft {
  const source = template ?? fallbackReportTemplateConfig;
  const approver =
    source.approvers.find(
      (item) => item.approverRole === role && item.isActive,
    ) ?? null;

  return {
    scopeLabel: approver?.scopeLabel ?? "",
    officialName: approver?.officialName ?? "",
    officialTitle: approver?.officialTitle ?? "",
    officialNip: approver?.officialNip ?? "",
  };
}

export async function fetchActiveReportTemplateConfig() {
  if (!supabase) {
    return fallbackReportTemplateConfig;
  }

  const { data, error } = await supabase
    .from("report_templates")
    .select(
      `
      id,
      template_code,
      template_name,
      organization_name,
      budget_year,
      is_active,
      updated_at,
      report_template_notes (
        note_order,
        note_text
      ),
      report_template_approvers (
        id,
        template_id,
        approver_role,
        scope_label,
        official_name,
        official_title,
        official_nip,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .eq("is_active", true)
    .order("note_order", {
      foreignTable: "report_template_notes",
      ascending: true,
    })
    .maybeSingle();

  if (error) {
    console.warn(
      "Gagal memuat template laporan aktif dari database, memakai fallback lokal.",
      error,
    );
    return fallbackReportTemplateConfig;
  }

  if (!data) {
    return fallbackReportTemplateConfig;
  }

  return mapTemplateRow(data as ReportTemplateConfigRow);
}

export async function saveTemplateApproverDefaults(
  templateId: string,
  drafts: Record<ReportTemplateApproverRole, ReportTemplateApproverDraft>,
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const payload = (
    [
      {
        approverRole: "coordinator_team",
        defaultScopeLabel: "KOORDINATOR TIM",
      },
      {
        approverRole: "division_head",
        defaultScopeLabel: "KEPALA BIDANG KEDARURATAN & LOGISTIK",
      },
    ] as const
  ).map(({ approverRole, defaultScopeLabel }) => {
    const draft = drafts[approverRole];

    return {
      template_id: templateId,
      approver_role: approverRole,
      scope_label:
        draft.scopeLabel.trim().toUpperCase() || defaultScopeLabel,
      official_name: draft.officialName.trim().toUpperCase(),
      official_title:
        approverRole === "coordinator_team"
          ? null
          : draft.officialTitle.trim().toUpperCase() || null,
      official_nip: draft.officialNip.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
  });

  const hasEmptyOfficial = payload.some((item) => !item.official_name);
  if (hasEmptyOfficial) {
    throw new Error("Nama pejabat default wajib diisi untuk setiap peran.");
  }

  const { error } = await supabase
    .from("report_template_approvers")
    .upsert(payload, { onConflict: "template_id,approver_role" });

  if (error) {
    throw error;
  }

  return fetchActiveReportTemplateConfig();
}
