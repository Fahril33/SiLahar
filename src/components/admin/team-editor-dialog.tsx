import { useEffect, useRef, type FormEvent } from "react";
import type { TeamTypeDraft } from "../../types/team-type";
import { SpinnerIcon } from "./shared";

export function TeamEditorDialog(props: {
  draft: TeamTypeDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: TeamTypeDraft) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="team-editor-title" onCancel={(event) => {
      event.preventDefault();
      if (!props.saving) props.onClose();
    }}>
      <form onSubmit={(event) => void props.onSubmit(event)}>
        <header className="settings-dialog-heading">
          <h4 id="team-editor-title">{props.editing ? "Edit tim dan koordinator" : "Tambah tim"}</h4>
          <p className="settings-hint">Identitas dan pejabat koordinator yang digunakan pada laporan tim.</p>
        </header>
        <fieldset disabled={props.saving} className="settings-dialog-fields">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="settings-label">Nama tim</span>
              <input autoFocus required className="field-input" value={props.draft.name} onChange={(event) => props.onChange({ ...props.draft, name: event.target.value })} placeholder="Contoh: Tim Logistik" />
            </label>
            <label className="grid gap-2">
              <span className="settings-label">Kode tim</span>
              <input required className="field-input" value={props.draft.code} onChange={(event) => props.onChange({ ...props.draft, code: event.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="Contoh: logistik" />
            </label>
          </div>
          <label className="grid gap-2">
            <span className="settings-label">Deskripsi <span className="font-normal text-[var(--text-muted)]">(opsional)</span></span>
            <textarea rows={2} className="field-input" value={props.draft.description} onChange={(event) => props.onChange({ ...props.draft, description: event.target.value })} />
          </label>
          <div className="settings-dialog-divider">Koordinator tim</div>
          <label className="grid gap-2">
            <span className="settings-label">Nama dan gelar</span>
            <input className="field-input" value={props.draft.coordinatorName || ""} onChange={(event) => props.onChange({ ...props.draft, coordinatorName: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="settings-label">NIP</span>
            <input className="field-input" value={props.draft.coordinatorNip || ""} onChange={(event) => props.onChange({ ...props.draft, coordinatorNip: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="settings-label">Jabatan pada dokumen</span>
            <input className="field-input" value={props.draft.coordinatorLabel || ""} onChange={(event) => props.onChange({ ...props.draft, coordinatorLabel: event.target.value })} placeholder="Contoh: KOORDINATOR TIM" />
          </label>
        </fieldset>
        <footer className="settings-card-footer">
          <button type="button" className="btn-secondary" disabled={props.saving} onClick={props.onClose}>Batal</button>
          <button type="submit" className="btn-primary" disabled={props.saving}>{props.saving && <SpinnerIcon />}{props.saving ? "Menyimpan…" : "Simpan tim"}</button>
        </footer>
      </form>
    </dialog>
  );
}
