import type { ReportRules } from "../config/report-rules";
import type { AdminSessionState } from "../types/admin";

const inputClassName = "field-input";

type AdminViewProps = {
  adminSession: AdminSessionState | null;
  adminEmail: string;
  setAdminEmail: (value: string) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  adminAuthLoading: boolean;
  adminSubmitting: boolean;
  adminRuleDraft: ReportRules;
  onChangeAdminRule: <K extends keyof ReportRules>(
    key: K,
    value: ReportRules[K],
  ) => void;
  onHandleAdminLogin: () => Promise<void>;
  onHandleAdminLogout: () => Promise<void>;
  onHandleSaveAdminRules: () => Promise<void>;
};

export function AdminView(props: AdminViewProps) {
  return (
    <section className="panel-glass rounded-[32px] p-4 sm:p-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Panel Admin
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
          Pengaturan sistem dan rules laporan
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Login admin dipakai untuk mengatur rule tanggal laporan publik dan
          menjadi fondasi pengaturan lain yang akan ditambahkan berikutnya.
        </p>
      </div>

      {!props.adminSession ? (
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
                onChange={(event) =>
                  props.setAdminPassword(event.target.value)
                }
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
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
          <div className="surface-card rounded-[24px] p-5">
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Sesi admin aktif
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
              {props.adminSession.profile.fullName}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Role: {props.adminSession.profile.role.toUpperCase()}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Email: {props.adminSession.user.email}
            </p>
            <button
              type="button"
              onClick={() => void props.onHandleAdminLogout()}
              disabled={props.adminSubmitting}
              className="btn-secondary mt-5 w-full justify-center disabled:opacity-60"
            >
              {props.adminSubmitting ? "Memproses..." : "Logout admin"}
            </button>
          </div>

          <div className="surface-card rounded-[24px] p-5">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Rules laporan publik
            </h3>
            <div className="mt-5 space-y-4">
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
                    Izinkan pengguna publik input laporan untuk tanggal mana pun
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Jika dimatikan, publik hanya bisa membuat atau mengubah
                    laporan untuk hari berjalan, dan date picker di form akan
                    dikunci.
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
        </div>
      )}
    </section>
  );
}
