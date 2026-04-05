import { defaultDraft } from "../data/mock";
import { getTemplateApproverByRole } from "./report-template-defaults";
import { getWitaDisplayDateUppercase, getWitaToday, nowIso } from "./time";
import type { ReportTemplateConfig } from "../types/report-template";
import type { DraftReport, Report } from "../types/report";

export type PendingPhotoMap = Record<number, File[]>;
export type PendingPreviewMap = Record<number, Array<{ name: string; url: string }>>;

export const today = getWitaToday();
export const todayDisplay = getWitaDisplayDateUppercase();

export function normalizeTimeValue(value: string, fallback: string) {
  const normalized = value.replace(".", ":").trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeReportDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
}

export function normalizeDraft(draft: DraftReport): DraftReport {
  const reportDate = normalizeReportDate(draft.reportDate || today);

  return {
    ...draft,
    templateId: draft.templateId ?? defaultDraft.templateId,
    nama: (draft.nama ?? "").toUpperCase(),
    tanggal: getWitaDisplayDateUppercase(reportDate),
    reportDate,
    approverCoordinatorTemplateId:
      draft.approverCoordinatorTemplateId ??
      defaultDraft.approverCoordinatorTemplateId,
    approverCoordinator:
      draft.approverCoordinator ?? defaultDraft.approverCoordinator,
    approverCoordinatorNip:
      draft.approverCoordinatorNip ?? defaultDraft.approverCoordinatorNip,
    approverDivisionHeadTemplateId:
      draft.approverDivisionHeadTemplateId ??
      defaultDraft.approverDivisionHeadTemplateId,
    approverDivisionHead:
      draft.approverDivisionHead ?? defaultDraft.approverDivisionHead,
    approverDivisionHeadTitle:
      draft.approverDivisionHeadTitle ??
      defaultDraft.approverDivisionHeadTitle,
    approverDivisionHeadNip:
      draft.approverDivisionHeadNip ?? defaultDraft.approverDivisionHeadNip,
    notes: draft.notes ?? defaultDraft.notes,
    activities: draft.activities.map((activity, index) => ({
      id: activity.id,
      no: activity.no || index + 1,
      description: activity.description,
      startTime: normalizeTimeValue(activity.startTime, "09:00"),
      endTime: normalizeTimeValue(activity.endTime, "12:00"),
      photos: activity.photos ?? [],
    })),
  };
}

export function createEmptyDraft(templateConfig?: ReportTemplateConfig | null) {
  const coordinator = getTemplateApproverByRole(
    templateConfig,
    "coordinator_team",
  );
  const divisionHead = getTemplateApproverByRole(
    templateConfig,
    "division_head",
  );

  return normalizeDraft({
    ...defaultDraft,
    templateId: templateConfig?.id ?? defaultDraft.templateId,
    reportDate: today,
    tanggal: todayDisplay,
    notes: templateConfig?.notes ?? defaultDraft.notes,
    approverCoordinatorTemplateId:
      coordinator?.id ?? defaultDraft.approverCoordinatorTemplateId,
    approverCoordinator:
      coordinator?.officialName ?? defaultDraft.approverCoordinator,
    approverCoordinatorNip:
      coordinator?.officialNip ?? defaultDraft.approverCoordinatorNip,
    approverDivisionHeadTemplateId:
      divisionHead?.id ?? defaultDraft.approverDivisionHeadTemplateId,
    approverDivisionHead:
      divisionHead?.officialName ?? defaultDraft.approverDivisionHead,
    approverDivisionHeadTitle:
      divisionHead?.officialTitle ?? defaultDraft.approverDivisionHeadTitle,
    approverDivisionHeadNip:
      divisionHead?.officialNip ?? defaultDraft.approverDivisionHeadNip,
  });
}

