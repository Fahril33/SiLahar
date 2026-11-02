import { useEffect, useState } from "react";
import {
  askConfirmation,
  showError,
  showSuccess
} from "../../lib/alerts";
import {
  deleteTeamType,
  fetchTeamTypes,
  saveTeamType,
  saveTeamTypeHeaderLines
} from "../../lib/report-template-service";
import type { TeamType, TeamTypeDraft } from "../../types/team-type";
import { DEFAULT_HEADER_LINES } from "../../types/team-type";

import { SpinnerIcon } from "./shared";
import type { AdminDashboardViewProps } from "./types";
import { SettingsCard } from "./settings-ui";
import { TeamEditorDialog } from "./team-editor-dialog";
const inputClassName = "field-input";

export function TeamSettingsPanel(
  props: AdminDashboardViewProps & {
    section: "header" | "teams";
    onDirtyChange: (dirty: boolean) => void;
  },
) {
  const [teamTypes, setTeamTypes] = useState<TeamType[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    "team-type-trc-default",
  );
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [savingTeamType, setSavingTeamType] = useState(false);

  const [teamDraft, setTeamDraft] = useState<TeamTypeDraft>({
    code: "",
    name: "",
    description: "",
    coordinatorName: "",
    coordinatorNip: "",
    coordinatorLabel: "",
    headerLines: [
      "LAPORAN HARIAN KINERJA TIM BARU",
      "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
      "TAHUN ANGGARAN 2026",
    ],
  });

  const [perTeamHeaders, setPerTeamHeaders] = useState<
    Record<string, string[]>
  >({});

  const hasUnsavedHeaders = teamTypes.some((team) => {
    const draft = perTeamHeaders[team.id];
    const saved = team.headerLines.length ? team.headerLines : DEFAULT_HEADER_LINES;
    return draft && JSON.stringify(draft) !== JSON.stringify(saved);
  });
  const { onDirtyChange } = props;

  useEffect(() => {
    onDirtyChange(hasUnsavedHeaders);
    if (!hasUnsavedHeaders) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedHeaders, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    let alive = true;
    void fetchTeamTypes().then((types) => {
      if (alive) {
        setTeamTypes(types);
        if (types.length > 0) {
          const defaultTeam = types.find((t) => t.isDefault) || types[0];
          setSelectedTeamId(defaultTeam.id);
          const initialMap: Record<string, string[]> = {};
          types.forEach((t) => {
            initialMap[t.id] =
              t.headerLines && t.headerLines.length > 0
                ? t.headerLines
                : DEFAULT_HEADER_LINES;
          });
          setPerTeamHeaders(initialMap);
        }
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const openCreateTeamModal = () => {
    setEditingTeamId(null);
    setTeamDraft({
      code: "",
      name: "",
      description: "",
      coordinatorName: "",
      coordinatorNip: "",
      coordinatorLabel: "",
      headerLines: [
        "LAPORAN HARIAN KINERJA TIM BARU",
        "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
        "TAHUN ANGGARAN 2026",
      ],
    });
    setShowAddTeamModal(true);
  };

  const openEditTeamModal = (team: TeamType) => {
    setEditingTeamId(team.id);
    setTeamDraft({
      id: team.id,
      code: team.code,
      name: team.name,
      description: team.description || "",
      coordinatorName: team.coordinatorName || "",
      coordinatorNip: team.coordinatorNip || "",
      coordinatorLabel: team.coordinatorLabel || "",
      signatureUrl: team.signatureUrl || "",
      headerLines:
        team.headerLines && team.headerLines.length > 0
          ? team.headerLines
          : DEFAULT_HEADER_LINES,
      isDefault: team.isDefault,
    });
    setShowAddTeamModal(true);
  };

  const selectedTeam =
    teamTypes.find((t) => t.id === selectedTeamId) || teamTypes[0];

  const currentHeaderLines =
    (selectedTeam && perTeamHeaders[selectedTeam.id]) ||
    props.adminHeaderLinesDraft ||
    DEFAULT_HEADER_LINES;

  const handleHeaderLineChange = (index: number, value: string) => {
    if (!selectedTeam) return;
    const next = [...currentHeaderLines];
    next[index] = value;
    setPerTeamHeaders((prev) => ({ ...prev, [selectedTeam.id]: next }));
    props.setAdminHeaderLinesDraft(next);
  };

  const handleAddHeaderLine = () => {
    if (!selectedTeam) return;
    const next = [...currentHeaderLines, ""];
    setPerTeamHeaders((prev) => ({ ...prev, [selectedTeam.id]: next }));
    props.setAdminHeaderLinesDraft(next);
  };

  const handleRemoveHeaderLine = (index: number) => {
    if (!selectedTeam || currentHeaderLines.length <= 1) return;
    const next = currentHeaderLines.filter((_, i) => i !== index);
    setPerTeamHeaders((prev) => ({ ...prev, [selectedTeam.id]: next }));
    props.setAdminHeaderLinesDraft(next);
  };

  const handleMoveHeaderLine = (index: number, direction: "up" | "down") => {
    if (!selectedTeam) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentHeaderLines.length) return;
    const next = [...currentHeaderLines];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setPerTeamHeaders((prev) => ({ ...prev, [selectedTeam.id]: next }));
    props.setAdminHeaderLinesDraft(next);
  };

  const handleResetHeaderLines = () => {
    if (!selectedTeam) return;
    const defaultHeaders = [
      `LAPORAN HARIAN KINERJA ${selectedTeam.name.toUpperCase()}`,
      "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
      "TAHUN ANGGARAN 2026",
    ];
    setPerTeamHeaders((prev) => ({
      ...prev,
      [selectedTeam.id]: defaultHeaders,
    }));
    props.setAdminHeaderLinesDraft(defaultHeaders);
  };

  const handleSaveCurrentTeamHeader = async () => {
    if (!selectedTeam) return;
    try {
      setSavingTeamType(true);
      const updatedTypes = await saveTeamTypeHeaderLines(
        selectedTeam.id,
        currentHeaderLines,
      );
      setTeamTypes(updatedTypes);
      if (props.activeReportTemplateConfig) {
        await props.onHandleSaveHeaderLines(currentHeaderLines);
      } else {
        await showSuccess(
          "Kop Laporan Disimpan",
          `Kop Laporan untuk ${selectedTeam.name} berhasil diperbarui.`,
        );
      }
    } catch (err: any) {
      await showError(
        "Simpan Gagal",
        err.message || "Gagal menyimpan Kop Laporan.",
      );
    } finally {
      setSavingTeamType(false);
    }
  };

  const handleSaveTeamType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamDraft.name.trim() || !teamDraft.code.trim()) {
      await showError(
        "Data Tidak Lengkap",
        "Nama dan Kode jenis tim wajib diisi.",
      );
      return;
    }
    const isEdit = Boolean(editingTeamId);
    try {
      setSavingTeamType(true);
      const updatedTypes = await saveTeamType(teamDraft);
      setTeamTypes(updatedTypes);

      const nextHeadersMap: Record<string, string[]> = {};
      updatedTypes.forEach((t) => {
        nextHeadersMap[t.id] =
          t.headerLines && t.headerLines.length > 0
            ? t.headerLines
            : DEFAULT_HEADER_LINES;
      });
      setPerTeamHeaders(nextHeadersMap);

      if (isEdit && editingTeamId === selectedTeamId) {
        props.setAdminHeaderLinesDraft(
          teamDraft.headerLines && teamDraft.headerLines.length > 0
            ? teamDraft.headerLines
            : DEFAULT_HEADER_LINES,
        );
      }

      const target = updatedTypes.find(
        (t) =>
          t.id === (editingTeamId || "") ||
          t.code === teamDraft.code.trim().toLowerCase(),
      );
      if (target) {
        setSelectedTeamId(target.id);
      }

      setShowAddTeamModal(false);
      setEditingTeamId(null);
      await showSuccess(
        isEdit ? "Jenis Tim Diperbarui" : "Jenis Tim Ditambahkan",
        `Jenis tim "${teamDraft.name}" berhasil disimpan ke sistem.`,
      );
    } catch (err: any) {
      await showError(
        "Simpan Gagal",
        err.message || "Terjadi kesalahan saat menyimpan jenis tim.",
      );
    } finally {
      setSavingTeamType(false);
    }
  };

  const handleDeleteSelectedTeam = async (team: TeamType) => {
    if (team.isDefault) {
      await showError(
        "Batal Hapus",
        "Jenis tim utama (default) tidak dapat dihapus.",
      );
      return;
    }
    const confirmDelete = await askConfirmation(
      "Hapus Jenis Tim?",
      `Apakah Anda yakin ingin menghapus jenis tim "${team.name}"?`,
      "Ya, Hapus",
    );
    if (!confirmDelete) return;

    try {
      setSavingTeamType(true);
      const updatedTypes = await deleteTeamType(team.id);
      setTeamTypes(updatedTypes);
      if (updatedTypes.length > 0) {
        setSelectedTeamId(updatedTypes[0].id);
      }
      await showSuccess(
        "Berhasil Dihapus",
        `Jenis tim "${team.name}" telah dihapus.`,
      );
    } catch (err: any) {
      await showError("Hapus Gagal", err.message || "Terjadi kesalahan.");
    } finally {
      setSavingTeamType(false);
    }
  };

  const divisionHead = props.adminTemplateApproverDrafts.division_head;
  const busy = savingTeamType || props.adminSubmitting;

  return (
    <div className="grid gap-6">
      {props.section === "header" && <>
        <div className="settings-team-selector">
          <label htmlFor="header-team" className="settings-label">Tim laporan</label>
          <select id="header-team" value={selectedTeam?.id || ""} disabled={busy || !teamTypes.length} onChange={(event) => {
            setSelectedTeamId(event.target.value);
            const team = teamTypes.find((item) => item.id === event.target.value);
            if (team) props.setAdminHeaderLinesDraft(perTeamHeaders[team.id] || team.headerLines || DEFAULT_HEADER_LINES);
          }} className="field-input">
            {!teamTypes.length && <option value="">Memuat tim…</option>}
            {teamTypes.map((team) => <option key={team.id} value={team.id}>{team.name}{team.isDefault ? " (utama)" : ""}</option>)}
          </select>
        </div>
        <SettingsCard title="Susunan kop laporan" description="Susun teks sesuai urutan tampil pada dokumen tim yang dipilih." footer={
          <button type="button" className="btn-primary" disabled={busy || !selectedTeam} onClick={() => void handleSaveCurrentTeamHeader()}>
            {busy && <SpinnerIcon />}{busy ? "Menyimpan…" : "Simpan kop laporan"}
          </button>
        }>
          <fieldset disabled={busy || !selectedTeam} className="settings-header-editor">
            {currentHeaderLines.map((line, index) => (
              <div key={index} className="settings-header-line">
                <label className="min-w-0 flex-1">
                  <span className="settings-hint">Baris {index + 1}</span>
                  <input aria-label={`Teks kop baris ${index + 1}`} value={line} onChange={(event) => handleHeaderLineChange(index, event.target.value)} className="field-input mt-1" />
                </label>
                <div className="settings-line-actions">
                  <button type="button" disabled={index === 0} onClick={() => handleMoveHeaderLine(index, "up")} aria-label={`Pindahkan baris ${index + 1} ke atas`}>↑</button>
                  <button type="button" disabled={index === currentHeaderLines.length - 1} onClick={() => handleMoveHeaderLine(index, "down")} aria-label={`Pindahkan baris ${index + 1} ke bawah`}>↓</button>
                  <button type="button" disabled={currentHeaderLines.length <= 1} onClick={() => handleRemoveHeaderLine(index)} aria-label={`Hapus baris ${index + 1}`} className="text-[var(--danger)]">×</button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-3">
              <button type="button" className="btn-secondary" onClick={handleAddHeaderLine}>Tambah baris</button>
              <button type="button" className="btn-ghost" onClick={handleResetHeaderLines}>Pulihkan bawaan</button>
            </div>
          </fieldset>
          <div className="settings-header-preview">
            <p className="settings-label mb-3">Pratinjau dokumen</p>
            <div aria-live="polite" className="settings-header-paper">
              {currentHeaderLines.filter((line) => line.trim()).map((line, index) => <p key={index}>{line}</p>)}
              {!currentHeaderLines.some((line) => line.trim()) && <p>Kop laporan kosong</p>}
            </div>
          </div>
        </SettingsCard>
      </>}

      {props.section === "teams" && <>
        <div className="settings-list-toolbar">
          <p className="settings-hint">{teamTypes.length} tim terdaftar</p>
          <button type="button" className="btn-primary" disabled={busy} onClick={openCreateTeamModal}>Tambah tim</button>
        </div>
        <div className="settings-team-list">
          {teamTypes.map((team) => (
            <article key={team.id} className="settings-team-row">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="settings-label">{team.name}</h4>
                  {team.isDefault && <span className="settings-badge">Tim utama</span>}
                </div>
                <p className="settings-hint">{team.code.toUpperCase()}{team.description ? ` · ${team.description}` : ""}</p>
                <p className="text-sm mt-3">{team.coordinatorName || "Koordinator belum diatur"}</p>
                {team.coordinatorNip && <p className="settings-hint">NIP {team.coordinatorNip}</p>}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => openEditTeamModal(team)} aria-label={`Edit tim ${team.name}`}>Edit tim</button>
                {!team.isDefault && <button type="button" className="btn-ghost text-[var(--danger)]" disabled={busy} onClick={() => void handleDeleteSelectedTeam(team)} aria-label={`Hapus tim ${team.name}`}>Hapus</button>}
              </div>
            </article>
          ))}
        </div>
        <SettingsCard title="Pejabat pengesah" description="Kepala bidang yang mengesahkan laporan seluruh tim." footer={
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void props.onHandleSaveTemplateApproverDefaults()}>
            {props.adminActiveAction === "save-template-approvers" && <SpinnerIcon />}
            {props.adminActiveAction === "save-template-approvers" ? "Menyimpan…" : "Simpan pejabat"}
          </button>
        }>
          <fieldset disabled={busy} className="grid gap-4 py-6 sm:grid-cols-2">
            {([
              ["scopeLabel", "Jabatan pada dokumen"],
              ["officialName", "Nama dan gelar"],
              ["officialTitle", "Pangkat / golongan"],
              ["officialNip", "NIP"],
            ] as const).map(([key, label]) => (
              <label key={key} className="grid gap-2">
                <span className="settings-label">{label}</span>
                <input value={divisionHead[key]} onChange={(event) => props.onChangeAdminTemplateApproverDraft("division_head", key, event.target.value)} className={inputClassName} />
              </label>
            ))}
          </fieldset>
        </SettingsCard>
      </>}
      {showAddTeamModal && <TeamEditorDialog draft={teamDraft} editing={Boolean(editingTeamId)} saving={savingTeamType} onChange={setTeamDraft} onSubmit={handleSaveTeamType} onClose={() => { setShowAddTeamModal(false); setEditingTeamId(null); }} />}
    </div>
  );
}
