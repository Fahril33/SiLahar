export type ReportRules = {
  allowAnyReportDate: boolean;
  maxPhotosPerActivity: number;
};

export const initialReportRules: ReportRules = {
  allowAnyReportDate: false,
  maxPhotosPerActivity: 1,
};
