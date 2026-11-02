import { useMemo, useState } from "react";
import {
  isSameReporterName
} from "../../lib/reporter-name";
import {
  isUserSoundEnabled,
  playSound,
  setUserSoundEnabled
} from "../../lib/sound-utils";
import { formatWitaDate, formatWitaDateTime } from "../../lib/time";
import type { Report, ReporterDirectoryProfile } from "../../types/report";

import { SpinnerIcon } from "./shared";
const inputClassName = "field-input";

export function UserProfilePanel(props: {
  userSession: ReporterDirectoryProfile;
  userSubmitting: boolean;
  onUserUpdateProfile: (name: string, pass: string) => Promise<void>;
  onUserLogout: () => Promise<void>;
  reports?: Report[];
  bulkExporting?: boolean;
  onHandleBulkExport?: (reports: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupExcel?: (reports?: Report[]) => Promise<void>;
  onHandleDownloadDeviceBackupJson?: (
    reports?: Report[],
    userFilter?: string,
  ) => Promise<void>;
  deviceBackupExporting?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "sound" | "bulk-export"
  >("profile");
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
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition ${activeTab === "profile"
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
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition ${activeTab === "sound"
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
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition ${activeTab === "bulk-export"
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
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Pengaturan Profil
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Perbarui nama dan password Anda
                </p>
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
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
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

          {/* Card Cadangan Perangkat Lokal untuk User */}
          <div className="mt-6 pt-5 border-t border-[var(--border-soft)] space-y-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Cadangan Perangkat Saya
              </h4>
              <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">
                Unduh salinan data laporan yang tersimpan di perangkat ini dalam
                format Excel atau JSON.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {props.onHandleDownloadDeviceBackupExcel && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupExcel &&
                    void props.onHandleDownloadDeviceBackupExcel(myReports)
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
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
                  )}
                  <span>Excel (.xlsx)</span>
                </button>
              )}
              {props.onHandleDownloadDeviceBackupJson && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupJson &&
                    void props.onHandleDownloadDeviceBackupJson(
                      myReports,
                      props.userSession.fullName,
                    )
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span>JSON (.json)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "sound" ? (
        <div className="surface-card rounded-[28px] p-6 max-w-md mx-auto border border-[var(--border-soft)] shadow-sm space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-lg shrink-0">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Suara & Notifikasi
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Pengaturan efek audio lokal perangkat
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label
                  className="text-sm font-bold text-[var(--text-primary)] cursor-pointer"
                  htmlFor="user-sound-toggle"
                >
                  Efek Suara Notifikasi
                </label>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  Putar efek audio respons saat berhasil menyimpan laporan,
                  terjadi kesalahan input, atau peringatan.
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
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${soundEnabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}
              >
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
              * Pengaturan ini disimpan mandiri di browser perangkat ini dan
              tidak mengubah database atau pengguna lain.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Card Cadangan Perangkat User */}
          <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Cadangan Data Perangkat ({props.userSession.fullName})
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Excel &amp; JSON
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-2xl leading-relaxed">
                  Unduh seluruh riwayat dan cache laporan Anda di perangkat ini
                  dalam format Excel (.xlsx) atau JSON (.json) lengkap.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto">
              {props.onHandleDownloadDeviceBackupExcel && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupExcel &&
                    void props.onHandleDownloadDeviceBackupExcel(myReports)
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary h-[42px] px-4 text-xs font-bold flex items-center gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 justify-center"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  <span>Download Excel (.xlsx)</span>
                </button>
              )}
              {props.onHandleDownloadDeviceBackupJson && (
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleDownloadDeviceBackupJson &&
                    void props.onHandleDownloadDeviceBackupJson(
                      myReports,
                      props.userSession.fullName,
                    )
                  }
                  disabled={props.deviceBackupExporting}
                  className="btn-secondary h-[42px] px-4 text-xs font-bold flex items-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 justify-center"
                >
                  {props.deviceBackupExporting ? (
                    <SpinnerIcon />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span>Download JSON (.json)</span>
                </button>
              )}
            </div>
          </div>

          <div className="surface-card rounded-[28px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border-soft)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Unduh Massal Laporan ({props.userSession.fullName})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Pilih rentang tanggal dan unduh laporan-laporan Anda ke file
                  Excel atau JSON sekaligus
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

              <div className="flex flex-wrap items-center gap-2">
                {props.onHandleDownloadDeviceBackupExcel && (
                  <button
                    type="button"
                    onClick={() =>
                      props.onHandleDownloadDeviceBackupExcel &&
                      void props.onHandleDownloadDeviceBackupExcel(
                        selectedReports,
                      )
                    }
                    disabled={
                      props.deviceBackupExporting ||
                      selectedReports.length === 0
                    }
                    className="btn-secondary h-[42px] px-3.5 text-xs font-semibold disabled:opacity-60 flex items-center gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    title="Unduh laporan terpilih dalam format Excel"
                  >
                    {props.deviceBackupExporting ? (
                      <SpinnerIcon />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    <span>Excel Terpilih</span>
                  </button>
                )}
                {props.onHandleDownloadDeviceBackupJson && (
                  <button
                    type="button"
                    onClick={() =>
                      props.onHandleDownloadDeviceBackupJson &&
                      void props.onHandleDownloadDeviceBackupJson(
                        selectedReports,
                        props.userSession.fullName,
                      )
                    }
                    disabled={
                      props.deviceBackupExporting ||
                      selectedReports.length === 0
                    }
                    className="btn-secondary h-[42px] px-3.5 text-xs font-semibold disabled:opacity-60 flex items-center gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    title="Unduh laporan terpilih dalam format JSON"
                  >
                    {props.deviceBackupExporting ? (
                      <SpinnerIcon />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    <span>JSON Terpilih</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    props.onHandleBulkExport &&
                    void props.onHandleBulkExport(selectedReports)
                  }
                  disabled={
                    Boolean(props.bulkExporting) || selectedReports.length === 0
                  }
                  className="btn-primary h-[42px] px-5 text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {props.bulkExporting ? (
                    <>
                      <SpinnerIcon className="h-4 w-4" />
                      <span>Mengunduh...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
                            {report.nama}{" "}
                            {report.tim ? `• Tim ${report.tim}` : ""}
                          </p>
                          <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                            {report.activities.length} aktivitas
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">
                          {report.activities
                            .map((a) => a.description)
                            .join(" • ") || "Tidak ada rincian aktivitas."}
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

