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
};

export type MediaScan = {
  files: StorageImage[];
  scannedAt: number;
  cached: boolean;
};

export type MediaFilter = "all" | "linked" | "orphan";
export type MediaSort = "newest" | "oldest" | "largest" | "smallest" | "name";
