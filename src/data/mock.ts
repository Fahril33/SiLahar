import { getWitaToday, nowIso } from "../lib/time";
import {
  fallbackReportTemplateConfig,
  getTemplateApproverByRole,
} from "../lib/report-template-defaults";
import type { DraftReport, Report } from "../types/report";

const fallbackCoordinator = getTemplateApproverByRole(
  fallbackReportTemplateConfig,
  "coordinator_team",
);
const fallbackDivisionHead = getTemplateApproverByRole(
  fallbackReportTemplateConfig,
  "division_head",
);

export const defaultDraft: DraftReport = {
  templateId: fallbackReportTemplateConfig.id,
  nama: "",
  tanggal: "RABU, 01 APRIL 2026",
  reportDate: getWitaToday(),
  activities: [
    {
      no: 1,
      description: "",
      startTime: "09:00",
      endTime: "12:00",
      photos: [],
    },
  ],
  approverCoordinatorTemplateId: fallbackCoordinator?.id ?? null,
  approverCoordinator: fallbackCoordinator?.officialName ?? "",
  approverCoordinatorNip: fallbackCoordinator?.officialNip ?? "",
  approverDivisionHeadTemplateId: fallbackDivisionHead?.id ?? null,
  approverDivisionHead: fallbackDivisionHead?.officialName ?? "",
  approverDivisionHeadTitle: fallbackDivisionHead?.officialTitle ?? "",
  approverDivisionHeadNip: fallbackDivisionHead?.officialNip ?? "",
  notes: fallbackReportTemplateConfig.notes,
};

export const seededReports: Report[] = [
  {
    id: "RPT-001",
    templateId: fallbackReportTemplateConfig.id,
    nama: "MUHAMMAD FAHRIL, S.KOM.",
    tanggal: "RABU, 01 APRIL 2026",
    reportDate: getWitaToday(),
    activities: [
      {
        no: 1,
        description: "Setup Database Web GIS",
        startTime: "09:00",
        endTime: "12:00",
        photos: [],
      },
      {
        no: 2,
        description: "Setup API Web GIS",
        startTime: "13:00",
        endTime: "16:00",
        photos: [],
      },
    ],
    approverCoordinatorTemplateId: fallbackCoordinator?.id ?? null,
    approverCoordinator: fallbackCoordinator?.officialName ?? "",
    approverCoordinatorNip: fallbackCoordinator?.officialNip ?? "",
    approverDivisionHeadTemplateId: fallbackDivisionHead?.id ?? null,
    approverDivisionHead: fallbackDivisionHead?.officialName ?? "",
    approverDivisionHeadTitle: fallbackDivisionHead?.officialTitle ?? "",
    approverDivisionHeadNip: fallbackDivisionHead?.officialNip ?? "",
    notes: fallbackReportTemplateConfig.notes,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdByRole: "anonymous",
    createdByLabel: "Pengguna umum",
    updatedByRole: "anonymous",
    updatedByLabel: "Pengguna umum",
  },
];

export const monitoredUsers = [
  "Abdul Rahman",
  "Aditiya Pratama",
  "Muhammad Fahril, S.Kom.",
  "Maya Salsabila",
  "Riska Wulandari",
  "Yusuf Salam",
];
