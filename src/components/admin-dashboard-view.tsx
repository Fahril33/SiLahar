import { useState, useEffect, useMemo } from "react";
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

type AdminSection = "rules" | "reporters" | "templates" | "bulk-export" | "sounds";

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

function ReportRulesPanel(props: AdminDashboardViewProps) {
  return (
    <div className="grid gap-4">
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
}) {
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">
            Terfilter: {visibleReports.length} laporan | Terpilih:{" "}
            {selectedReports.length} laporan
          </p>
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
          <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border-soft)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Unduh Massal Laporan ({props.userSession.fullName})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Pilih rentang tanggal dan unduh laporan-laporan Anda ke file Excel sekaligus
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
                <ReportRulesPanel {...props} />
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
