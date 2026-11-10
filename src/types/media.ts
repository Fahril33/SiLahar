export type MediaBucket = {
  id: string;
  name: string;
  public: boolean;
  prefix: string;
  auditable: boolean;
};

export type MediaReference = {
  id: string;
  recordId: string;
  label: string;
  date: string | null;
  kind: "report" | "team" | "approver";
  bucketId: string;
  paths: string[];
};

export type StorageImage = {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaImage = StorageImage & {
  status: "linked" | "orphan" | "unknown";
  references: MediaReference[];
  isCompressed?: boolean;
};

export type MediaScan = {
  files: StorageImage[];
  scannedAt: number;
  cached: boolean;
};

export type MediaFilter = "all" | "linked" | "orphan" | "compressed";
export type MediaSort = "newest" | "oldest" | "largest" | "smallest" | "name";

export type CompressItemStatus = "pending" | "processing" | "success" | "skipped" | "error";

export interface CompressItemProgress {
  path: string;
  name: string;
  oldSize: number;
  newSize?: number;
  savedBytes?: number;
  status: CompressItemStatus;
  errorMessage?: string;
}

export interface CompressProgressState {
  isOpen: boolean;
  done: number;
  total: number;
  savedBytes: number;
  currentMessage: string;
  currentFile?: string;
  items: CompressItemProgress[];
  isFinished: boolean;
  isAborted: boolean;
}

export type MediaMonthOption = {
  key: string;
  label: string;
  count: number;
};

export type MediaAccountTarget = "primary" | "legacy";

export interface MediaAccountOption {
  id: MediaAccountTarget;
  label: string;
  url: string;
  isAvailable: boolean;
}

