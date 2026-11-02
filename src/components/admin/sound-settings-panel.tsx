import { FAIL_SOUNDS, playSound, SUCCESS_SOUNDS } from "../../lib/sound-utils";
import { SettingsCard, SettingsToggle } from "./settings-ui";
import { SpinnerIcon } from "./shared";
import type { AdminDashboardViewProps } from "./types";

export function SoundSettingsPanel(props: AdminDashboardViewProps) {
  const enabled = !props.notificationSettings.disableSoundResponsesForAllUsers;
  const saving = props.adminActiveAction === "save-notification-settings";

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      void props.onHandleSaveNotificationSettings();
    }}>
      <SettingsCard
        title="Suara notifikasi"
        description="Pilihan suara disimpan sebagai pengaturan bersama untuk seluruh pengguna."
        footer={
          <button type="submit" disabled={props.adminSubmitting} className="btn-primary">
            {saving && <SpinnerIcon />}
            {saving ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        }
      >
        <SettingsToggle
          label="Aktifkan suara notifikasi"
          description="Notifikasi visual tetap ditampilkan saat suara dinonaktifkan."
          checked={enabled}
          disabled={props.adminSubmitting}
          onChange={(checked) => props.onChangeNotificationSettings("disableSoundResponsesForAllUsers", !checked)}
        />
        <fieldset disabled={!enabled || props.adminSubmitting} className="settings-sound-grid disabled:opacity-50">
          <legend className="sr-only">Pilihan suara untuk setiap jenis notifikasi</legend>
          {([
            { type: "success", title: "Aksi berhasil", sounds: SUCCESS_SOUNDS },
            { type: "fail", title: "Aksi gagal", sounds: FAIL_SOUNDS },
          ] as const).map(({ type, title, sounds }) => {
            const config = props.notificationSettings[type];
            return (
              <div key={type} className="settings-sound-item">
                <h5 className="settings-label">{title}</h5>
                <label className="grid gap-2">
                  <span className="settings-hint">Pemutaran</span>
                  <select
                    value={config.mode}
                    onChange={(event) => props.onChangeNotificationSettings(type, {
                      ...config,
                      mode: event.target.value as "random" | "specific",
                    })}
                    className="field-input"
                  >
                    <option value="random">Acak</option>
                    <option value="specific">Pilih suara</option>
                  </select>
                </label>
                {config.mode === "specific" && (
                  <label className="grid gap-2">
                    <span className="settings-hint">Berkas suara</span>
                    <select
                      required
                      value={config.specificFile || ""}
                      onChange={(event) => props.onChangeNotificationSettings(type, { ...config, specificFile: event.target.value })}
                      className="field-input"
                    >
                      <option value="" disabled>Pilih suara…</option>
                      {Object.keys(sounds).map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => playSound(type, props.notificationSettings)}
                  className="btn-secondary justify-self-start"
                  aria-label={`Dengarkan suara ${title.toLowerCase()}`}
                >
                  Dengarkan contoh
                </button>
              </div>
            );
          })}
        </fieldset>
      </SettingsCard>
    </form>
  );
}
