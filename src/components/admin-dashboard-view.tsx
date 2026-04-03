import { useState } from "react";
import type { ReportRules } from "../config/report-rules";
import { formatWitaDateTime } from "../lib/time";
import type { AdminSessionState } from "../types/admin";
import type { ReporterDirectoryProfile } from "../types/report";

const inputClassName = "field-input";

type AdminSection = "rules" | "reporters";

type AdminDashboardViewProps = {
  adminSession: AdminSessionState | null;
  adminEmail: string;
  setAdminEmail: (value: string) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  adminAuthLoading: boolean;
  adminSubmitting: boolean;
  adminRuleDraft: ReportRules;
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
  return (
    <div className="grid gap-3">
      {props.reporterProfiles.length === 0 ? (
        <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)]">
          Belum ada pengguna publik yang tercatat.
        </div>
      ) : null}

      {props.reporterProfiles.map((reporter) => (
        <article
          key={reporter.id}
          className="surface-card rounded-[24px] p-4 sm:p-5"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Nama pengguna publik
                </span>
                <input
                  value={
                    props.adminReporterDraftNames[reporter.id] ??
                    reporter.fullName
                  }
                  onChange={(event) =>
                    props.onChangeAdminReporterDraftName(
                      reporter.id,
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                />
              </label>

              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-4 py-3 text-xs text-[var(--text-muted)]">
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
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => void props.onHandleRenameReporterProfile(reporter)}
                disabled={props.adminSubmitting}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => void props.onHandleDeleteReporterTrace(reporter)}
                disabled={props.adminSubmitting}
                className="btn-danger px-4 py-2 text-sm disabled:opacity-60"
              >
                Hapus jejak
              </button>
            </div>
          </div>
        </article>
      ))}
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
        </div>
      ) : null}
    </section>
  );
}
