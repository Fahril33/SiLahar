import type { AdminSessionState } from "./admin";

export type MediaMigrationBucketId = "daily-report-proofs" | "official-signatures";

export type MediaMigrationKind = "report_photo" | "team_signature" | "approver_signature" | "orphan_storage";

export type MediaMigrationItemStatus =
  | "pending"
  | "migrating"
  | "synced"
  | "already_synced"
  | "skipped"
  | "failed";

export interface MediaMigrationUserRelation {
  userId: string | null;
  userName: string;
  reportId: string | null;
  reportDate: string | null;
  tim: string | null;
  activityId: string | null;
  activityOrder: number | null;
  activityDescription: string | null;
}

export interface MediaMigrationItem {
  id: string;
  bucketId: MediaMigrationBucketId;
  storagePath: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  kind: MediaMigrationKind;
  userRel: MediaMigrationUserRelation;
  status: MediaMigrationItemStatus;
  sourceUrl: string;
  targetUrl?: string;
  isAlreadyInTargetStorage: boolean;
  isAlreadyInTargetDb: boolean;
  errorMessage?: string;
}

export interface MediaMigrationUserGroup {
  id: string;
  name: string;
  totalPhotos: number;
  totalBytes: number;
  syncedCount: number;
  needsMigrationCount: number;
}

export interface MediaMigrationBucketGroup {
  id: MediaMigrationBucketId;
  name: string;
  totalItems: number;
  totalBytes: number;
  syncedCount: number;
  needsMigrationCount: number;
}

export interface MediaMigrationReportActivity {
  id: string;
  reportId: string;
  activityOrder: number;
  activityDescription: string;
  startTimeText: string;
  endTimeText: string;
  photosCount: number;
  isSynced: boolean;
}

export interface MediaMigrationReportGroup {
  reportId: string;
  reporterName: string;
  userId: string | null;
  reportDate: string | null;
  tim: string | null;
  displayDateText?: string | null;
  templateId?: string | null;
  activitiesCount: number;
  totalPhotos: number;
  syncedPhotosCount: number;
  needsMigrationCount: number;
  totalBytes: number;
  isReportInTargetDb: boolean;
  isReportFullySynced: boolean;
  items: MediaMigrationItem[];
  activities?: MediaMigrationReportActivity[];
  legacyReportData?: any;
}

export interface MediaMigrationScanResult {
  items: MediaMigrationItem[];
  totalItems: number;
  totalBytes: number;
  alreadySyncedCount: number;
  needsMigrationCount: number;
  userGroups: MediaMigrationUserGroup[];
  bucketGroups: MediaMigrationBucketGroup[];
  reportGroups?: MediaMigrationReportGroup[];
  scannedAt: string;
}

export interface MediaMigrationProgressEvent {
  phase: "scanning" | "migrating" | "done" | "aborted" | "error";
  currentItem?: MediaMigrationItem;
  completedItems: number;
  totalItems: number;
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  statusText: string;
  logMessage?: string;
}

export interface MediaMigrationSummaryResult {
  success: boolean;
  totalItems: number;
  successCount: number;
  alreadySyncedCount: number;
  failedCount: number;
  transferredBytes: number;
  migratedReportsCount?: number;
  migratedActivitiesCount?: number;
  completedAt: string;
  errors: Array<{ path: string; error: string }>;
}

export interface MediaMigrationOptions {
  selectedBucketIds?: MediaMigrationBucketId[];
  selectedUserIds?: string[];
  selectedReportIds?: string[];
  reportGroups?: MediaMigrationReportGroup[];
  startDate?: string;
  endDate?: string;
  skipAlreadySynced?: boolean;
  includeOrphans?: boolean;
  concurrency?: number;
  signal?: AbortSignal;
  adminSession?: AdminSessionState | null;
}

