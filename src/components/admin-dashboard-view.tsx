import { useState, useEffect, useMemo, useRef } from "react";
import type { ReportRules } from "../types/report-rules";
import type { AdminActiveAction } from "../hooks/use-report-dashboard";
import { formatWitaDate, formatWitaDateTime } from "../lib/time";
import type { AdminSessionState } from "../types/admin";
import type {
  ExcelReportTemplate,
  ExcelTemplateUploadDraft,
} from "../types/excel-template";
import type {
  ReportTemplateApproverDraft,
  ReportTemplateApproverRole,
  ReportTemplateConfig,
} from "../types/report-template";
import type { NotificationSettings } from "../types/notification-settings";
import type { Report, ReporterDirectoryProfile } from "../types/report";
import { adminGetReporterPasswords } from "../lib/report-service";
import { AdminEditableListCard } from "./admin-editable-list-card";
import { AdminReporterStatsView } from "./admin-reporter-stats-view";
import {
  AdminReporterToolbar,
  type ReporterSortMode,
} from "./admin-reporter-toolbar";
import { FileUploadInput } from "./file-upload-input";
import {
  SUCCESS_SOUNDS,
  FAIL_SOUNDS,
  playSound,
  isUserSoundEnabled,
  setUserSoundEnabled,
} from "../lib/sound-utils";
import { isSameReporterName } from "../lib/reporter-name";
import {
  getAllDeviceBackupReports,
  parseDeviceBackupJsonFile,
  buildInitialBulkUploadProgressState,
  type BulkUploadItemProgress,
  type BulkUploadProgressState,
  type BulkUploadResult,
} from "../lib/browser-cache-recovery";

const inputClassName = "field-input";

function SpinnerIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4 animate-spin"}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

type AdminSection =
  | "rules"
  | "reporters"
  | "templates"
  | "bulk-export"
  | "bulk-upload"
  | "sounds";

type AdminDashboardViewProps = {
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
  onHandleSaveTemplateApproverDefaults: () => Promise<void>;
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
    onItemProgress?: (progress: BulkUploadItemProgress) => void,
    onProgressStateChange?: (state: BulkUploadProgressState) => void,
  ) => Promise<BulkUploadResult>;
  deviceBackupBulkUploading?: boolean;
  isOnline: boolean;
};

function AdminSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: AdminSection;
  onChange: (section: AdminSection) => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto whitespace-nowrap rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-1 scrollbar-hide">
      {[
        { key: "rules" as const, label: "Aturan laporan" },
        { key: "reporters" as const, label: "Kelola pengguna" },
        { key: "templates" as const, label: "Template Excel" },
        { key: "bulk-export" as const, label: "Bulk Export" },
        { key: "bulk-upload" as const, label: "Bulk Upload Cadangan" },
        { key: "sounds" as const, label: "Suara Alert" },
      ].map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onChange(section.key)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeSection === section.key
              ? "bg-[var(--primary)] text-[var(--primary-contrast)]"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
          }`}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

function ClearableTextInput(props: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
}) {
  const { type = "text" } = props;
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{props.label}</span>
      <div className="relative">
        <input
          value={props.value}
          type={type}
          readOnly={props.readOnly}
          onChange={(event) => props.onChange?.(event.target.value)}
          placeholder={props.placeholder}
          className={`${inputClassName} ${props.onClear ? "pr-11" : ""}`}
        />
        {props.onClear ? (
          <button
            type="button"
            onClick={props.onClear}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            aria-label={`Kosongkan ${props.label.toLowerCase()}`}
          >
            x
          </button>
        ) : null}
      </div>
    </label>
  );
}

function AdminSessionCard(props: {
  adminSession: AdminSessionState;
  adminSubmitting: boolean;
  adminActiveAction: AdminActiveAction;
  onHandleAdminLogout: () => Promise<void>;
}) {
  return (
    <div className="surface-card flex flex-wrap items-center gap-3 rounded-[20px] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {props.adminSession.profile.fullName}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {props.adminSession.profile.role.toUpperCase()} |{" "}
          {props.adminSession.user.email}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void props.onHandleAdminLogout()}
        disabled={props.adminSubmitting}
        className="btn-secondary ml-auto min-w-[88px] px-4 py-2 text-xs disabled:opacity-60"
      >
        {props.adminActiveAction === "logout" ? <SpinnerIcon /> : "Logout"}
      </button>
    </div>
  );
}

function AdminLoginCard(props: AdminDashboardViewProps) {
  return (
    <div className="surface-card max-w-xl rounded-[24px] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
        Login admin
      </h3>
      <div className="mt-5 grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Email admin</span>
          <input
            type="email"
            value={props.adminEmail}
            onChange={(event) => props.setAdminEmail(event.target.value)}
            placeholder="admin@example.com"
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={props.adminPassword}
            onChange={(event) => props.setAdminPassword(event.target.value)}
            placeholder="Password admin"
            className={inputClassName}
          />
        </label>
        <button
          type="button"
          onClick={() => void props.onHandleAdminLogin()}
          disabled={props.adminAuthLoading || props.adminSubmitting}
          className="btn-primary w-full justify-center disabled:opacity-60"
        >
          {props.adminAuthLoading || props.adminActiveAction === "login" ? (
            <SpinnerIcon />
          ) : (
            "Login admin"
          )}
        </button>
      </div>
    </div>
  );
}

function TemplateApproverCard(props: {
  roleLabel: string;
  accentClassName: string;
  draft: ReportTemplateApproverDraft;
  hideOfficialTitle?: boolean;
  onChange: <K extends keyof ReportTemplateApproverDraft>(
    key: K,
    value: ReportTemplateApproverDraft[K],
  ) => void;
}) {
  return (
    <div className="surface-muted rounded-[24px] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold ${props.accentClassName}`}
        >
          {props.roleLabel
            .split(" ")
            .map((part) => part[0] ?? "")
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Default form
          </p>
          <h4 className="text-base font-semibold text-[var(--text-primary)]">
            {props.roleLabel}
          </h4>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="space-y-2">
          <span className="text-sm font-medium">Label dokumen</span>
          <input
            value={props.draft.scopeLabel}
            onChange={(event) =>
              props.onChange("scopeLabel", event.target.value)
            }
            placeholder="Label pejabat"
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Nama pejabat</span>
          <input
            value={props.draft.officialName}
            onChange={(event) =>
              props.onChange("officialName", event.target.value)
            }
            placeholder="Nama pejabat"
            className={inputClassName}
          />
        </label>
        {!props.hideOfficialTitle ? (
          <label className="space-y-2">
            <span className="text-sm font-medium">Jabatan / Pangkat</span>
            <input
              value={props.draft.officialTitle}
              onChange={(event) =>
                props.onChange("officialTitle", event.target.value)
              }
              placeholder="Opsional"
              className={inputClassName}
            />
          </label>
        ) : null}
        <label className="space-y-2">
          <span className="text-sm font-medium">NIP</span>
          <input
            value={props.draft.officialNip}
            onChange={(event) =>
              props.onChange("officialNip", event.target.value)
            }
            placeholder="Nomor induk pegawai"
            className={inputClassName}
          />
        </label>
      </div>
    </div>
  );
}

function DeviceBackupSettingsCard(props: {
  reports: Report[];
  deviceBackupExporting?: boolean;
  onHandleDownloadDeviceBackupExcel?: (reports?: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupJson?: (
    reports?: Report[],
    userFilter?: string,
  ) => Promise<void>;
  onNavigateBulkUpload?: () => void;
}) {
  const localReportsCount = useMemo(
    () => (props.reports || []).filter((r) => r.source === "local").length,
    [props.reports],
  );

  return (
    <div className="surface-card rounded-[24px] p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <rect width="20" height="8" x="2" y="2" rx="2" />
              <rect width="20" height="8" x="2" y="14" rx="2" />
              <line x1="6" x2="6.01" y1="6" y2="6" />
              <line x1="6" x2="6.01" y1="18" y2="18" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Cadangan Perangkat Lokal (Excel, JSON &amp; Bulk Upload)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                Worksheet Tab per User
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                Data per Tanggal &amp; Detail
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                Format JSON
              </span>
              {localReportsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {localReportsCount} cadangan aktif
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)] max-w-2xl leading-relaxed">
              Unduh seluruh data cadangan laporan yang tersimpan di perangkat/browser ini dalam format file Excel (.xlsx) atau JSON (.json).
              Anda juga dapat mengunggah (bulk upload) seluruh data tersimpan langsung ke database Supabase tanpa batasan kelengkapan data.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() =>
              props.onHandleDownloadDeviceBackupExcel &&
              void props.onHandleDownloadDeviceBackupExcel()
            }
            disabled={props.deviceBackupExporting}
            className="btn-primary h-[44px] px-4 text-xs font-bold flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white border-none shadow-md justify-center transition-all disabled:opacity-60"
          >
            {props.deviceBackupExporting ? (
              <>
                <SpinnerIcon />
                <span>Menyusun...</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download Excel (.xlsx)</span>
              </>
            )}
          </button>

          {props.onHandleDownloadDeviceBackupJson && (
            <button
              type="button"
              onClick={() =>
                props.onHandleDownloadDeviceBackupJson &&
                void props.onHandleDownloadDeviceBackupJson()
              }
              disabled={props.deviceBackupExporting}
              className="btn-secondary h-[44px] px-4 text-xs font-bold flex items-center gap-2 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 justify-center transition-all disabled:opacity-60"
            >
              {props.deviceBackupExporting ? (
                <>
                  <SpinnerIcon />
                  <span>Menyusun...</span>
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>Download JSON (.json)</span>
                </>
              )}
            </button>
          )}

          {props.onNavigateBulkUpload && (
            <button
              type="button"
              onClick={props.onNavigateBulkUpload}
              className="btn-secondary h-[44px] px-4 text-xs font-bold flex items-center gap-2 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 justify-center transition-all"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Bulk Upload ke Database</span>
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border-soft)]/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>💡 Termasuk data cache browser lokal, draft tersimpan offline, dan snapshot perangkat.</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Aman tanpa menghapus data</span>
      </div>
    </div>
  );
}

