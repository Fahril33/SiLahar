import { fallbackReportTemplateConfig } from "./report-template-defaults";
import { supabase } from "./supabase";
import type { TeamType, TeamTypeDraft } from "../types/team-type";
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
  header_lines?: string[] | null;
  team_type_id?: string | null;
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
  const parsedHeaders = Array.isArray(row.header_lines)
    ? row.header_lines.filter((line) => typeof line === "string")
    : null;

  return {
    id: row.id,
    templateCode: row.template_code,
    templateName: row.template_name,
    organizationName: row.organization_name ?? "",
    budgetYear: row.budget_year,
    headerLines:
      parsedHeaders && parsedHeaders.length > 0
        ? parsedHeaders
        : fallbackReportTemplateConfig.headerLines,
    teamTypeId: row.team_type_id ?? undefined,
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
      header_lines,
      team_type_id,
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
        approverRole: "coordinator_team_trc",
        defaultScopeLabel: "KOORDINATOR TIM",
      },
      {
        approverRole: "coordinator_team_pusdalops",
        defaultScopeLabel: "KOORDINATOR PUSDALOPS",
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
        approverRole === "coordinator_team_trc" || approverRole === "coordinator_team_pusdalops"
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

export async function saveCustomHeaderLines(
  templateId: string,
  headerLines: string[],
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const cleanedLines = headerLines
    .map((line) => line.trim())
    .filter(Boolean);

  if (cleanedLines.length === 0) {
    throw new Error("Kop laporan minimal harus memiliki 1 baris teks.");
  }

  const { error } = await supabase
    .from("report_templates")
    .update({
      header_lines: cleanedLines,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    // If update direct column failed, try RPC
    const { error: rpcErr } = await supabase.rpc(
      "update_report_template_headers",
      {
        p_template_id: templateId,
        p_header_lines: cleanedLines,
      },
    );
    if (rpcErr) throw rpcErr;
  }

  return fetchActiveReportTemplateConfig();
}

export async function fetchTeamTypes() {
  const fallback = [
    {
      id: "team-type-trc-default",
      code: "trc",
      name: "Tim Reaksi Cepat (TRC)",
      description: "Tim lapangan tanggap darurat dan kejadian bencana",
      headerLines: [
        "LAPORAN HARIAN KINERJA TIM REAKSI CEPAT",
        "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
        "TAHUN ANGGARAN 2026",
      ],
      isDefault: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "team-type-pusdalops-default",
      code: "pusdalops",
      name: "Pusat Pengendalian Operasi (PUSDALOPS)",
      description: "Tim pemantauan, analisis data, dan koordinasi informasi bencana",
      headerLines: [
        "LAPORAN HARIAN KINERJA PUSDALOPS",
        "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
        "TAHUN ANGGARAN 2026",
      ],
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  if (!supabase) {
    return fallback;
  }

  try {
    const { data, error } = await supabase
      .from("team_types")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (error || !data || data.length === 0) {
      return fallback;
    }

    return data.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || "",
      headerLines: Array.isArray(row.header_lines)
        ? row.header_lines
        : fallback[0].headerLines,
      coordinatorName: row.coordinator_name || "",
      coordinatorNip: row.coordinator_nip || "",
      coordinatorLabel: row.coordinator_label || "",
      isDefault: Boolean(row.is_default),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch {
    return fallback;
  }
}

export async function saveTeamTypeHeaderLines(
  teamTypeId: string,
  headerLines: string[],
) {
  const cleanedLines = headerLines
    .map((line) => line.trim())
    .filter(Boolean);

  if (cleanedLines.length === 0) {
    throw new Error("Kop laporan minimal harus memiliki 1 baris teks.");
  }

  if (supabase) {
    const { error } = await supabase
      .from("team_types")
      .update({
        header_lines: cleanedLines,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamTypeId);

    if (error) {
      await supabase.rpc("update_team_type_headers", {
        p_team_type_id: teamTypeId,
        p_header_lines: cleanedLines,
      });
    }
  }

  return fetchTeamTypes();
}

export async function saveTeamType(draft: TeamTypeDraft): Promise<TeamType[]> {
  if (!draft.name.trim() || !draft.code.trim()) {
    throw new Error("Nama dan Kode Jenis Tim wajib diisi.");
  }

  const cleanedLines = (draft.headerLines || [])
    .map((line) => line.trim())
    .filter(Boolean);

  const fallbackHeaders = [
    `LAPORAN HARIAN KINERJA ${draft.name.toUpperCase()}`,
    "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
    "TAHUN ANGGARAN 2026",
  ];

  const headerLinesToSave = cleanedLines.length > 0 ? cleanedLines : fallbackHeaders;

  if (supabase) {
    const { error } = await supabase.rpc("upsert_team_type", {
      p_id: draft.id || "",
      p_code: draft.code.trim().toLowerCase(),
      p_name: draft.name.trim(),
      p_description: draft.description ? draft.description.trim() : "",
      p_header_lines: headerLinesToSave,
      p_coordinator_name: draft.coordinatorName ? draft.coordinatorName.trim() : null,
      p_coordinator_nip: draft.coordinatorNip ? draft.coordinatorNip.trim() : null,
      p_coordinator_label: draft.coordinatorLabel ? draft.coordinatorLabel.trim() : null,
      p_is_default: Boolean(draft.isDefault),
    });

    if (error) {
      // Fallback to direct upsert if RPC fails
      await supabase.from("team_types").upsert(
        {
          id: draft.id || `team-type-${Date.now()}`,
          code: draft.code.trim().toLowerCase(),
          name: draft.name.trim(),
          description: draft.description ? draft.description.trim() : "",
          header_lines: headerLinesToSave,
          coordinator_name: draft.coordinatorName ? draft.coordinatorName.trim() : null,
          coordinator_nip: draft.coordinatorNip ? draft.coordinatorNip.trim() : null,
          coordinator_label: draft.coordinatorLabel ? draft.coordinatorLabel.trim() : null,
          is_default: Boolean(draft.isDefault),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: draft.id ? "id" : "code" },
      );
    }
  }

  return fetchTeamTypes();
}

export async function deleteTeamType(teamTypeId: string) {
  if (supabase) {
    const { error } = await supabase.rpc("delete_team_type", {
      p_id: teamTypeId,
    });
    if (error) {
      await supabase
        .from("team_types")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", teamTypeId);
    }
  }

  return fetchTeamTypes();
}

export function getHeaderLinesForTeam(
  teamCodeOrName: string,
  teamTypes: any[],
  fallbackTemplate?: any,
): string[] {
  if (!teamCodeOrName) {
    return (
      fallbackTemplate?.headerLines || [
        "LAPORAN HARIAN KINERJA TIM REAKSI CEPAT",
        "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
        "TAHUN ANGGARAN 2026",
      ]
    );
  }

  const query = teamCodeOrName.trim().toLowerCase();
  const matchedTeam = teamTypes.find(
    (tt) =>
      tt.code.toLowerCase() === query ||
      tt.name.toLowerCase() === query ||
      tt.name.toLowerCase().includes(query) ||
      query.includes(tt.code.toLowerCase()),
  );

  if (matchedTeam && matchedTeam.headerLines && matchedTeam.headerLines.length > 0) {
    return matchedTeam.headerLines;
  }

  return (
    fallbackTemplate?.headerLines || [
      `LAPORAN HARIAN KINERJA ${teamCodeOrName.trim().toUpperCase()}`,
      "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
      "TAHUN ANGGARAN 2026",
    ]
  );
}
