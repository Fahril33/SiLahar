import type {
  ReportTemplateApprover,
  ReportTemplateApproverRole,
  ReportTemplateConfig,
} from "../types/report-template";

export const FALLBACK_TEMPLATE_ID = "fallback-bpbd-trc-harian-2026";
export const FALLBACK_COORDINATOR_ID = "fallback-coordinator-team";
export const FALLBACK_DIVISION_HEAD_ID = "fallback-division-head";

const now = new Date().toISOString();

function createFallbackApprover(
  role: ReportTemplateApproverRole,
  values: {
    id: string;
    scopeLabel: string;
    officialName: string;
    officialTitle?: string;
    officialNip: string;
  },
): ReportTemplateApprover {
  return {
    id: values.id,
    templateId: FALLBACK_TEMPLATE_ID,
    approverRole: role,
    scopeLabel: values.scopeLabel,
    officialName: values.officialName,
    officialTitle: values.officialTitle ?? "",
    officialNip: values.officialNip,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export const fallbackReportTemplateConfig: ReportTemplateConfig = {
  id: FALLBACK_TEMPLATE_ID,
  templateCode: "bpbd-trc-harian-2026",
  templateName: "Laporan Harian Kinerja Tim Reaksi Cepat",
  organizationName:
    "Badan Penanggulangan Bencana Daerah Provinsi Sulawesi Tengah",
  budgetYear: 2026,
  isActive: true,
  updatedAt: now,
  notes: [
    "DIKUMPULKAN SETIAP HARI DI ADMIN.",
    "LAPORAN DI KUMPULKAN DENGAN MAP SNEILHEKTER YANG TELAH DI BERIKAN NAMA MASING2.",
  ],
  approvers: [
    createFallbackApprover("coordinator_team", {
      id: FALLBACK_COORDINATOR_ID,
      scopeLabel: "KOORDINATOR TIM",
      officialName: "ARIS PEBRIANSYAH, S.STP, M.AP",
      officialNip: "199602102018081001",
    }),
    createFallbackApprover("division_head", {
      id: FALLBACK_DIVISION_HEAD_ID,
      scopeLabel: "KEPALA BIDANG KEDARURATAN & LOGISTIK",
      officialName: "ANDY A SEMBIRING,.S.STP,.M.Si",
      officialTitle: "Pembina Utama Tkt I",
      officialNip: "19831221 200212 1 004",
    }),
  ],
};

export function getTemplateApproverByRole(
  template: ReportTemplateConfig | null | undefined,
  role: ReportTemplateApproverRole,
) {
  const source = template ?? fallbackReportTemplateConfig;
  return (
    source.approvers.find(
      (approver) => approver.approverRole === role && approver.isActive,
    ) ?? null
  );
}