function ReportRulesPanel(
  props: AdminDashboardViewProps & { onNavigateBulkUpload?: () => void },
) {
  return (
    <div className="grid gap-4">
      {/* Cadangan Perangkat Lokal Excel & JSON */}
      <DeviceBackupSettingsCard
        reports={props.reports}
        deviceBackupExporting={props.deviceBackupExporting}
        onHandleDownloadDeviceBackupExcel={
          props.onHandleDownloadDeviceBackupExcel
        }
        onHandleDownloadDeviceBackupJson={
          props.onHandleDownloadDeviceBackupJson
        }
        onNavigateBulkUpload={props.onNavigateBulkUpload}
      />

      <div className="surface-card rounded-[24px] p-5">
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4">
            <input
              type="checkbox"
              checked={props.adminRuleDraft.allowAnyReportDate}
              onChange={(event) =>
                props.onChangeAdminRule(
                  "allowAnyReportDate",
                  event.target.checked,
                )
              }
              className="mt-1 h-5 w-5 accent-[var(--primary)]"
            />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Izinkan input laporan untuk tanggal mana pun
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Jika dimatikan, publik hanya bisa mengisi hari berjalan.
              </p>
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">
              Maksimal foto per aktivitas
            </span>
            <input
              type="number"
              min="1"
              value={props.adminRuleDraft.maxPhotosPerActivity}
              onChange={(event) =>
                props.onChangeAdminRule(
                  "maxPhotosPerActivity",
                  Number(event.target.value),
                )
              }
              className={inputClassName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">
              Tanggal mulai operasional sistem
            </span>
            <p className="text-xs text-[var(--text-muted)]">
              Laporan &amp; statistik hanya dihitung mulai dari tanggal ini.
            </p>
            <input
              type="date"
              value={props.adminRuleDraft.systemStartDate}
              onChange={(event) =>
                props.onChangeAdminRule(
                  "systemStartDate",
                  event.target.value,
                )
              }
              className={inputClassName}
            />
          </label>

          <button
            type="button"
            onClick={() => void props.onHandleSaveAdminRules()}
            disabled={props.adminSubmitting}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {props.adminActiveAction === "save-rules" ? (
              <SpinnerIcon />
            ) : (
              "Simpan rules"
            )}
          </button>
        </div>
      </div>

      <div className="surface-card rounded-[24px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Default pejabat form
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Nilai ini akan dipakai sebagai default form laporan dan direkam
              sebagai snapshot saat laporan dibuat.
            </p>
          </div>
          {props.activeReportTemplateConfig ? (
            <div className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
              Template aktif: {props.activeReportTemplateConfig.templateName}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TemplateApproverCard
            roleLabel="Koordinator Tim TRC"
            accentClassName="bg-[var(--info-soft)] text-[var(--info)]"
            draft={props.adminTemplateApproverDrafts.coordinator_team_trc}
            hideOfficialTitle
            onChange={(key, value) =>
              props.onChangeAdminTemplateApproverDraft(
                "coordinator_team_trc",
                key,
                value,
              )
            }
          />
          <TemplateApproverCard
            roleLabel="Koordinator Tim PUSDALOPS"
            accentClassName="bg-[var(--success-soft)] text-[var(--success)]"
            draft={props.adminTemplateApproverDrafts.coordinator_team_pusdalops}
            hideOfficialTitle
            onChange={(key, value) =>
              props.onChangeAdminTemplateApproverDraft(
                "coordinator_team_pusdalops",
                key,
                value,
              )
            }
          />
          <TemplateApproverCard
            roleLabel="Kepala Bidang"
            accentClassName="bg-[var(--warning-soft)] text-[var(--warning)]"
            draft={props.adminTemplateApproverDrafts.division_head}
            onChange={(key, value) =>
              props.onChangeAdminTemplateApproverDraft(
                "division_head",
                key,
                value,
              )
            }
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void props.onHandleSaveTemplateApproverDefaults()}
            disabled={
              props.adminSubmitting || !props.activeReportTemplateConfig
            }
            className="btn-primary min-w-[176px] px-4 py-2 text-sm disabled:opacity-60"
          >
            {props.adminActiveAction === "save-template-approvers" ? (
              <SpinnerIcon />
            ) : (
              "Simpan default pejabat"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReporterManagementPanelProps = AdminDashboardViewProps & {
  reporterSearch: string;
  reporterSortMode: ReporterSortMode;
  onReporterSearchChange: (value: string) => void;
  onReporterSortModeChange: (value: ReporterSortMode) => void;
};

function ReporterManagementPanel(props: ReporterManagementPanelProps) {
  const [editingReporterId, setEditingReporterId] = useState<string | null>(
    null,
  );
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    adminGetReporterPasswords()
      .then((data) => {
        if (!alive) return;
        setPasswords(data);
      })
      .catch((err) => {
        console.error("Gagal memuat password user:", err);
      });
    return () => {
      alive = false;
    };
  }, [props.reporterProfiles]);

  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(
    null,
  );

  const selectedReporter =
    props.reporterProfiles.find(
      (reporter) => reporter.id === selectedReporterId,
    ) ?? null;

  const visibleReporters = props.reporterProfiles
    .filter((reporter) =>
      reporter.fullName
        .toLowerCase()
        .includes(props.reporterSearch.trim().toLowerCase()),
    )
    .slice()
    .sort((left, right) => {
      if (props.reporterSortMode === "name-desc") {
        return right.fullName.localeCompare(left.fullName);
      }

      if (props.reporterSortMode === "join-time") {
        return (right.firstReportedAt ?? "").localeCompare(
          left.firstReportedAt ?? "",
        );
      }

      return left.fullName.localeCompare(right.fullName);
    });

  if (selectedReporter) {
    return (
      <AdminReporterStatsView
        reporter={selectedReporter}
        reports={props.reports}
        loading={props.loading}
        onBack={() => setSelectedReporterId(null)}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {/* Mobile toolbar is now removed from here, integrated in the main tabs bar */}

      {visibleReporters.length === 0 ? (
        <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)]">
          Belum ada pengguna publik yang tercatat.
        </div>
      ) : null}

      {visibleReporters.map((reporter) => {
        const isEditing = editingReporterId === reporter.id;

        return (
          <AdminEditableListCard
            key={reporter.id}
            title={
              isEditing ? (
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Edit pengguna publik
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedReporterId(reporter.id)}
                  className="truncate text-left text-base font-semibold text-[var(--text-primary)] transition hover:text-[var(--primary)]"
                >
                  {reporter.fullName}
                </button>
              )
            }
            meta={
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{reporter.totalReports} laporan</span>
                {reporter.firstReportedAt ? (
                  <span>
                    Awal: {formatWitaDateTime(reporter.firstReportedAt)}
                  </span>
                ) : null}
                {reporter.lastReportedAt ? (
                  <span>
                    Terakhir: {formatWitaDateTime(reporter.lastReportedAt)}
                  </span>
                ) : null}
              </div>
            }
            isEditing={isEditing}
            editContent={
              <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
                <ClearableTextInput
                  label="Nama pengguna publik"
                  value={
                    props.adminReporterDraftNames[reporter.id] ??
                    reporter.fullName
                  }
                  onChange={(value) =>
                    props.onChangeAdminReporterDraftName(reporter.id, value)
                  }
                  onClear={() =>
                    props.onChangeAdminReporterDraftName(reporter.id, "")
                  }
                />
                <ClearableTextInput
                  label="Password Pengguna"
                  value={passwords[reporter.id] ?? "123123123"}
                  onChange={(value) => {
                    setPasswords(prev => ({ ...prev, [reporter.id]: value }));
                  }}
                />
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-4 py-3 text-xs text-[var(--text-muted)] md:col-span-2">
                  <p>
                    Data relasional laporan ikut memakai nama terbaru saat
                    disimpan. Password default adalah '123123123'.
                  </p>
                </div>
              </div>
            }
            disableActions={props.adminSubmitting}
            saveLoading={
              props.adminActiveAction === "rename-reporter" &&
              props.adminActiveItemId === reporter.id
            }
            deleteLoading={
              props.adminActiveAction === "delete-reporter" &&
              props.adminActiveItemId === reporter.id
            }
            saveLoadingLabel="mengubah profil"
            deleteLoadingLabel="menghapus jejak pengguna"
            onStartEdit={() => setEditingReporterId(reporter.id)}
            onCancelEdit={() => {
              props.onChangeAdminReporterDraftName(
                reporter.id,
                reporter.fullName,
              );
              setEditingReporterId(null);
            }}
            onSaveEdit={() => {
              void props
                .onHandleRenameReporterProfile(reporter, passwords[reporter.id])
                .then(() => setEditingReporterId(null));
            }}
            onDelete={() => void props.onHandleDeleteReporterTrace(reporter)}
            deleteLabel="Hapus jejak"
          />
        );
      })}
    </div>
  );
}

function ExcelTemplatePanel(props: AdminDashboardViewProps) {
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-[24px] p-4 sm:p-5">
        <div className="grid items-end gap-3 lg:grid-cols-[minmax(220px,1.4fr)_150px_110px_minmax(180px,220px)_auto]">
          <ClearableTextInput
            label="Nama template"
            value={props.excelTemplateDraft.templateName}
            placeholder="Template-format-excel_YYYY-MM-DD_v1"
            onChange={(value) =>
              props.onChangeExcelTemplateDraft("templateName", value)
            }
            onClear={props.onClearExcelTemplateDraftName}
          />

          <ClearableTextInput
            label="Tanggal dokumen"
            value={props.excelTemplateDraft.templateDate}
            readOnly
          />

          <ClearableTextInput
            label="Versi cache"
            value={props.excelTemplateDraft.cacheVersion}
            placeholder="v1"
            onChange={(value) =>
              props.onChangeExcelTemplateDraft("cacheVersion", value)
            }
          />

          <div className="lg:-mt-1">
            <FileUploadInput
              label="Pilih file .xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              selectedFileName={props.selectedExcelTemplateFileName}
              disabled={props.excelTemplateUploading}
              inputKey={
                props.selectedExcelTemplateFileName || "empty-template-file"
              }
              onChange={(files) =>
                props.onSelectExcelTemplateFile(files?.[0] ?? null)
              }
            />
          </div>

          <button
            type="button"
            onClick={() => void props.onHandleUploadExcelTemplate()}
            disabled={
              props.excelTemplateUploading ||
              !props.selectedExcelTemplateFileName
            }
            className="btn-primary h-[52px] min-w-[144px] justify-center px-5 py-2 text-sm disabled:opacity-60"
          >
            {props.excelTemplateUploading ? <SpinnerIcon /> : "Upload template"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>
            File:{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {props.selectedExcelTemplateFileName || "Belum ada"}
            </span>
          </span>
          <span>
            Aktif:{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {props.activeExcelTemplate?.templateName ?? "Belum ada"}
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        {props.excelTemplates.length === 0 ? (
          <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)] flex flex-col gap-1">
            <span className="font-medium text-[var(--text-primary)]">
              Belum ada template kustom yang diunggah
            </span>
            <span>
              Sistem saat ini otomatis menggunakan{" "}
              <strong className="text-[var(--text-primary)]">Template Bawaan Sistem (Lokal)</strong>{" "}
              untuk seluruh kebutuhan ekspor Excel. Anda dapat mengunggah file template <code className="text-xs bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">.xlsx</code> baru di atas kapan saja untuk menggantikannya secara dinamis.
            </span>
          </div>
        ) : null}

        {props.excelTemplates.map((template) => {
          const isEditing = editingTemplateId === template.id;
          const draft = props.adminExcelTemplateDrafts[template.id] ?? {
            templateName: template.templateName,
            templateDate: template.createdAt.slice(0, 10),
            cacheVersion: template.cacheVersion,
          };

          return (
            <AdminEditableListCard
              key={template.id}
              title={
                isEditing ? (
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Edit template Excel
                  </span>
                ) : (
                  <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">
                    {template.templateName}
                  </h3>
                )
              }
              badges={
                <>
                  <span className="rounded-full bg-[var(--surface-panel-strong)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {template.cacheVersion}
                  </span>
                  {template.isActive ? (
                    <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
                      Aktif
                    </span>
                  ) : null}
                </>
              }
              meta={
                <>
                  <p className="break-all">{template.storagePath}</p>
                  <p className="mt-1">
                    Update: {formatWitaDateTime(template.updatedAt)}
                  </p>
                </>
              }
              isEditing={isEditing}
              editContent={
                <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_140px]">
                  <ClearableTextInput
                    label="Nama template"
                    value={draft.templateName}
                    onChange={(value) =>
                      props.onChangeAdminExcelTemplateDraft(
                        template.id,
                        "templateName",
                        value,
                      )
                    }
                    onClear={() =>
                      props.onChangeAdminExcelTemplateDraft(
                        template.id,
                        "templateName",
                        "",
                      )
                    }
                  />
                  <ClearableTextInput
                    label="Versi cache"
                    value={draft.cacheVersion}
                    onChange={(value) =>
                      props.onChangeAdminExcelTemplateDraft(
                        template.id,
                        "cacheVersion",
                        value,
                      )
                    }
                  />
                </div>
              }
              disableActions={props.adminSubmitting}
              saveLoading={
                props.adminActiveAction === "rename-excel-template" &&
                props.adminActiveItemId === template.id
              }
              primaryActionLoading={
                props.adminActiveAction === "activate-excel-template" &&
                props.adminActiveItemId === template.id
              }
              deleteLoading={
                props.adminActiveAction === "delete-excel-template" &&
                props.adminActiveItemId === template.id
              }
              saveLoadingLabel="menyimpan metadata"
              primaryActionLoadingLabel="pindah template aktif"
              deleteLoadingLabel="menghapus berkas excel"
              onStartEdit={() => setEditingTemplateId(template.id)}
              onCancelEdit={() => {
                props.onChangeAdminExcelTemplateDraft(
                  template.id,
                  "templateName",
                  template.templateName,
                );
                props.onChangeAdminExcelTemplateDraft(
                  template.id,
                  "cacheVersion",
                  template.cacheVersion,
                );
                setEditingTemplateId(null);
              }}
              onSaveEdit={() => {
                void props
                  .onHandleRenameExcelTemplate(template)
                  .then(() => setEditingTemplateId(null));
              }}
              onPrimaryAction={
                template.isActive
                  ? undefined
                  : () => void props.onHandleActivateExcelTemplate(template.id)
              }
              primaryActionLabel={
                template.isActive ? "Sedang aktif" : "Jadikan utama"
              }
              onDelete={
                template.isActive
                  ? undefined
                  : () => void props.onHandleDeleteExcelTemplate(template)
              }
              deleteLabel="Delete"
              extraActions={
                template.publicUrl ? (
                  <a
                    href={template.publicUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-4 py-2 text-sm disabled:opacity-60 items-center flex"
                    title="Download format Excel"
                  >
                    Download
                  </a>
                ) : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function SoundSettingsPanel(props: {
  notificationSettings: NotificationSettings;
  adminSubmitting: boolean;
  adminActiveAction: AdminActiveAction;
  onChangeNotificationSettings: <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => void;
  onHandleSaveNotificationSettings: () => Promise<void>;
}) {
  const handleUpdate = (
    type: "success" | "fail",
    key: "mode" | "specificFile",
    value: string,
  ) => {
    props.onChangeNotificationSettings(type, {
      ...props.notificationSettings[type],
      [key]: value,
    });
  };

  const renderSection = (
    type: "success" | "fail",
    title: string,
    list: Record<string, string>,
  ) => {
    const config = props.notificationSettings[type];
    return (
      <div className="surface-card rounded-[24px] p-5">
        <h4 className="text-base font-semibold text-[var(--text-primary)] mb-4">
          {title}
        </h4>
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--text-muted)]">
              Mode Putar
            </span>
            <select
              className={inputClassName}
              value={config.mode}
              onChange={(e) => handleUpdate(type, "mode", e.target.value)}
            >
              <option value="random">Acak (Random Pick)</option>
              <option value="specific">Pilih Spesifik</option>
            </select>
          </label>

          {config.mode === "specific" && (
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-muted)]">
                File Suara
              </span>
              <select
                className={inputClassName}
                value={config.specificFile || ""}
                onChange={(e) =>
                  handleUpdate(type, "specificFile", e.target.value)
                }
              >
                <option value="" disabled>
                  Pilih suara...
                </option>
                {Object.keys(list).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => playSound(type, props.notificationSettings)}
            className="btn-secondary w-full justify-center text-xs py-2 mt-2"
          >
            🔊 Test Suara
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="surface-card rounded-[24px] p-5 md:col-span-2">
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4">
            <input
              type="checkbox"
              checked={
                !props.notificationSettings.disableSoundResponsesForAllUsers
              }
              onChange={(event) =>
                props.onChangeNotificationSettings(
                  "disableSoundResponsesForAllUsers",
                  !event.target.checked,
                )
              }
              className="mt-1 h-5 w-5 accent-[var(--primary)]"
            />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Aktifkan respond suara untuk semua user
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Jika dimatikan, seluruh alert tetap tampil tetapi tanpa suara.
              </p>
            </div>
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void props.onHandleSaveNotificationSettings()}
              disabled={props.adminSubmitting}
              className="btn-primary min-w-[156px] px-4 py-2 text-sm disabled:opacity-60"
            >
              {props.adminActiveAction === "save-notification-settings" ? (
                <SpinnerIcon />
              ) : (
                "Simpan aturan suara"
              )}
            </button>
          </div>
        </div>
      </div>
      {renderSection("success", "Suara Berhasil (Success)", SUCCESS_SOUNDS)}
      {renderSection("fail", "Suara Gagal (Error)", FAIL_SOUNDS)}
      <div className="md:col-span-2 surface-card rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-4 text-xs text-[var(--text-muted)]">
        <p>
          💡 Fitur iseng: Suara hanya tersimpan di browser ini saja (Local
          Storage). Admin lain mungkin punya selera audio yang berbeda!
        </p>
      </div>
    </div>
  );
}

function BulkExportPanel(props: {
  reports: Report[];
  bulkExporting: boolean;
  onHandleBulkExport: (reports: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupExcel?: (reports?: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupJson?: (
    reports?: Report[],
    userFilter?: string,
  ) => Promise<void>;
  deviceBackupExporting?: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const localBackupReportsCount = useMemo(
    () => props.reports.filter((r) => r.source === "local").length,
    [props.reports],
  );

  const visibleReports = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return props.reports
      .filter((report) => {
        if (search && !report.nama.toLowerCase().includes(search)) {
          return false;
        }
        if (dateFrom && report.reportDate < dateFrom) {
          return false;
        }
        if (dateTo && report.reportDate > dateTo) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((left, right) => {
        const byDate = right.reportDate.localeCompare(left.reportDate);
        if (byDate !== 0) {
          return byDate;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [dateFrom, dateTo, keyword, props.reports]);

  const selectedReports = useMemo(
    () => visibleReports.filter((report) => selectedIds.includes(report.id)),
    [selectedIds, visibleReports],
  );

  const groupedByDate = useMemo(
    () =>
      visibleReports.reduce<Record<string, Report[]>>((accumulator, report) => {
        const current = accumulator[report.reportDate] ?? [];
        current.push(report);
        accumulator[report.reportDate] = current;
        return accumulator;
      }, {}),
    [visibleReports],
  );

  function toggleSelect(reportId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(reportId)) {
          return current;
        }
        return [...current, reportId];
      }
      return current.filter((id) => id !== reportId);
    });
  }

  function selectAllVisible() {
    setSelectedIds(visibleReports.map((report) => report.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <div className="grid gap-4">
      {/* Kartu Khusus Cadangan Perangkat Excel & JSON */}
      <div className="surface-card rounded-[24px] p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Download Cadangan Perangkat (Excel &amp; JSON)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                Worksheet Tab per User
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                Format JSON
              </span>
              {localBackupReportsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {localBackupReportsCount} cadangan aktif
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-2xl leading-relaxed">
              Unduh seluruh data cadangan lokal yang tersimpan di perangkat ini dalam format Excel (.xlsx) atau JSON (.json).
              File Excel otomatis dikelompokkan berdasarkan worksheet tab per user dengan data per tanggal dan detail kegiatan lengkap.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() =>
              props.onHandleDownloadDeviceBackupExcel &&
              void props.onHandleDownloadDeviceBackupExcel()
            }
            disabled={props.deviceBackupExporting}
            className="btn-secondary h-[44px] px-4 text-xs font-bold flex items-center gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition shadow-sm justify-center"
          >
            {props.deviceBackupExporting ? (
              <>
                <SpinnerIcon />
                <span>Menyusun...</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download Excel (.xlsx)</span>
              </>
            )}
          </button>

          {props.onHandleDownloadDeviceBackupJson && (
            <button
              type="button"
              onClick={() =>
                props.onHandleDownloadDeviceBackupJson &&
                void props.onHandleDownloadDeviceBackupJson()
              }
              disabled={props.deviceBackupExporting}
              className="btn-secondary h-[44px] px-4 text-xs font-bold flex items-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition shadow-sm justify-center"
            >
              {props.deviceBackupExporting ? (
                <>
                  <SpinnerIcon />
                  <span>Menyusun...</span>
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>Download JSON (.json)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="surface-card rounded-[24px] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium">Cari nama petugas</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="mis. Andi"
              className={inputClassName}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Dari tanggal</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Sampai tanggal</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className={inputClassName}
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Aksi cepat</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="btn-secondary h-[44px] px-4 text-sm"
              >
                Pilih terlihat
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="btn-secondary h-[44px] px-4 text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-muted)]">
            Terfilter: {visibleReports.length} laporan | Terpilih:{" "}
            {selectedReports.length} laporan
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {props.onHandleDownloadDeviceBackupExcel && (
              <button
                type="button"
                onClick={() =>
                  props.onHandleDownloadDeviceBackupExcel &&
                  void props.onHandleDownloadDeviceBackupExcel(selectedReports)
                }
                disabled={props.deviceBackupExporting || selectedReports.length === 0}
                className="btn-secondary h-[42px] px-3.5 text-xs font-semibold disabled:opacity-60 flex items-center gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400"
                title="Ekspor laporan terpilih ke 1 file Excel dikelompokkan per worksheet tab per user"
              >
                {props.deviceBackupExporting ? (
                  <SpinnerIcon />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                <span>Excel Terpilih</span>
              </button>
            )}
            {props.onHandleDownloadDeviceBackupJson && (
              <button
                type="button"
                onClick={() =>
                  props.onHandleDownloadDeviceBackupJson &&
                  void props.onHandleDownloadDeviceBackupJson(selectedReports)
                }
                disabled={props.deviceBackupExporting || selectedReports.length === 0}
                className="btn-secondary h-[42px] px-3.5 text-xs font-semibold disabled:opacity-60 flex items-center gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                title="Ekspor laporan terpilih dalam format JSON"
              >
                {props.deviceBackupExporting ? (
                  <SpinnerIcon />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                <span>JSON Terpilih</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void props.onHandleBulkExport(selectedReports)}
              disabled={props.bulkExporting || selectedReports.length === 0}
              className="btn-primary h-[42px] px-5 text-sm disabled:opacity-60"
            >
              {props.bulkExporting ? <SpinnerIcon /> : "Export Terpilih"}
            </button>
          </div>
        </div>
      </div>

      {Object.keys(groupedByDate).length === 0 ? (
        <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)]">
          Belum ada laporan pada filter saat ini.
        </div>
      ) : null}

      {Object.entries(groupedByDate).map(([reportDate, reports]) => {
        const selectedInDate = reports.filter((report) =>
          selectedIds.includes(report.id),
        ).length;
        const allChecked = reports.length > 0 && selectedInDate === reports.length;

        return (
          <div key={reportDate} className="surface-card rounded-[24px] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {formatWitaDate(reportDate)}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedInDate}/{reports.length} terpilih
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (allChecked) {
                    setSelectedIds((current) =>
                      current.filter((id) => !reports.some((report) => report.id === id)),
                    );
                    return;
                  }
                  setSelectedIds((current) => {
                    const next = [...current];
                    reports.forEach((report) => {
                      if (!next.includes(report.id)) {
                        next.push(report.id);
                      }
                    });
                    return next;
                  });
                }}
                className="btn-secondary h-[38px] px-4 text-xs"
              >
                {allChecked ? "Lepas tanggal ini" : "Pilih tanggal ini"}
              </button>
            </div>

            <div className="grid gap-2">
              {reports.map((report) => (
                <label
                  key={report.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(report.id)}
                    onChange={(event) =>
                      toggleSelect(report.id, event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-[var(--primary)]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {report.nama}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Update {formatWitaDateTime(report.updatedAt)} |{" "}
                      {report.activities.length} aktivitas
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BulkUploadPanel(props: {
  reports: Report[];
  onHandleBulkUploadDeviceBackup?: (
    backupReports: Report[],
    selectedActivitiesByReportId: Record<string, number[]>,
    onItemProgress?: (progress: BulkUploadItemProgress) => void,
    onProgressStateChange?: (state: BulkUploadProgressState) => void,
  ) => Promise<BulkUploadResult>;
  deviceBackupBulkUploading?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"selection" | "progress">("selection");
  const [sourceType, setSourceType] = useState<"device" | "json">("device");
  const [deviceReports, setDeviceReports] = useState<Report[]>([]);
  const [importedReports, setImportedReports] = useState<Report[]>([]);
  const [importedFileName, setImportedFileName] = useState("");
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<
    Record<string, number[]>
  >({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedReports, setExpandedReports] = useState<
    Record<string, boolean>
  >({});
  const [liveProgressState, setLiveProgressState] =
    useState<BulkUploadProgressState | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromDevice = async () => {
    setDeviceLoading(true);
    setUploadResult(null);
    try {
      const data = await getAllDeviceBackupReports(props.reports);
      setDeviceReports(data);
      const sel: Record<string, number[]> = {};
      const expU: Record<string, boolean> = {};
      data.forEach((r) => {
        sel[r.id] = (r.activities || []).map((a) => a.no);
        expU[r.nama] = true;
      });
      setSelectedActivities(sel);
      setExpandedUsers(expU);
    } catch {
      // safe fallback
    } finally {
      setDeviceLoading(false);
    }
  };

  useEffect(() => {
    void loadFromDevice();
  }, [props.reports]);

  const handleJsonFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportedFileName(file.name);
      const parsed = await parseDeviceBackupJsonFile(file);
      setImportedReports(parsed);
      setSourceType("json");
      setUploadResult(null);
      const sel: Record<string, number[]> = {};
      const expU: Record<string, boolean> = {};
      parsed.forEach((r) => {
        sel[r.id] = (r.activities || []).map((a) => a.no);
        expU[r.nama] = true;
      });
      setSelectedActivities(sel);
      setExpandedUsers(expU);
    } catch (err: any) {
      alert(
        "Gagal membaca file JSON: " + (err?.message || "Format tidak valid"),
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const currentDataset =
    sourceType === "device" ? deviceReports : importedReports;

  const visibleReports = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return currentDataset
      .filter((report) => {
        if (
          q &&
          !report.nama.toLowerCase().includes(q) &&
          !report.activities.some((a) => a.description.toLowerCase().includes(q))
        ) {
          return false;
        }
        if (dateFrom && report.reportDate < dateFrom) {
          return false;
        }
        if (dateTo && report.reportDate > dateTo) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const byDate = b.reportDate.localeCompare(a.reportDate);
        if (byDate !== 0) return byDate;
        return a.nama.localeCompare(b.nama);
      });
  }, [currentDataset, keyword, dateFrom, dateTo]);

  // Group by User
  const groupedByUser = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const report of visibleReports) {
      const user = report.nama || "Tanpa Nama";
      if (!map.has(user)) {
        map.set(user, []);
      }
      map.get(user)!.push(report);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleReports]);

  const selectedActivitiesCount = useMemo(() => {
    return visibleReports.reduce((sum, r) => {
      const selected = selectedActivities[r.id] || [];
      return sum + selected.length;
    }, 0);
  }, [visibleReports, selectedActivities]);

  const totalVisibleActivities = useMemo(() => {
    return visibleReports.reduce(
      (sum, r) => sum + (r.activities?.length || 0),
      0,
    );
  }, [visibleReports]);

  const selectedReportsCount = useMemo(() => {
    return visibleReports.filter(
      (r) => (selectedActivities[r.id] || []).length > 0,
    ).length;
  }, [visibleReports, selectedActivities]);

  const selectedUsersCount = useMemo(() => {
    const users = new Set<string>();
    visibleReports.forEach((r) => {
      if ((selectedActivities[r.id] || []).length > 0) {
        users.add(r.nama);
      }
    });
    return users.size;
  }, [visibleReports, selectedActivities]);

  const toggleActivity = (reportId: string, activityNo: number) => {
    setSelectedActivities((prev) => {
      const current = prev[reportId] || [];
      const next = current.includes(activityNo)
        ? current.filter((no) => no !== activityNo)
        : [...current, activityNo];
      return { ...prev, [reportId]: next };
    });
  };

  const toggleReport = (report: Report) => {
    const allNos = (report.activities || []).map((a) => a.no);
    const current = selectedActivities[report.id] || [];
    const isAllSelected =
      allNos.length > 0 && current.length === allNos.length;
    setSelectedActivities((prev) => ({
      ...prev,
      [report.id]: isAllSelected ? [] : allNos,
    }));
  };

  const toggleUser = (userReports: Report[]) => {
    const isUserAllSelected = userReports.every((r) => {
      const selected = selectedActivities[r.id] || [];
      return (
        r.activities.length > 0 && selected.length === r.activities.length
      );
    });
    setSelectedActivities((prev) => {
      const next = { ...prev };
      userReports.forEach((r) => {
        next[r.id] = isUserAllSelected
          ? []
          : (r.activities || []).map((a) => a.no);
      });
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedActivities((prev) => {
      const next = { ...prev };
      visibleReports.forEach((r) => {
        next[r.id] = (r.activities || []).map((a) => a.no);
      });
      return next;
    });
  };

  const clearAllVisible = () => {
    setSelectedActivities((prev) => {
      const next = { ...prev };
      visibleReports.forEach((r) => {
        next[r.id] = [];
      });
      return next;
    });
  };

  const toggleExpandUser = (user: string) => {
    setExpandedUsers((prev) => ({ ...prev, [user]: !prev[user] }));
  };

  const toggleExpandReport = (reportId: string) => {
    setExpandedReports((prev) => ({ ...prev, [reportId]: !prev[reportId] }));
  };

  const expandAll = () => {
    const expU: Record<string, boolean> = {};
    const expR: Record<string, boolean> = {};
    visibleReports.forEach((r) => {
      expU[r.nama] = true;
      expR[r.id] = true;
    });
    setExpandedUsers(expU);
    setExpandedReports(expR);
  };

  const collapseAll = () => {
    setExpandedUsers({});
    setExpandedReports({});
  };

  const handleStartUpload = async () => {
    if (!props.onHandleBulkUploadDeviceBackup) return;
    if (selectedActivitiesCount === 0) {
      alert("Pilih setidaknya satu aktivitas untuk diunggah.");
      return;
    }

    const initialProgress = buildInitialBulkUploadProgressState(
      currentDataset,
      selectedActivities,
    );
    setLiveProgressState(initialProgress);
    setViewMode("progress");
    setUploadResult(null);

    try {
      const result = await props.onHandleBulkUploadDeviceBackup(
        currentDataset,
        selectedActivities,
        undefined,
        (state) => {
          setLiveProgressState({ ...state });
        },
      );
      setUploadResult(result);
      if (result.progressState) {
        setLiveProgressState(result.progressState);
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        uploadedReportsCount: 0,
        uploadedActivitiesCount: 0,
        errors: [err?.message || "Kesalahan tak terduga saat upload"],
      });
    }
  };

  return (
    <div className="grid gap-5">
      {/* Kartu Header & Pilihan Sumber Cadangan */}
      <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Bulk Upload Cadangan Perangkat ke Database
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  Akses Admin
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  Tanpa Batasan Kelengkapan
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-muted)] max-w-3xl leading-relaxed">
                Sinkronisasikan seluruh data tersimpan (cache browser lokal,
                draft offline, atau file JSON cadangan) langsung ke database
                Supabase. Anda dapat memilih secara terperinci per pengguna, per
                tanggal laporan, hingga per setiap rincian aktivitas terkait.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSourceType("device");
                void loadFromDevice();
              }}
              disabled={deviceLoading || props.deviceBackupBulkUploading}
              className={`h-[42px] px-4 text-xs font-bold rounded-xl transition flex items-center gap-2 border ${
                sourceType === "device"
                  ? "bg-purple-600 text-white border-purple-600 shadow-md"
                  : "bg-[var(--surface-muted)] text-[var(--text-primary)] border-[var(--border-soft)] hover:bg-[var(--surface-panel-strong)]"
              }`}
            >
              {deviceLoading ? (
                <SpinnerIcon />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect width="20" height="14" x="2" y="3" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              )}
              <span>Data Perangkat Ini ({deviceReports.length})</span>
            </button>

            <label
              className={`h-[42px] px-4 text-xs font-bold rounded-xl transition flex items-center gap-2 border cursor-pointer ${
                props.deviceBackupBulkUploading ? "opacity-50 pointer-events-none" : ""
              } ${
                sourceType === "json"
                  ? "bg-purple-600 text-white border-purple-600 shadow-md"
                  : "bg-[var(--surface-muted)] text-[var(--text-primary)] border-[var(--border-soft)] hover:bg-[var(--surface-panel-strong)]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonFileUpload}
                disabled={props.deviceBackupBulkUploading}
                className="hidden"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span>
                {importedFileName
                  ? `File: ${importedFileName.slice(0, 16)}...`
                  : "Import File JSON Cadangan"}
              </span>
            </label>
          </div>
        </div>

        {/* Security & Safety Note & View Switcher */}
        <div className="pt-3 border-t border-[var(--border-soft)]/50 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold text-sm">✓</span>
            <span className="font-medium">
              <strong>100% Aman &amp; Terlindungi:</strong> Tindakan ini TIDAK
              akan menghapus, membersihkan, atau mengubah identitas cache lokal
              dan draft di perangkat Anda.
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("selection")}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                viewMode === "selection"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              1. Pemilihan Data
            </button>
            <button
              type="button"
              onClick={() => setViewMode("progress")}
              disabled={!liveProgressState}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 ${
                viewMode === "progress"
                  ? "bg-purple-600 text-white shadow-xs"
                  : liveProgressState
                    ? "bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    : "opacity-40 cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}
            >
              {props.deviceBackupBulkUploading && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
              <span>2. Progres Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: PROGRES UPLOAD PAGE (DEDICATED TREE PROGRESS VIEW) */}
      {/* ========================================================= */}
      {viewMode === "progress" && liveProgressState && (
        <div className="surface-card rounded-[28px] p-5 sm:p-6 space-y-6 border border-purple-500/20 shadow-sm animate-fadeIn">
          {/* Header Progress Page */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setViewMode("selection")}
                disabled={props.deviceBackupBulkUploading}
                className="btn-secondary h-[40px] px-3 text-xs flex items-center gap-2 rounded-xl disabled:opacity-40"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Kembali ke Seleksi</span>
              </button>
              <div>
                <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Progres Sinkronisasi Bertahap ke Database</span>
                  {props.deviceBackupBulkUploading ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-purple-500/20 text-purple-600 dark:text-purple-400 animate-pulse border border-purple-500/30">
                      Sedang Berjalan...
                    </span>
                  ) : liveProgressState.overallStatus === "completed" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Selesai
                    </span>
                  ) : null}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Mengunggah data cadangan secara bertahap per user dan per laporan ke Supabase.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Total: {liveProgressState.totalUsers} Petugas • {liveProgressState.totalReports} Laporan • {liveProgressState.totalActivities} Aktivitas
              </span>
            </div>
          </div>

          {/* Metric Status Cards & Progress Bar */}
          <div className="bg-[var(--surface-panel-strong)] rounded-2xl p-4 sm:p-5 border border-[var(--border-soft)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                {props.deviceBackupBulkUploading ? (
                  <SpinnerIcon className="h-4 w-4 animate-spin text-purple-600" />
                ) : (
                  <span className="text-emerald-500">✓</span>
                )}
                <span className="font-extrabold">{liveProgressState.currentMessage}</span>
              </div>
              <div className="text-[var(--text-muted)]">
                {liveProgressState.totalReports > 0
                  ? Math.round(
                      (liveProgressState.uploadedReportsCount /
                        liveProgressState.totalReports) *
                        100,
                    )
                  : 0}
                % Selesai ({liveProgressState.uploadedReportsCount}/
                {liveProgressState.totalReports} Laporan)
              </div>
            </div>

            {/* Main Animated Progress Bar */}
            <div className="w-full bg-[var(--surface-muted)] h-3 rounded-full overflow-hidden border border-[var(--border-soft)]">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    liveProgressState.totalReports > 0
                      ? Math.min(
                          100,
                          (liveProgressState.uploadedReportsCount /
                            liveProgressState.totalReports) *
                            100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Petugas Aktif</span>
                <p className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
                  {liveProgressState.currentUserName || "-"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Laporan Diproses</span>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {liveProgressState.uploadedReportsCount} / {liveProgressState.totalReports}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Aktivitas Terunggah</span>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {liveProgressState.uploadedActivitiesCount} / {liveProgressState.totalActivities}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)]/40 border border-[var(--border-soft)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">Status Keamanan</span>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Cache Utuh 100%
                </p>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* HIERARCHICAL TREE VIEW (COMPACT PER USER & PER REPORT PROGRESS) */}
          {/* Format:                                                        */}
          {/* o user1                                                        */}
          {/*   - o date1                                                    */}
          {/*   - o date2                                                    */}
          {/* o user2                                                        */}
          {/* =============================================================== */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
              <span>Struktur Antrean &amp; Status Unggah</span>
            </h5>

            <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
              {liveProgressState.users.map((userGroup, uIdx) => {
                const isUserUploading = userGroup.status === "uploading";
                const isUserSuccess = userGroup.status === "success";
                const isUserError = userGroup.status === "error";

                return (
                  <div
                    key={userGroup.userName}
                    className={`p-3.5 sm:p-4 space-y-2.5 transition ${
                      isUserUploading
                        ? "bg-purple-500/5"
                        : isUserError
                          ? "bg-red-500/5"
                          : ""
                    }`}
                  >
                    {/* Level 1: Compact User Progress Node ('o user') */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status Icon / Loader 'o' */}
                        <div className="shrink-0 flex items-center justify-center">
                          {isUserUploading ? (
                            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/50 shadow-xs animate-pulse">
                              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                            </span>
                          ) : isUserSuccess ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/40 shadow-2xs">
                              ✓
                            </span>
                          ) : isUserError ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/40 shadow-2xs">
                              ✕
                            </span>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-xs">
                              ○
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {userGroup.userName}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">
                            (Petugas #{uIdx + 1} • {userGroup.completedReports}/{userGroup.totalReports} selesai)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUserUploading && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                            <SpinnerIcon className="h-3 w-3 animate-spin" />
                            <span>Mengunggah...</span>
                          </span>
                        )}
                        {isUserSuccess && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Selesai ✓
                          </span>
                        )}
                        {isUserError && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                            Error ✕
                          </span>
                        )}
                        {userGroup.status === "pending" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--text-muted)]">
                            Menunggu Antrean
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Level 2: Nested Reports Nodes ('- o date') with vertical tree guide */}
                    <div className="ml-3 pl-3.5 sm:pl-4 border-l-2 border-dashed border-purple-500/30 dark:border-purple-800/40 space-y-1.5 py-0.5">
                      {userGroup.reports.map((reportItem) => {
                        const isRepUploading = reportItem.status === "uploading";
                        const isRepSuccess = reportItem.status === "success";
                        const isRepError = reportItem.status === "error";

                        return (
                          <div
                            key={reportItem.reportId}
                            className={`flex flex-wrap items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl border transition-all text-xs ${
                              isRepUploading
                                ? "bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20"
                                : isRepSuccess
                                  ? "bg-[var(--surface-muted)]/30 border-emerald-500/20"
                                  : isRepError
                                    ? "bg-red-500/10 border-red-500/30"
                                    : "bg-[var(--surface-muted)]/15 border-transparent opacity-75"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[var(--text-muted)] font-mono font-bold text-xs select-none">
                                └─
                              </span>

                              {/* Loader / Icon 'o' for Report Date */}
                              <div className="shrink-0 flex items-center justify-center">
                                {isRepUploading ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/25 text-purple-600 dark:text-purple-300 font-bold border border-purple-500/50 animate-spin">
                                    <SpinnerIcon className="h-3 w-3" />
                                  </span>
                                ) : isRepSuccess ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                    ✓
                                  </span>
                                ) : isRepError ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-[10px] border border-red-500/30">
                                    ✕
                                  </span>
                                ) : (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-[9px]">
                                    ○
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[var(--text-primary)]">
                                  {formatWitaDate(reportItem.reportDate)}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                  Tim {reportItem.tim || "TRC"}
                                </span>
                                <span className="text-[var(--text-muted)] text-[11px]">
                                  • {reportItem.selectedActivitiesCount} Aktivitas
                                </span>
                                {reportItem.errorMessage && (
                                  <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                    ({reportItem.errorMessage})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status Pill on the Right */}
                            <div className="flex items-center gap-2 shrink-0">
                              {isRepUploading && (
                                <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 animate-pulse text-[11px]">
                                  <SpinnerIcon className="h-3 w-3 animate-spin" />
                                  <span>Mengunggah...</span>
                                </span>
                              )}
                              {isRepSuccess && (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  Tersinkronisasi ✓
                                </span>
                              )}
                              {isRepError && (
                                <span className="font-bold text-red-600 dark:text-red-400 text-[11px]">
                                  Gagal ✕
                                </span>
                              )}
                              {reportItem.status === "pending" && (
                                <span className="text-[11px] text-[var(--text-muted)] italic">
                                  Menunggu...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer on Progress Page */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
            <button
              type="button"
              onClick={() => setViewMode("selection")}
              disabled={props.deviceBackupBulkUploading}
              className="btn-secondary h-[44px] px-5 text-xs font-bold rounded-xl disabled:opacity-40"
            >
              ← Kembali ke Pemilihan Data
            </button>

            {uploadResult && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("selection");
                    void loadFromDevice();
                  }}
                  className="btn-primary h-[44px] px-6 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Selesai &amp; Muat Ulang Data
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: SELECTION VIEW (FILTER & COMPACT SELECTION TREE)  */}
      {/* ========================================================= */}
      {viewMode === "selection" && (
        <>
          {/* Filter Toolbar & Quick Actions */}
          <div className="surface-card rounded-[24px] p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Cari Nama Petugas / Uraian
                </span>
                <input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Dari Tanggal
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Sampai Tanggal
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClassName}
                />
              </label>
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Aksi Seleksi Cepat
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    disabled={visibleReports.length === 0}
                    className="btn-secondary h-[44px] flex-1 px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={clearAllVisible}
                    disabled={selectedActivitiesCount === 0}
                    className="btn-secondary h-[44px] flex-1 px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    Lepas Semua
                  </button>
                </div>
              </div>
            </div>

            {/* Action Header & Upload Bar */}
            <div className="mt-2 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-4">
              <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1.5 rounded-xl font-bold border border-purple-500/20">
                  <span>Terpilih:</span>
                  <strong className="text-[var(--text-primary)]">
                    {selectedUsersCount}
                  </strong>
                  <span>Petugas |</span>
                  <strong className="text-[var(--text-primary)]">
                    {selectedReportsCount}
                  </strong>
                  <span>Laporan |</span>
                  <strong className="text-purple-600 dark:text-purple-300 font-extrabold text-sm">
                    {selectedActivitiesCount}
                  </strong>
                  <span>/ {totalVisibleActivities} Aktivitas</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
                  >
                    Buka Semua
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
                  >
                    Tutup Semua
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={
                    props.deviceBackupBulkUploading ||
                    selectedActivitiesCount === 0 ||
                    !props.onHandleBulkUploadDeviceBackup
                  }
                  className="btn-primary h-[46px] px-6 text-sm font-bold shadow-lg flex items-center gap-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-none w-full md:w-auto justify-center transition-all disabled:opacity-50 cursor-pointer"
                >
                  {props.deviceBackupBulkUploading ? (
                    <>
                      <SpinnerIcon className="h-5 w-5" />
                      <span>Mengunggah ke Database...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>
                        Upload ke Database ({selectedActivitiesCount} Aktivitas)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Result Banners */}
          {uploadResult && (
            <div
              className={`rounded-2xl p-4 sm:p-5 border space-y-2 animate-fadeIn ${
                uploadResult.uploadedReportsCount > 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span>{uploadResult.uploadedReportsCount > 0 ? "✓" : "✕"}</span>
                  <span>
                    {uploadResult.uploadedReportsCount > 0
                      ? `Sukses mengunggah ${uploadResult.uploadedReportsCount} laporan (${uploadResult.uploadedActivitiesCount} aktivitas) ke Supabase!`
                      : "Tidak ada laporan yang berhasil diunggah."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode("progress")}
                  className="text-xs font-bold underline cursor-pointer"
                >
                  Lihat Detail Progres
                </button>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="text-xs space-y-1 mt-1 font-mono text-red-600 dark:text-red-400">
                  {uploadResult.errors.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Compact Unified Selection Tree Container */}
          <div className="space-y-4">
            {groupedByUser.length === 0 ? (
              <div className="surface-card rounded-[24px] p-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-[var(--surface-muted)] mx-auto flex items-center justify-center text-[var(--text-muted)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Tidak Ada Data Laporan Cadangan yang Ditemukan
                </h4>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Belum ada data laporan tersimpan pada cache perangkat ini atau
                  file JSON yang sesuai dengan filter Anda.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] overflow-hidden shadow-2xs">
                {groupedByUser.map(([userName, userReports]) => {
                  const isUserExpanded = expandedUsers[userName] ?? true;
                  const userTotalActivities = userReports.reduce(
                    (sum, r) => sum + (r.activities?.length || 0),
                    0,
                  );
                  const userSelectedActivities = userReports.reduce((sum, r) => {
                    const sel = selectedActivities[r.id] || [];
                    return sum + sel.length;
                  }, 0);

                  const isUserFullyChecked =
                    userTotalActivities > 0 &&
                    userSelectedActivities === userTotalActivities;
                  const isUserPartiallyChecked =
                    userSelectedActivities > 0 && !isUserFullyChecked;

                  return (
                    <div key={userName} className="transition">
                      {/* Level 1: Compact User Row */}
                      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-muted)]/30 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isUserFullyChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = isUserPartiallyChecked;
                            }}
                            onChange={() => toggleUser(userReports)}
                            className="h-4 w-4 accent-purple-600 rounded cursor-pointer shrink-0"
                          />
                          <div
                            onClick={() => toggleExpandUser(userName)}
                            className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
                          >
                            <div className="h-7 w-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                              {userName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                                {userName}
                              </h4>
                              <span className="text-xs text-[var(--text-muted)] font-medium">
                                ({userReports.length} Tanggal • {userSelectedActivities}/{userTotalActivities} Aktivitas Terpilih)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleExpandUser(userName)}
                            className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-[var(--surface-muted)]"
                          >
                            <span>{isUserExpanded ? "Sembunyikan" : "Buka"}</span>
                            <svg
                              viewBox="0 0 24 24"
                              className={`h-3.5 w-3.5 transition-transform ${
                                isUserExpanded ? "rotate-180" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Level 2: Compact Reports List with Tree Guideline */}
                      {isUserExpanded && (
                        <div className="ml-3 sm:ml-4 pl-3.5 sm:pl-4 border-l-2 border-dashed border-purple-500/30 dark:border-purple-800/40 pr-3 sm:pr-4 pb-3 pt-1 space-y-2 bg-[var(--surface-muted)]/10">
                          {userReports.map((report) => {
                            const isReportExpanded =
                              expandedReports[report.id] ?? false;
                            const reportActivities = report.activities || [];
                            const reportSelectedNos =
                              selectedActivities[report.id] || [];
                            const isReportFullyChecked =
                              reportActivities.length > 0 &&
                              reportSelectedNos.length === reportActivities.length;
                            const isReportPartiallyChecked =
                              reportSelectedNos.length > 0 && !isReportFullyChecked;

                            return (
                              <div
                                key={report.id}
                                className="rounded-xl border border-[var(--border-soft)]/60 bg-[var(--surface-panel-strong)] p-2.5 sm:p-3 space-y-2"
                              >
                                {/* Report Date Header */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isReportFullyChecked}
                                      ref={(el) => {
                                        if (el)
                                          el.indeterminate = isReportPartiallyChecked;
                                      }}
                                      onChange={() => toggleReport(report)}
                                      className="h-3.5 w-3.5 accent-purple-600 rounded cursor-pointer shrink-0"
                                    />
                                    <div
                                      onClick={() => toggleExpandReport(report.id)}
                                      className="flex items-center gap-2 cursor-pointer select-none flex-wrap"
                                    >
                                      <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                                        {formatWitaDate(report.reportDate)}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                        Tim {report.tim || "TRC"}
                                      </span>
                                      <span className="text-[11px] text-[var(--text-muted)]">
                                        ({reportSelectedNos.length}/
                                        {reportActivities.length} aktivitas)
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => toggleExpandReport(report.id)}
                                    className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>
                                      {isReportExpanded ? "Tutup Rincian" : "Rincian Aktivitas"}
                                    </span>
                                    <svg
                                      viewBox="0 0 24 24"
                                      className={`h-3 w-3 transition-transform ${
                                        isReportExpanded ? "rotate-180" : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                  </button>
                                </div>

                                {/* Level 3: Compact Individual Activities List */}
                                {isReportExpanded && (
                                  <div className="pl-4 sm:pl-6 space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                                    {reportActivities.length === 0 ? (
                                      <p className="text-xs text-[var(--text-muted)] italic py-1">
                                        Tidak ada aktivitas tercatat pada laporan ini.
                                      </p>
                                    ) : (
                                      reportActivities.map((activity, actIdx) => {
                                        const isActChecked = reportSelectedNos.includes(
                                          activity.no,
                                        );
                                        const photosCount =
                                          activity.photos?.length || 0;

                                        return (
                                          <label
                                            key={activity.no ?? actIdx}
                                            className={`flex items-start gap-2.5 cursor-pointer select-none py-1.5 px-2.5 rounded-lg transition text-xs ${
                                              isActChecked
                                                ? "bg-purple-500/8 text-[var(--text-primary)] font-medium"
                                                : "opacity-60 hover:opacity-100"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isActChecked}
                                              onChange={() =>
                                                toggleActivity(report.id, activity.no)
                                              }
                                              className="mt-0.5 h-3.5 w-3.5 accent-purple-600 rounded cursor-pointer shrink-0"
                                            />
                                            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                              <span className="font-bold text-purple-600 dark:text-purple-400">
                                                #{activity.no ?? actIdx + 1}
                                              </span>
                                              <span className="text-[var(--text-muted)]">
                                                [{activity.startTime && activity.endTime ? `${activity.startTime}-${activity.endTime}` : "-"}]
                                              </span>
                                              <span className="text-[var(--text-primary)] truncate">
                                                {activity.description || "(Tanpa uraian)"}
                                              </span>
                                              {photosCount > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                  {photosCount} Foto
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AdminLoadingOverlay() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-20" />
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-contrast)] shadow-lg shadow-[var(--primary)]/30">
          <svg
            className="h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)]">
          Verifikasi Akses
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)] animate-pulse">
          Memuat kredensial admin...
        </p>
      </div>
    </div>
  );
}

function UserProfilePanel(props: {
  userSession: ReporterDirectoryProfile;
  userSubmitting: boolean;
  onUserUpdateProfile: (name: string, pass: string) => Promise<void>;
  onUserLogout: () => Promise<void>;
  reports?: Report[];
  bulkExporting?: boolean;
  onHandleBulkExport?: (reports: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupExcel?: (reports?: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupJson?: (
    reports?: Report[],
    userFilter?: string,
  ) => Promise<void>;
  deviceBackupExporting?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "sound" | "bulk-export">("profile");
  const [name, setName] = useState(props.userSession.fullName);
  const [pass, setPass] = useState(props.userSession.password || "123123123");
  const [showPass, setShowPass] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isUserSoundEnabled());

  // Bulk Export States for User's Own Reports
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const myReports = useMemo(() => {
    return (props.reports || []).filter((r) =>
      isSameReporterName(r.nama, props.userSession.fullName),
    );
  }, [props.reports, props.userSession.fullName]);

  const visibleReports = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return myReports
      .filter((report) => {
        if (
          search &&
          !report.nama.toLowerCase().includes(search) &&
          !report.activities.some((a) =>
            a.description.toLowerCase().includes(search),
          )
        ) {
          return false;
        }
        if (dateFrom && report.reportDate < dateFrom) {
          return false;
        }
        if (dateTo && report.reportDate > dateTo) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((left, right) => {
        const byDate = right.reportDate.localeCompare(left.reportDate);
        if (byDate !== 0) {
          return byDate;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [dateFrom, dateTo, keyword, myReports]);

  const selectedReports = useMemo(
    () => visibleReports.filter((report) => selectedIds.includes(report.id)),
    [selectedIds, visibleReports],
  );

  const groupedByDate = useMemo(
    () =>
      visibleReports.reduce<Record<string, Report[]>>((accumulator, report) => {
        const current = accumulator[report.reportDate] ?? [];
        current.push(report);
        accumulator[report.reportDate] = current;
        return accumulator;
      }, {}),
    [visibleReports],
  );

  function toggleSelect(reportId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(reportId)) {
          return current;
        }
        return [...current, reportId];
      }
      return current.filter((id) => id !== reportId);
    });
  }

  function selectAllVisible() {
    setSelectedIds(visibleReports.map((report) => report.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await props.onUserUpdateProfile(name, pass);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 animate-fadeIn">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-2xl bg-[var(--surface-muted)] p-1 border border-[var(--border-soft)] shadow-sm max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition ${
              activeTab === "profile"
                ? "bg-[var(--surface-panel-strong)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profil Akun
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sound")}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition ${
              activeTab === "sound"
                ? "bg-[var(--surface-panel-strong)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            Efek Suara
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bulk-export")}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition ${
              activeTab === "bulk-export"
                ? "bg-[var(--surface-panel-strong)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Unduh Massal Saya ({myReports.length})
          </button>
        </div>
      </div>

      {activeTab === "profile" ? (
        <div className="surface-card rounded-[28px] p-6 max-w-md mx-auto border border-[var(--border-soft)] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-lg">
                {props.userSession.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Pengaturan Profil</h3>
                <p className="text-xs text-[var(--text-muted)]">Perbarui nama dan password Anda</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Password Baru
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl pl-4 pr-11 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none transition cursor-pointer bg-transparent border-none p-1 flex items-center justify-center"
                  title={showPass ? "Sembunyikan sandi" : "Tampilkan sandi"}
                >
                  {showPass ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={props.userSubmitting}
                className="w-full py-3 px-4 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white font-semibold rounded-xl transition focus:outline-none flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {props.userSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Profil"
                )}
              </button>

              <button
                type="button"
                onClick={props.onUserLogout}
                className="w-full py-3 px-4 bg-[var(--danger-soft)] hover:bg-[var(--danger-soft)]/80 text-[var(--danger)] font-semibold rounded-xl transition focus:outline-none flex items-center justify-center gap-2 cursor-pointer"
              >
                Keluar Sesi
              </button>
            </div>
          </form>

          {/* Card Cadangan Perangkat Lokal untuk User */}
          <div className="mt-6 pt-5 border-t border-[var(--border-soft)] space-y-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Cadangan Perangkat Saya
              </h4>
              <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">
                Unduh salinan data laporan yang tersimpan di perangkat ini dalam format Excel atau JSON.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {props.onHandleDownloadDeviceBackupExcel && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupExcel &&
                    void props.onHandleDownloadDeviceBackupExcel(myReports)
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  <span>Excel (.xlsx)</span>
                </button>
              )}
              {props.onHandleDownloadDeviceBackupJson && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupJson &&
                    void props.onHandleDownloadDeviceBackupJson(myReports, props.userSession.fullName)
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span>JSON (.json)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "sound" ? (
        <div className="surface-card rounded-[28px] p-6 max-w-md mx-auto border border-[var(--border-soft)] shadow-sm space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-lg shrink-0">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Suara & Notifikasi</h3>
              <p className="text-xs text-[var(--text-muted)]">Pengaturan efek audio lokal perangkat</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-bold text-[var(--text-primary)] cursor-pointer" htmlFor="user-sound-toggle">
                  Efek Suara Notifikasi
                </label>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  Putar efek audio respons saat berhasil menyimpan laporan, terjadi kesalahan input, atau peringatan.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  id="user-sound-toggle"
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setSoundEnabled(val);
                    setUserSoundEnabled(val);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[var(--surface-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
              </label>
            </div>

            <div className="pt-2 border-t border-[var(--border-soft)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
              <span>Status saat ini:</span>
              <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${soundEnabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
                {soundEnabled ? "🔊 Suara Aktif" : "🔇 Suara Dibisukan"}
              </span>
            </div>
          </div>

          {/* Sound test buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Tes Efek Audio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => playSound("success", undefined, true)}
                className="btn-secondary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 hover:border-emerald-500/40"
              >
                <span>🎉</span>
                <span>Tes Sukses</span>
              </button>
              <button
                type="button"
                onClick={() => playSound("fail", undefined, true)}
                className="btn-secondary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 hover:border-red-500/40"
              >
                <span>⚠️</span>
                <span>Tes Gagal</span>
              </button>
            </div>
            <p className="text-[10.5px] text-[var(--text-muted)] italic text-center mt-2">
              * Pengaturan ini disimpan mandiri di browser perangkat ini dan tidak mengubah database atau pengguna lain.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Card Cadangan Perangkat User */}
          <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Cadangan Data Perangkat ({props.userSession.fullName})
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Excel &amp; JSON
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-2xl leading-relaxed">
                  Unduh seluruh riwayat dan cache laporan Anda di perangkat ini dalam format Excel (.xlsx) atau JSON (.json) lengkap.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto">
              {props.onHandleDownloadDeviceBackupExcel && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupExcel &&
                    void props.onHandleDownloadDeviceBackupExcel(myReports)
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary h-[42px] px-4 text-xs font-bold flex items-center gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 justify-center"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  <span>Download Excel (.xlsx)</span>
                </button>
              )}
              {props.onHandleDownloadDeviceBackupJson && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupJson &&
                    void props.onHandleDownloadDeviceBackupJson(myReports, props.userSession.fullName)
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary h-[42px] px-4 text-xs font-bold flex items-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 justify-center"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span>Download JSON (.json)</span>
                </button>
              )}
            </div>
          </div>

          <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border-soft)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Unduh Massal Laporan ({props.userSession.fullName})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Pilih rentang tanggal dan unduh laporan-laporan Anda ke file Excel atau JSON sekaligus
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                Total Tersedia: {myReports.length}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Dari Tanggal
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Sampai Tanggal
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Cari Deskripsi
                </span>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Kata kunci aktivitas..."
                  className={inputClassName}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  disabled={visibleReports.length === 0}
                  className="btn-secondary h-[40px] px-3.5 text-xs font-medium disabled:opacity-50"
                >
                  Pilih Semua ({visibleReports.length})
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedIds.length === 0}
                  className="btn-secondary h-[40px] px-3.5 text-xs font-medium disabled:opacity-50"
                >
                  Reset Pilihan
                </button>
                <span className="text-xs text-[var(--text-muted)] ml-2">
                  Terpilih:{" "}
                  <strong className="text-[var(--text-primary)]">
                    {selectedReports.length}
                  </strong>{" "}
                  dari {visibleReports.length} laporan
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {props.onHandleDownloadDeviceBackupExcel && (
                  <button
                    type="button"
                    onClick={() =>
                      props.onHandleDownloadDeviceBackupExcel &&
                      void props.onHandleDownloadDeviceBackupExcel(selectedReports)
                    }
                    disabled={props.deviceBackupExporting || selectedReports.length === 0}
                    className="btn-secondary h-[42px] px-3.5 text-xs font-semibold disabled:opacity-60 flex items-center gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    title="Unduh laporan terpilih dalam format Excel"
                  >
                    {props.deviceBackupExporting ? (
                      <SpinnerIcon />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    <span>Excel Terpilih</span>
                  </button>
                )}
                {props.onHandleDownloadDeviceBackupJson && (
                  <button
                    type="button"
                    onClick={() =>
                      props.onHandleDownloadDeviceBackupJson &&
                      void props.onHandleDownloadDeviceBackupJson(selectedReports, props.userSession.fullName)
                    }
                    disabled={props.deviceBackupExporting || selectedReports.length === 0}
                    className="btn-secondary h-[42px] px-3.5 text-xs font-semibold disabled:opacity-60 flex items-center gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    title="Unduh laporan terpilih dalam format JSON"
                  >
                    {props.deviceBackupExporting ? (
                      <SpinnerIcon />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    <span>JSON Terpilih</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => props.onHandleBulkExport && void props.onHandleBulkExport(selectedReports)}
                  disabled={Boolean(props.bulkExporting) || selectedReports.length === 0}
                  className="btn-primary h-[42px] px-5 text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {props.bulkExporting ? (
                    <>
                      <SpinnerIcon className="h-4 w-4" />
                      <span>Mengunduh...</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Unduh Terpilih ({selectedReports.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {Object.keys(groupedByDate).length === 0 ? (
            <div className="surface-card rounded-[24px] p-6 text-center text-sm text-[var(--text-muted)] border border-[var(--border-soft)]">
              {myReports.length === 0
                ? "Belum ada laporan atas nama Anda di sistem."
                : "Tidak ada laporan yang cocok dengan filter tanggal/pencarian."}
            </div>
          ) : null}

          {Object.entries(groupedByDate).map(([reportDate, reports]) => {
            const selectedInDate = reports.filter((report) =>
              selectedIds.includes(report.id),
            ).length;
            const allChecked =
              reports.length > 0 && selectedInDate === reports.length;

            return (
              <div
                key={reportDate}
                className="surface-card rounded-[24px] p-4 sm:p-5 border border-[var(--border-soft)] shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      {formatWitaDate(reportDate)}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedInDate}/{reports.length} terpilih
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (allChecked) {
                        setSelectedIds((current) =>
                          current.filter(
                            (id) => !reports.some((report) => report.id === id),
                          ),
                        );
                        return;
                      }
                      setSelectedIds((current) => {
                        const next = [...current];
                        reports.forEach((report) => {
                          if (!next.includes(report.id)) {
                            next.push(report.id);
                          }
                        });
                        return next;
                      });
                    }}
                    className="btn-secondary h-[36px] px-3.5 text-xs"
                  >
                    {allChecked ? "Lepas tanggal ini" : "Pilih tanggal ini"}
                  </button>
                </div>

                <div className="grid gap-2">
                  {reports.map((report) => (
                    <label
                      key={report.id}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-3 transition hover:border-[var(--primary)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(report.id)}
                        onChange={(event) =>
                          toggleSelect(report.id, event.target.checked)
                        }
                        className="mt-1 h-4 w-4 accent-purple-600 rounded cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {report.nama} {report.tim ? `• Tim ${report.tim}` : ""}
                          </p>
                          <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                            {report.activities.length} aktivitas
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">
                          {report.activities.map((a) => a.description).join(" • ") ||
                            "Tidak ada rincian aktivitas."}
                        </p>
                        <p className="mt-1.5 text-[11px] text-[var(--text-muted)] opacity-80">
                          Diperbarui {formatWitaDateTime(report.updatedAt)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminDashboardView(props: AdminDashboardViewProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(
        "silahar:admin-active-section",
      );
      if (
        stored === "rules" ||
        stored === "reporters" ||
        stored === "templates" ||
        stored === "bulk-export" ||
        stored === "bulk-upload" ||
        stored === "sounds"
      ) {
        return stored as AdminSection;
      }
    }
    return "rules";
  });
  const [reporterSearch, setReporterSearch] = useState("");
  const [reporterSortMode, setReporterSortMode] =
    useState<ReporterSortMode>("name-asc");

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "silahar:admin-active-section",
        activeSection,
      );
    }
  }, [activeSection]);

  return (
    <section className="panel-glass rounded-[32px] p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            {props.userSession ? "Pengaturan Akun & Rekap" : "Panel Admin"}
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold text-[var(--text-primary)]">
            {props.userSession ? "Profil & Unduh Laporan" : "Pengaturan sistem"}
          </h2>
        </div>

        {props.adminSession ? (
          <AdminSessionCard
            adminSession={props.adminSession}
            adminSubmitting={props.adminSubmitting}
            adminActiveAction={props.adminActiveAction}
            onHandleAdminLogout={props.onHandleAdminLogout}
          />
        ) : null}
      </div>

      {props.adminAuthLoading ? (
        <AdminLoadingOverlay />
      ) : props.userSession ? (
        <UserProfilePanel
          userSession={props.userSession}
          userSubmitting={props.userSubmitting || false}
          onUserUpdateProfile={props.onUserUpdateProfile || (async () => {})}
          onUserLogout={props.onUserLogout || (async () => {})}
          reports={props.reports}
          bulkExporting={props.bulkExporting}
          onHandleBulkExport={props.onHandleBulkExport}
          onHandleDownloadDeviceBackupExcel={
            props.onHandleDownloadDeviceBackupExcel
          }
          onHandleDownloadDeviceBackupJson={
            props.onHandleDownloadDeviceBackupJson
          }
          deviceBackupExporting={props.deviceBackupExporting}
        />
      ) : (

        <>
          {!props.adminSession ? <AdminLoginCard {...props} /> : null}

          {props.adminSession ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex min-w-0 shrink basis-auto items-center">
                  <AdminSectionTabs
                    activeSection={activeSection}
                    onChange={setActiveSection}
                  />
                </div>

                {activeSection === "reporters" ? (
                  <div className="flex-1 shrink-0 md:min-w-[320px]">
                    <AdminReporterToolbar
                      searchValue={reporterSearch}
                      onSearchChange={setReporterSearch}
                      sortMode={reporterSortMode}
                      onSortModeChange={setReporterSortMode}
                      disabled={props.adminSubmitting}
                    />
                  </div>
                ) : null}
              </div>

              {activeSection === "rules" ? (
                <ReportRulesPanel
                  {...props}
                  onNavigateBulkUpload={() => setActiveSection("bulk-upload")}
                />
              ) : null}
              {activeSection === "reporters" ? (
                <ReporterManagementPanel
                  {...props}
                  reporterSearch={reporterSearch}
                  reporterSortMode={reporterSortMode}
                  onReporterSearchChange={setReporterSearch}
                  onReporterSortModeChange={setReporterSortMode}
                />
              ) : null}
              {activeSection === "templates" ? (
                <ExcelTemplatePanel {...props} />
              ) : null}
              {activeSection === "bulk-export" ? (
                <BulkExportPanel
                  reports={props.reports}
                  bulkExporting={props.bulkExporting}
                  onHandleBulkExport={props.onHandleBulkExport}
                  onHandleDownloadDeviceBackupExcel={
                    props.onHandleDownloadDeviceBackupExcel
                  }
                  onHandleDownloadDeviceBackupJson={
                    props.onHandleDownloadDeviceBackupJson
                  }
                  deviceBackupExporting={props.deviceBackupExporting}
                />
              ) : null}
              {activeSection === "bulk-upload" ? (
                <BulkUploadPanel
                  reports={props.reports}
                  onHandleBulkUploadDeviceBackup={
                    props.onHandleBulkUploadDeviceBackup
                  }
                  deviceBackupBulkUploading={props.deviceBackupBulkUploading}
                />
              ) : null}
              {activeSection === "sounds" ? (
                <SoundSettingsPanel
                  notificationSettings={props.notificationSettings}
                  adminSubmitting={props.adminSubmitting}
                  adminActiveAction={props.adminActiveAction}
                  onChangeNotificationSettings={
                    props.onChangeNotificationSettings
                  }
                  onHandleSaveNotificationSettings={
                    props.onHandleSaveNotificationSettings
                  }
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
