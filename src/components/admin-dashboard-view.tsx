import { useState } from "react";
import type { ReportRules } from "../config/report-rules";
import { formatWitaDateTime } from "../lib/time";
import type { AdminSessionState } from "../types/admin";
import type {
  ExcelReportTemplate,
  ExcelTemplateUploadDraft,
} from "../types/excel-template";
import type { ReporterDirectoryProfile } from "../types/report";
import { AdminEditableListCard } from "./admin-editable-list-card";

const inputClassName = "field-input";

type AdminSection = "rules" | "reporters" | "templates";

type AdminDashboardViewProps = {
  adminSession: AdminSessionState | null;
  adminEmail: string;
  setAdminEmail: (value: string) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  adminAuthLoading: boolean;
  adminSubmitting: boolean;
  adminRuleDraft: ReportRules;
  excelTemplates: ExcelReportTemplate[];
  activeExcelTemplate: ExcelReportTemplate | null;
  excelTemplateDraft: ExcelTemplateUploadDraft;
  adminExcelTemplateDrafts: Record<string, ExcelTemplateUploadDraft>;
  selectedExcelTemplateFileName: string;
  excelTemplateUploading: boolean;
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
    <div className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-1">
      {[
        { key: "rules" as const, label: "Aturan laporan" },
        { key: "reporters" as const, label: "Kelola pengguna" },
        { key: "templates" as const, label: "Template Excel" },
      ].map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onChange(section.key)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
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

function ReporterManagementPanel(props: AdminDashboardViewProps) {
  const [editingReporterId, setEditingReporterId] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {props.reporterProfiles.length === 0 ? (
        <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)]">
          Belum ada pengguna publik yang tercatat.
        </div>
      ) : null}

      {props.reporterProfiles.map((reporter) => {
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
                <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">
                  {reporter.fullName}
                </h3>
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

          <label className="space-y-2">
            <span className="text-sm font-medium">Pilih file .xlsx</span>
            <input
              key={props.selectedExcelTemplateFileName || "empty-template-file"}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={props.excelTemplateUploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                props.onSelectExcelTemplateFile(file);
              }}
              className={inputClassName}
            />
          </label>

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
            />
          );
        })}
      </div>
    </div>
  );
}

export function AdminDashboardView(props: AdminDashboardViewProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>("rules");

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
          <AdminSectionTabs
            activeSection={activeSection}
            onChange={setActiveSection}
          />

          {activeSection === "rules" ? <ReportRulesPanel {...props} /> : null}
          {activeSection === "reporters" ? (
            <ReporterManagementPanel {...props} />
          ) : null}
          {activeSection === "templates" ? (
            <ExcelTemplatePanel {...props} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
