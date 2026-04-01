export type ActorRole = "admin" | "anonymous";

export type ReportActivityPhoto = {
  id: string;
  activityId: string;
  storagePath: string;
  publicUrl: string;
  originalFileName: string;
  sortOrder: number;
  createdAt: string;
};

export type ReportActivity = {
  id?: string;
  no: number;
  description: string;
  startTime: string;
  endTime: string;
  photos: ReportActivityPhoto[];
};

export type Report = {
  id: string;
  nama: string;
  tanggal: string;
  reportDate: string;
  activities: ReportActivity[];
  approverCoordinator: string;
  approverCoordinatorNip: string;
  approverDivisionHead: string;
  approverDivisionHeadTitle: string;
  approverDivisionHeadNip: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
  createdByRole: ActorRole;
  createdByLabel: string;
  updatedByRole: ActorRole;
  updatedByLabel: string;
};

export type DraftReport = Omit<
  Report,
  "id" | "createdAt" | "updatedAt" | "createdByRole" | "createdByLabel" | "updatedByRole" | "updatedByLabel"
>;
