import { OFFLINE_EMERGENCY_MODE } from "../config/app-mode";

export type ReportRules = {
  allowAnyReportDate: boolean;
  maxPhotosPerActivity: number;
  systemStartDate: string;
};

export const initialReportRules: ReportRules = {
  allowAnyReportDate: OFFLINE_EMERGENCY_MODE.forceAllowAnyReportDate,
  maxPhotosPerActivity: 1,
  systemStartDate: "",
};
