import type { AdminActiveAction } from "../../hooks/use-report-dashboard";
import {
  type BulkUploadItemProgress,
  type BulkUploadProgressState,
  type BulkUploadResult
} from "../../lib/browser-cache-recovery";
import type { AdminSessionState } from "../../types/admin";
import type {
  ExcelReportTemplate,
  ExcelTemplateUploadDraft,
} from "../../types/excel-template";
import type { NotificationSettings } from "../../types/notification-settings";
import type { Report, ReporterDirectoryProfile } from "../../types/report";
import type { ReportRules } from "../../types/report-rules";
import type {
  ReportTemplateApproverDraft,
  ReportTemplateApproverRole,
  ReportTemplateConfig,
} from "../../types/report-template";

export type AdminDashboardViewProps = {
  adminSession: AdminSessionState | null;
  userSession?: ReporterDirectoryProfile | null;
  userSubmitting?: boolean;
  onUserUpdateProfile?: (name: string, pass: string) => Promise<void>;
  onUserLogout?: () => Promise<void>;
  adminEmail: string;
  setAdminEmail: (value: string) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  adminAuthLoading: boolean;
  loading: boolean;
  adminSubmitting: boolean;
  adminActiveAction: AdminActiveAction;
  adminRuleDraft: ReportRules;
  adminHeaderLinesDraft: string[];
  setAdminHeaderLinesDraft: (lines: string[]) => void;
  onHandleSaveHeaderLines: (lines: string[]) => Promise<void>;
  activeReportTemplateConfig: ReportTemplateConfig | null;
  notificationSettings: NotificationSettings;
  adminTemplateApproverDrafts: Record<
    ReportTemplateApproverRole,
    ReportTemplateApproverDraft
  >;
  excelTemplates: ExcelReportTemplate[];
  activeExcelTemplate: ExcelReportTemplate | null;
  excelTemplateDraft: ExcelTemplateUploadDraft;
  adminExcelTemplateDrafts: Record<string, ExcelTemplateUploadDraft>;
  selectedExcelTemplateFileName: string;
  excelTemplateUploading: boolean;
  reports: Report[];
  reporterProfiles: ReporterDirectoryProfile[];
  adminReporterDraftNames: Record<string, string>;
  adminActiveItemId: string | null;
  onChangeAdminRule: <K extends keyof ReportRules>(
    key: K,
    value: ReportRules[K],
  ) => void;
  onChangeAdminReporterDraftName: (reporterId: string, value: string) => void;
  onHandleAdminLogin: () => Promise<void>;
  onHandleAdminLogout: () => Promise<void>;
  onHandleSaveAdminRules: () => Promise<void>;
  onChangeNotificationSettings: <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => void;
  onHandleSaveNotificationSettings: () => Promise<void>;
  onChangeAdminTemplateApproverDraft: <
    K extends keyof ReportTemplateApproverDraft,
  >(
    role: ReportTemplateApproverRole,
    key: K,
    value: ReportTemplateApproverDraft[K],
  ) => void;
  onHandleSaveTemplateApproverDefaults: (
    overrideDrafts?: Record<
      ReportTemplateApproverRole,
      ReportTemplateApproverDraft
    >,
  ) => Promise<void>;
  onChangeExcelTemplateDraft: <K extends keyof ExcelTemplateUploadDraft>(
    key: K,
    value: ExcelTemplateUploadDraft[K],
  ) => void;
  onClearExcelTemplateDraftName: () => void;
  onSelectExcelTemplateFile: (file: File | null) => void;
  onChangeAdminExcelTemplateDraft: <K extends keyof ExcelTemplateUploadDraft>(
    templateId: string,
    key: K,
    value: ExcelTemplateUploadDraft[K],
  ) => void;
  onHandleUploadExcelTemplate: () => Promise<void>;
  onHandleActivateExcelTemplate: (templateId: string) => Promise<void>;
  onHandleRenameExcelTemplate: (template: ExcelReportTemplate) => Promise<void>;
  onHandleDeleteExcelTemplate: (template: ExcelReportTemplate) => Promise<void>;
  onHandleRenameReporterProfile: (
    reporter: ReporterDirectoryProfile,
    nextPassword?: string,
  ) => Promise<void>;
  onHandleDeleteReporterTrace: (
    reporter: ReporterDirectoryProfile,
  ) => Promise<void>;
  onHandleBulkExport: (reports: Report[]) => Promise<void>;
  bulkExporting: boolean;
  onHandleDownloadDeviceBackupExcel?: (reports?: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupJson?: (
    reports?: Report[],
    userFilter?: string,
  ) => Promise<void>;
  deviceBackupExporting?: boolean;
  onHandleBulkUploadDeviceBackup?: (
    backupReports: Report[],
    selectedActivitiesByReportId: Record<string, number[]>,
    conflictResolutions?: Record<string, "overwrite" | "skip">,
    onItemProgress?: (progress: BulkUploadItemProgress) => void,
    onProgressStateChange?: (state: BulkUploadProgressState) => void,
  ) => Promise<BulkUploadResult>;
  deviceBackupBulkUploading?: boolean;
  isOnline: boolean;
  onReloadReports?: () => Promise<void>;
};

