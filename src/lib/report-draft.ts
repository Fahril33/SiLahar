import { defaultDraft } from "../data/mock";
import { getWitaDisplayDateUppercase, getWitaToday, nowIso } from "./time";
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

export function normalizeDraft(draft: DraftReport): DraftReport {
  return {
    ...draft,
    nama: (draft.nama ?? "").toUpperCase(),
    tanggal: todayDisplay,
    reportDate: today,
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

export function createEmptyDraft() {
  return normalizeDraft({ ...defaultDraft, reportDate: today, tanggal: todayDisplay });
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