export function applyTemplateDefaultsToDraft(
  draft: DraftReport,
  previousTemplate: ReportTemplateConfig | null,
  nextTemplate: ReportTemplateConfig | null,
) {
  const previousCoordinator = getTemplateApproverByRole(
    previousTemplate,
    "coordinator_team",
  );
  const previousDivisionHead = getTemplateApproverByRole(
    previousTemplate,
    "division_head",
  );
  const nextCoordinator = getTemplateApproverByRole(
    nextTemplate,
    "coordinator_team",
  );
  const nextDivisionHead = getTemplateApproverByRole(
    nextTemplate,
    "division_head",
  );

  function shouldReplace(currentValue: string, previousValue: string) {
    return !currentValue.trim() || currentValue === previousValue;
  }

  return normalizeDraft({
    ...draft,
    templateId:
      !draft.templateId ||
      (previousTemplate && draft.templateId === previousTemplate.id)
        ? (nextTemplate?.id ?? draft.templateId)
        : draft.templateId,
    approverCoordinatorTemplateId:
      shouldReplace(
        draft.approverCoordinator,
        previousCoordinator?.officialName ?? "",
      )
        ? (nextCoordinator?.id ?? draft.approverCoordinatorTemplateId)
        : draft.approverCoordinatorTemplateId,
    approverCoordinator: shouldReplace(
      draft.approverCoordinator,
      previousCoordinator?.officialName ?? "",
    )
      ? (nextCoordinator?.officialName ?? draft.approverCoordinator)
      : draft.approverCoordinator,
    approverCoordinatorNip: shouldReplace(
      draft.approverCoordinatorNip,
      previousCoordinator?.officialNip ?? "",
    )
      ? (nextCoordinator?.officialNip ?? draft.approverCoordinatorNip)
      : draft.approverCoordinatorNip,
    approverDivisionHeadTemplateId: shouldReplace(
      draft.approverDivisionHead,
      previousDivisionHead?.officialName ?? "",
    )
      ? (nextDivisionHead?.id ?? draft.approverDivisionHeadTemplateId)
      : draft.approverDivisionHeadTemplateId,
    approverDivisionHead: shouldReplace(
      draft.approverDivisionHead,
      previousDivisionHead?.officialName ?? "",
    )
      ? (nextDivisionHead?.officialName ?? draft.approverDivisionHead)
      : draft.approverDivisionHead,
    approverDivisionHeadTitle: shouldReplace(
      draft.approverDivisionHeadTitle,
      previousDivisionHead?.officialTitle ?? "",
    )
      ? (nextDivisionHead?.officialTitle ?? draft.approverDivisionHeadTitle)
      : draft.approverDivisionHeadTitle,
    approverDivisionHeadNip: shouldReplace(
      draft.approverDivisionHeadNip,
      previousDivisionHead?.officialNip ?? "",
    )
      ? (nextDivisionHead?.officialNip ?? draft.approverDivisionHeadNip)
      : draft.approverDivisionHeadNip,
    notes:
      JSON.stringify(draft.notes) === JSON.stringify(previousTemplate?.notes ?? [])
        ? (nextTemplate?.notes ?? draft.notes)
        : draft.notes,
  });
}

export function createPreviewReport(draft: DraftReport, pendingPreviews: PendingPreviewMap): Report {
  const timestamp = nowIso();

  return {
    id: "preview",
    ...draft,
    activities: draft.activities.map((activity) => ({
      ...activity,
      photos: [
        ...activity.photos,
        ...(pendingPreviews[activity.no] ?? []).map((photo, index) => ({
          id: `preview-${activity.no}-${index}`,
          activityId: `preview-${activity.no}`,
          storagePath: "",
          publicUrl: photo.url,
          originalFileName: photo.name,
          sortOrder: index + 1,
          createdAt: timestamp,
        })),
      ],
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByRole: "anonymous",
    createdByLabel: "Pengguna umum",
    updatedByRole: "anonymous",
    updatedByLabel: "Pengguna umum",
  };
}

export function revokePreviews(previews: PendingPreviewMap) {
  Object.values(previews)
    .flat()
    .forEach((photo) => URL.revokeObjectURL(photo.url));
}
