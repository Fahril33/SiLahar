import { useEffect, useRef, useState } from "react";
import {
  showError,
  showSuccess
} from "../../lib/alerts";
import {
  fetchTeamTypes,
  saveTeamType,
  uploadOfficialSignature
} from "../../lib/report-template-service";
import { formatWitaDateTime } from "../../lib/time";
import type { TeamType } from "../../types/team-type";
import { AdminEditableListCard } from "../admin-editable-list-card";
import { FileUploadInput } from "../file-upload-input";

import { ClearableTextInput, SpinnerIcon } from "./shared";
import type { AdminDashboardViewProps } from "./types";

function OfficialSignatureCard(props: {
  title: string;
  subtitle?: string;
  officialName: string;
  officialNip?: string;
  signatureUrl?: string;
  uploading: boolean;
  onUploadSignature: (file: File) => Promise<void>;
  onRemoveSignature: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await props.onUploadSignature(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="surface-card rounded-[24px] p-5 space-y-4 flex flex-col justify-between border border-[var(--border-soft)] shadow-sm hover:shadow-md transition">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--primary)] uppercase">
            {props.title}
          </span>
          {props.signatureUrl ? (
            <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--success)]">
              TTD Terpasang
            </span>
          ) : (
            <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">
              Belum Ada TTD
            </span>
          )}
        </div>

        {props.subtitle && (
          <p className="text-xs text-[var(--text-muted)] font-medium mb-1.5">
            {props.subtitle}
          </p>
        )}

        <div className="space-y-1 mb-4 bg-[var(--surface-panel-strong)] p-3 rounded-xl border border-[var(--border-soft)]">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Pejabat
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">
            {props.officialName || "Belum diatur"}
          </p>
          {props.officialNip && (
            <p className="text-xs text-[var(--text-muted)] font-mono">
              NIP. {props.officialNip}
            </p>
          )}
        </div>

        <div className="relative flex min-h-[120px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 transition hover:border-[var(--primary)]">
          {props.signatureUrl ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <img
                src={props.signatureUrl}
                alt={`Tanda tangan ${props.officialName}`}
                className="max-h-24 max-w-full object-contain filter drop-shadow-sm"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center text-[var(--text-muted)] p-2">
              <svg
                className="w-8 h-8 opacity-40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              <span className="text-xs font-medium">
                Unggah berkas tanda tangan (.png, .jpg, .webp)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-soft)]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
        <button
          type="button"
          disabled={props.uploading}
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary text-xs py-2.5 px-3 flex-1 justify-center disabled:opacity-60"
        >
          {props.uploading ? (
            <SpinnerIcon />
          ) : props.signatureUrl ? (
            "Ganti TTD"
          ) : (
            "Upload TTD"
          )}
        </button>

        {props.signatureUrl && (
          <button
            type="button"
            disabled={props.uploading}
            onClick={() => void props.onRemoveSignature()}
            className="btn-secondary text-xs py-2.5 px-3 text-red-500 hover:text-red-600 disabled:opacity-60"
            title="Hapus gambar TTD"
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}

export function DocumentTemplatePanel(props: AdminDashboardViewProps & { section: "signatures" | "excel"; }) {
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [teamTypes, setTeamTypes] = useState<TeamType[]>([]);
  const [uploadingSignatureId, setUploadingSignatureId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let alive = true;
    void fetchTeamTypes().then((types) => {
      if (alive) {
        setTeamTypes(types);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleUploadTeamSignature = async (team: TeamType, file: File) => {
    setUploadingSignatureId(team.id);
    try {
      const url = await uploadOfficialSignature(file);
      const updatedTypes = await saveTeamType({
        id: team.id,
        code: team.code,
        name: team.name,
        description: team.description,
        headerLines: team.headerLines,
        coordinatorName: team.coordinatorName,
        coordinatorNip: team.coordinatorNip,
        coordinatorLabel: team.coordinatorLabel,
        signatureUrl: url,
        isDefault: team.isDefault,
      });
      setTeamTypes(updatedTypes);

      const codeLower = team.code.toLowerCase();
      if (codeLower === "trc" || codeLower === "pusdalops") {
        const role = `coordinator_team_${codeLower}` as const;
        props.onChangeAdminTemplateApproverDraft(role, "signatureUrl", url);
        const updatedDrafts = {
          ...props.adminTemplateApproverDrafts,
          [role]: {
            ...props.adminTemplateApproverDrafts[role],
            signatureUrl: url,
          },
        };
        if (props.activeReportTemplateConfig) {
          await props.onHandleSaveTemplateApproverDefaults(updatedDrafts);
        }
      }
      await showSuccess(
        "TTD Diperbarui",
        `Tanda tangan untuk ${team.name} berhasil diunggah.`,
      );
    } catch (err: any) {
      await showError(
        "Gagal Unggah TTD",
        err.message || "Terjadi kesalahan saat unggah TTD.",
      );
    } finally {
      setUploadingSignatureId(null);
    }
  };

  const handleRemoveTeamSignature = async (team: TeamType) => {
    setUploadingSignatureId(team.id);
    try {
      const updatedTypes = await saveTeamType({
        id: team.id,
        code: team.code,
        name: team.name,
        description: team.description,
        headerLines: team.headerLines,
        coordinatorName: team.coordinatorName,
        coordinatorNip: team.coordinatorNip,
        coordinatorLabel: team.coordinatorLabel,
        signatureUrl: "",
        isDefault: team.isDefault,
      });
      setTeamTypes(updatedTypes);

      const codeLower = team.code.toLowerCase();
      if (codeLower === "trc" || codeLower === "pusdalops") {
        const role = `coordinator_team_${codeLower}` as const;
        props.onChangeAdminTemplateApproverDraft(role, "signatureUrl", "");
        const updatedDrafts = {
          ...props.adminTemplateApproverDrafts,
          [role]: {
            ...props.adminTemplateApproverDrafts[role],
            signatureUrl: "",
          },
        };
        if (props.activeReportTemplateConfig) {
          await props.onHandleSaveTemplateApproverDefaults(updatedDrafts);
        }
      }
      await showSuccess(
        "TTD Dihapus",
        `Tanda tangan untuk ${team.name} berhasil dihapus.`,
      );
    } catch (err: any) {
      await showError(
        "Gagal Hapus TTD",
        err.message || "Terjadi kesalahan saat menghapus TTD.",
      );
    } finally {
      setUploadingSignatureId(null);
    }
  };

  const handleUploadDivisionHeadSignature = async (file: File) => {
    setUploadingSignatureId("division_head");
    try {
      const url = await uploadOfficialSignature(file);
      props.onChangeAdminTemplateApproverDraft(
        "division_head",
        "signatureUrl",
        url,
      );
      const updatedDrafts = {
        ...props.adminTemplateApproverDrafts,
        division_head: {
          ...props.adminTemplateApproverDrafts.division_head,
          signatureUrl: url,
        },
      };
      if (props.activeReportTemplateConfig) {
        await props.onHandleSaveTemplateApproverDefaults(updatedDrafts);
      }
      await showSuccess(
        "TTD Diperbarui",
        "Tanda tangan Kepala Bidang berhasil diunggah.",
      );
    } catch (err: any) {
      await showError(
        "Gagal Unggah TTD",
        err.message || "Terjadi kesalahan saat unggah TTD.",
      );
    } finally {
      setUploadingSignatureId(null);
    }
  };

  const handleRemoveDivisionHeadSignature = async () => {
    setUploadingSignatureId("division_head");
    try {
      props.onChangeAdminTemplateApproverDraft(
        "division_head",
        "signatureUrl",
        "",
      );
      const updatedDrafts = {
        ...props.adminTemplateApproverDrafts,
        division_head: {
          ...props.adminTemplateApproverDrafts.division_head,
          signatureUrl: "",
        },
      };
      if (props.activeReportTemplateConfig) {
        await props.onHandleSaveTemplateApproverDefaults(updatedDrafts);
      }
      await showSuccess(
        "TTD Dihapus",
        "Tanda tangan Kepala Bidang berhasil dihapus.",
      );
    } catch (err: any) {
      await showError(
        "Gagal Hapus TTD",
        err.message || "Terjadi kesalahan saat menghapus TTD.",
      );
    } finally {
      setUploadingSignatureId(null);
    }
  };

  const divisionHeadDraft = props.adminTemplateApproverDrafts.division_head;

  return (
    <div className="space-y-5">
      {props.section === "signatures" ? (
        <div className="space-y-4">
          <div className="surface-card rounded-[24px] p-5">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Tanda tangan pejabat
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Upload gambar TTD transparan (.png/.jpg) untuk masing-masing
              pejabat. TTD ini akan otomatis ditempelkan di posisi semestinya
              pada dokumen cetak PDF dan ekspor Excel.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {teamTypes.map((team) => {
              const codeLower = team.code.toLowerCase();
              const approverDraft =
                codeLower === "trc"
                  ? props.adminTemplateApproverDrafts.coordinator_team_trc
                  : codeLower === "pusdalops"
                    ? props.adminTemplateApproverDrafts
                      .coordinator_team_pusdalops
                    : null;

              const effectiveName =
                team.coordinatorName || approverDraft?.officialName || "";
              const effectiveNip =
                team.coordinatorNip || approverDraft?.officialNip || "";
              const effectiveSignatureUrl =
                team.signatureUrl || approverDraft?.signatureUrl || "";

              return (
                <OfficialSignatureCard
                  key={team.id}
                  title={
                    team.coordinatorLabel || `Koordinator Tim ${team.name}`
                  }
                  subtitle={`Tim: ${team.name} (${team.code.toUpperCase()})`}
                  officialName={effectiveName}
                  officialNip={effectiveNip}
                  signatureUrl={effectiveSignatureUrl}
                  uploading={uploadingSignatureId === team.id}
                  onUploadSignature={(file) =>
                    handleUploadTeamSignature(team, file)
                  }
                  onRemoveSignature={() => handleRemoveTeamSignature(team)}
                />
              );
            })}

            <OfficialSignatureCard
              title={divisionHeadDraft.scopeLabel || "Kepala Bidang (Kabid)"}
              subtitle="Pejabat Mengetahui / Menyetujui"
              officialName={divisionHeadDraft.officialName}
              officialNip={divisionHeadDraft.officialNip}
              signatureUrl={divisionHeadDraft.signatureUrl}
              uploading={uploadingSignatureId === "division_head"}
              onUploadSignature={handleUploadDivisionHeadSignature}
              onRemoveSignature={handleRemoveDivisionHeadSignature}
            />
          </div>
        </div>
      ) : null}

      {props.section === "excel" ? (
        <div className="space-y-4">
          <div className="surface-card rounded-[24px] p-4 sm:p-5">
            <div className="grid items-end gap-3 sm:grid-cols-2">
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
                {props.excelTemplateUploading ? (
                  <SpinnerIcon />
                ) : (
                  "Upload template"
                )}
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
                  <strong className="text-[var(--text-primary)]">
                    Template Bawaan Sistem (Lokal)
                  </strong>{" "}
                  untuk seluruh kebutuhan ekspor Excel. Anda dapat mengunggah
                  file template{" "}
                  <code className="text-xs bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">
                    .xlsx
                  </code>{" "}
                  baru di atas kapan saja untuk menggantikannya secara dinamis.
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
                      : () =>
                        void props.onHandleActivateExcelTemplate(template.id)
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
      ) : null}
    </div>
  );
}

