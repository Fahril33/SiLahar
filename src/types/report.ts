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
  templateId: string | null;
  nama: string;
  tanggal: string;
  reportDate: string;
  activities: ReportActivity[];
  approverCoordinatorTemplateId: string | null;
  approverCoordinator: string;
  approverCoordinatorNip: string;
  approverDivisionHeadTemplateId: string | null;
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

export type ReporterDirectoryProfile = {
  id: string;
  fullName: string;
  firstReportedAt: string | null;
  lastReportedAt: string | null;
  totalReports: number;
  isActive: boolean;
};
