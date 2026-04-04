import { useState, useEffect } from "react";
import type { ReportRules } from "../config/report-rules";
import { formatWitaDateTime } from "../lib/time";
import type { AdminSessionState } from "../types/admin";
import type {
  ExcelReportTemplate,
  ExcelTemplateUploadDraft,
} from "../types/excel-template";
import type { Report, ReporterDirectoryProfile } from "../types/report";
import { AdminEditableListCard } from "./admin-editable-list-card";
import { AdminReporterStatsView } from "./admin-reporter-stats-view";
import {
  AdminReporterToolbar,
  type ReporterSortMode,
} from "./admin-reporter-toolbar";
import { FileUploadInput } from "./file-upload-input";
import {
  loadSoundSettings,
  saveSoundSettings,
  SUCCESS_SOUNDS,
  FAIL_SOUNDS,
  playSound,
  type AppSoundSettings,
  type SoundMode,
} from "../lib/sound-utils";

const inputClassName = "field-input";

type AdminSection = "rules" | "reporters" | "templates" | "sounds";

type AdminDashboardViewProps = {
  adminSession: AdminSessionState | null;
  adminEmail: string;
  setAdminEmail: (value: string) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  adminAuthLoading: boolean;
  loading: boolean;
  adminSubmitting: boolean;
  adminRuleDraft: ReportRules;
  excelTemplates: ExcelReportTemplate[];
  activeExcelTemplate: ExcelReportTemplate | null;
  excelTemplateDraft: ExcelTemplateUploadDraft;
  adminExcelTemplateDrafts: Record<string, ExcelTemplateUploadDraft>;
  selectedExcelTemplateFileName: string;
  excelTemplateUploading: boolean;
  reports: Report[];
  reporterProfiles: ReporterDirectoryProfile[];
  adminReporterDraftNames: Record<string, string>;
  onChangeAdminRule: <K extends keyof ReportRules>(
    key: K,
    value: ReportRules[K],
  ) => void;
  onChangeAdminReporterDraftName: (reporterId: string, value: string) => void;
  onHandleAdminLogin: () => Promise<void>;
  onHandleAdminLogout: () => Promise<void>;
  onHandleSaveAdminRules: () => Promise<void>;
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
  ) => Promise<void>;
  onHandleDeleteReporterTrace: (
    reporter: ReporterDirectoryProfile,
  ) => Promise<void>;
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
  onChange?: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{props.label}</span>
      <div className="relative">
        <input
          value={props.value}
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
        className="btn-secondary ml-auto px-4 py-2 text-xs disabled:opacity-60"
      >
        {props.adminSubmitting ? "Memproses..." : "Logout"}
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
          {props.adminAuthLoading || props.adminSubmitting
            ? "Memproses login..."
            : "Login admin"}
        </button>
      </div>
    </div>
  );
}

function ReportRulesPanel(props: AdminDashboardViewProps) {
  return (
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

        <button
          type="button"
          onClick={() => void props.onHandleSaveAdminRules()}
          disabled={props.adminSubmitting}
          className="btn-primary w-full justify-center disabled:opacity-60"
        >
          {props.adminSubmitting ? "Menyimpan rules..." : "Simpan rules"}
        </button>
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
  const [editingReporterId, setEditingReporterId] = useState<string | null>(null);
  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(
    null,
  );

  const selectedReporter =
    props.reporterProfiles.find((reporter) => reporter.id === selectedReporterId) ??
    null;

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
                  <span>Awal: {formatWitaDateTime(reporter.firstReportedAt)}</span>
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
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-4 py-3 text-xs text-[var(--text-muted)]">
                  <p>Data relasional laporan ikut memakai nama terbaru saat disimpan.</p>
                </div>
              </div>
            }
            disableActions={props.adminSubmitting}
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
                .onHandleRenameReporterProfile(reporter)
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
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

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
            className="btn-primary h-[52px] justify-center px-5 py-2 text-sm disabled:opacity-60"
          >
            {props.excelTemplateUploading ? "Mengupload..." : "Upload template"}
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
          <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)]">
            Belum ada template Excel yang diupload.
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
                  <p className="mt-1">Update: {formatWitaDateTime(template.updatedAt)}</p>
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
                  : () =>
                      void props.onHandleActivateExcelTemplate(template.id)
              }
              primaryActionLabel={template.isActive ? "Sedang aktif" : "Jadikan utama"}
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

function SoundSettingsPanel() {
  const [settings, setSettings] = useState<AppSoundSettings>(() => loadSoundSettings());

  const handleUpdate = (type: "success" | "fail", key: "mode" | "specificFile", value: any) => {
    const next = {
      ...settings,
      [type]: {
        ...settings[type],
        [key]: value,
      },
    };
    setSettings(next);
    saveSoundSettings(next);
  };

  const renderSection = (type: "success" | "fail", title: string, list: Record<string, string>) => {
    const config = settings[type];
    return (
      <div className="surface-card rounded-[24px] p-5">
        <h4 className="text-base font-semibold text-[var(--text-primary)] mb-4">{title}</h4>
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--text-muted)]">Mode Putar</span>
            <select
              className={inputClassName}
              value={config.mode}
              onChange={(e) => handleUpdate(type, "mode", e.target.value as SoundMode)}
            >
              <option value="random">Acak (Random Pick)</option>
              <option value="specific">Pilih Spesifik</option>
            </select>
          </label>

          {config.mode === "specific" && (
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-muted)]">File Suara</span>
              <select
                className={inputClassName}
                value={config.specificFile || ""}
                onChange={(e) => handleUpdate(type, "specificFile", e.target.value)}
              >
                <option value="" disabled>Pilih suara...</option>
                {Object.keys(list).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => playSound(type, settings)}
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
      {renderSection("success", "Suara Berhasil (Success)", SUCCESS_SOUNDS)}
      {renderSection("fail", "Suara Gagal (Error)", FAIL_SOUNDS)}
      <div className="md:col-span-2 surface-card rounded-[24px] p-4 bg-[var(--surface-muted)]/30 border border-dashed border-[var(--border-soft)] text-xs text-[var(--text-muted)]">
        <p>💡 Fitur iseng: Suara hanya tersimpan di browser ini saja (Local Storage). Admin lain mungkin punya selera audio yang berbeda!</p>
      </div>
    </div>
  );
}

export function AdminDashboardView(props: AdminDashboardViewProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("silahar:admin-active-section");
      if (stored === "rules" || stored === "reporters" || stored === "templates") {
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
      window.localStorage.setItem("silahar:admin-active-section", activeSection);
    }
  }, [activeSection]);

  return (
    <section className="panel-glass rounded-[32px] p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Panel Admin
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold text-[var(--text-primary)]">
            Pengaturan sistem
          </h2>
        </div>

        {props.adminSession ? (
          <AdminSessionCard
            adminSession={props.adminSession}
            adminSubmitting={props.adminSubmitting}
            onHandleAdminLogout={props.onHandleAdminLogout}
          />
        ) : null}
      </div>

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

          {activeSection === "rules" ? <ReportRulesPanel {...props} /> : null}
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
          {activeSection === "sounds" ? <SoundSettingsPanel /> : null}
        </div>
      ) : null}
    </section>
  );
}
