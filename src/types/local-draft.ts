import type { DraftReport, ReportActivityPhoto } from "./report";

export type LocalDraftUploadStatus =
  | "idle"
  | "queued"
  | "uploading"
  | "uploaded"
  | "failed";

export type LocalDraftFileMap = Record<number, File[]>;

export type LocalReportDraftRecord = {
  id: string;
  title: string;
  draft: DraftReport;
  pendingPhotos: LocalDraftFileMap;
  editableOriginalPhotos: Record<number, ReportActivityPhoto[]>;
  sourceReportId: string | null;
  sourceDraftSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  uploadStatus: LocalDraftUploadStatus;
  uploadError: string | null;
  lastUploadStartedAt: string | null;
  lastUploadFinishedAt: string | null;
  uploadedReportId: string | null;
  deleteAfterUpload: boolean;
};

export type LocalReportDraftSummary = {
  id: string;
  title: string;
  reporterName: string;
  reportDate: string;
  displayDate: string;
  activityCount: number;
  pendingPhotoCount: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  uploadStatus: LocalDraftUploadStatus;
  uploadError: string | null;
  lastUploadStartedAt: string | null;
  lastUploadFinishedAt: string | null;
  uploadedReportId: string | null;
  sourceReportId: string | null;
  deleteAfterUpload: boolean;
};
