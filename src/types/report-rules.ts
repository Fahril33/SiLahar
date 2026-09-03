export type ReportRules = {
  allowAnyReportDate: boolean;
  maxPhotosPerActivity: number;
  systemStartDate: string;
};

export const initialReportRules: ReportRules = {
  allowAnyReportDate: false,
  maxPhotosPerActivity: 1,
  systemStartDate: "",
};
