import type {
  ReportTemplateApprover,
  ReportTemplateApproverRole,
  ReportTemplateConfig,
} from "../types/report-template";

export const FALLBACK_TEMPLATE_ID = "fallback-bpbd-trc-harian-2026";
export const FALLBACK_COORDINATOR_TRC_ID = "fallback-coordinator-team-trc";
export const FALLBACK_COORDINATOR_PUSDALOPS_ID = "fallback-coordinator-team-pusdalops";
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
  headerLines: [
    "LAPORAN HARIAN KINERJA TIM REAKSI CEPAT",
    "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
    "TAHUN ANGGARAN 2026",
  ],
  isActive: true,
  updatedAt: now,
  notes: [
    "DIKUMPULKAN SETIAP HARI DI ADMIN.",
    "LAPORAN DI KUMPULKAN DENGAN MAP SNEILHEKTER YANG TELAH DI BERIKAN NAMA MASING2.",
  ],
  approvers: [
    createFallbackApprover("coordinator_team_trc", {
      id: FALLBACK_COORDINATOR_TRC_ID,
      scopeLabel: "KOORDINATOR",
      officialName: "RIKI",
      officialNip: "198607082016041001",
    }),
    createFallbackApprover("coordinator_team_pusdalops", {
      id: FALLBACK_COORDINATOR_PUSDALOPS_ID,
      scopeLabel: "KOORDINATOR",
      officialName: "MOH. YASIR SYURIADI N.",
      officialNip: "197309181993031004",
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

export const JAN_MAR_PUSDALOPS_COORDINATOR = {
  id: "jan-mar-coordinator-pusdalops",
  scopeLabel: "KOORDINATOR PUSDALOPS",
  officialName: "FERA FAKTA EFA, SKM.,MM",
  officialNip: "19870225 2010001 2 003",
};

export function isJanToMarPeriod(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const clean = dateStr.trim().slice(0, 10);
  const match = clean.match(/^\d{4}-(\d{2})-\d{2}$/);
  if (match) {
    const month = parseInt(match[1], 10);
    return month >= 1 && month <= 3;
  }
  const upper = dateStr.toUpperCase();
  return (
    upper.includes("JANUARI") ||
    upper.includes("FEBRUARI") ||
    upper.includes("MARET")
  );
}

export function isPusdalopsTeam(tim?: string | null): boolean {
  if (!tim) return true;
  const normalized = tim.trim().toUpperCase();
  return normalized.includes("PUSDALOPS");
}

export function getTemplateApproverByRole(
  template: ReportTemplateConfig | null | undefined,
  role: ReportTemplateApproverRole,
  reportDate?: string | null,
) {
  if (role === "coordinator_team_pusdalops" && isJanToMarPeriod(reportDate)) {
    return {
      id: JAN_MAR_PUSDALOPS_COORDINATOR.id,
      templateId: template?.id ?? FALLBACK_TEMPLATE_ID,
      approverRole: "coordinator_team_pusdalops" as ReportTemplateApproverRole,
      scopeLabel: JAN_MAR_PUSDALOPS_COORDINATOR.scopeLabel,
      officialName: JAN_MAR_PUSDALOPS_COORDINATOR.officialName,
      officialTitle: "",
      officialNip: JAN_MAR_PUSDALOPS_COORDINATOR.officialNip,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  const source = template ?? fallbackReportTemplateConfig;
  return (
    source.approvers.find(
      (approver) => approver.approverRole === role && approver.isActive,
    ) ?? null
  );
}

