import type { FormEvent } from "react";
import { SettingsCard, SettingsToggle } from "./settings-ui";
import { SpinnerIcon } from "./shared";
import type { AdminDashboardViewProps } from "./types";

export function OperationalSettingsPanel(props: AdminDashboardViewProps) {
  const saving = props.adminActiveAction === "save-rules";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onHandleSaveAdminRules();
  }

  return (
    <form onSubmit={handleSubmit}>
      <SettingsCard
        title="Ketentuan pengisian"
        description="Aturan ini berlaku untuk seluruh petugas yang mengisi laporan."
        footer={
          <button type="submit" disabled={props.adminSubmitting || props.loading} className="btn-primary">
            {saving && <SpinnerIcon />}
            {saving ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        }
      >
        <SettingsToggle
          label="Izinkan semua tanggal laporan"
          description="Saat nonaktif, petugas hanya dapat mengisi laporan untuk hari berjalan."
          checked={props.adminRuleDraft.allowAnyReportDate}
          disabled={props.adminSubmitting}
          onChange={(checked) => props.onChangeAdminRule("allowAnyReportDate", checked)}
        />
        <div className="settings-field-row">
          <label htmlFor="max-activity-photos">
            <span className="settings-label">Batas foto per aktivitas</span>
            <span className="settings-hint block">Jumlah foto bukti yang dapat dilampirkan pada setiap aktivitas.</span>
          </label>
          <input
            id="max-activity-photos"
            type="number"
            min="1"
            step="1"
            required
            disabled={props.adminSubmitting}
            value={props.adminRuleDraft.maxPhotosPerActivity}
            onChange={(event) => props.onChangeAdminRule("maxPhotosPerActivity", Number(event.target.value))}
            className="field-input"
          />
        </div>
        <div className="settings-field-row">
          <label htmlFor="system-start-date">
            <span className="settings-label">Tanggal mulai operasional</span>
            <span className="settings-hint block">Tanggal awal perhitungan laporan dan statistik sistem.</span>
          </label>
          <input
            id="system-start-date"
            type="date"
            required
            disabled={props.adminSubmitting}
            value={props.adminRuleDraft.systemStartDate}
            onChange={(event) => props.onChangeAdminRule("systemStartDate", event.target.value)}
            className="field-input"
          />
        </div>
      </SettingsCard>
    </form>
  );
}
