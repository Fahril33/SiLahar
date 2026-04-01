import { formatWitaDateTime } from "../lib/time";
import type { ReportRules } from "../config/report-rules";
import type { DraftReport, Report } from "../types/report";
import { ApprovalCard } from "./approval-card";
import { AutocompleteInput } from "./autocomplete-input";
import { DeviceNameHistory } from "./device-name-history";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-lagoon";

const textareaClassName =
  "w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-lagoon";

const sectionTitleClassName = "text-sm font-semibold uppercase tracking-[0.18em]";

type PendingPreviewMap = Record<number, Array<{ name: string; url: string }>>;

export function EntryView(props: {
  draft: DraftReport;
  savedNames: string[];
  reporterNames: string[];
  searchName: string;
  setSearchName: (value: string) => void;
  searchDate: string;
  setSearchDate: (value: string) => void;
  searchResult: Report | null;
  searchResultLoaded: boolean;
  searchResultCanReload: boolean;
  searchResultNeedsReload: boolean;
  similarName: string | null;
  duplicateToday: Report | null;
  nameCheckLoading: boolean;
  nameExistsInDirectory: boolean | null;
  reportRules: ReportRules;
  activityTimeIssues: Array<{
    startAfterMorning: boolean;
    endBeforeStart: boolean;
    startsBeforePreviousEnd: boolean;
    overtime: boolean;
  }>;
  pendingPreviews: PendingPreviewMap;
  preview: Report;
  submitting: boolean;
  onChange: <K extends keyof DraftReport>(key: K, value: DraftReport[K]) => void;
  onChangeActivity: (index: number, key: "description" | "startTime" | "endTime", value: string) => void;
  onAddActivity: () => void;
  onRemoveActivity: (index: number) => void;
  onSetActivityFiles: (activityNo: number, files: FileList | null) => void;
  onHandleLoadEdit: (report: Report) => Promise<void>;
  onHandleExport: (report: Report, format: "excel" | "word") => Promise<void>;
  onHandleResetDraft: () => Promise<void>;
  onSaveReport: () => Promise<void>;
}) {
  const {
    draft,
    savedNames,
    reporterNames,
    searchName,
    setSearchName,
    searchDate,
    setSearchDate,
    searchResult,
    searchResultLoaded,
    searchResultCanReload,
    searchResultNeedsReload,
    similarName,
    duplicateToday,
    nameCheckLoading,
    nameExistsInDirectory,
    reportRules,
    activityTimeIssues,
    pendingPreviews,
    preview,
    submitting,
    onChange,
    onChangeActivity,
    onAddActivity,
    onRemoveActivity,
    onSetActivityFiles,
    onHandleLoadEdit,
    onHandleExport,
    onHandleResetDraft,
    onSaveReport,
  } = props;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="glass rounded-[28px] border border-sky-100/80 bg-gradient-to-br from-sky-50/90 via-white/90 to-cyan-50/80 p-5 shadow-soft">
          <div className="grid gap-4 md:grid-cols-3">
            <AutocompleteInput
              value={searchName}
              onChange={setSearchName}
              options={reporterNames}
              placeholder="CARI NAMA PERSIS"
              className={`${inputClassName} md:col-span-1`}
              emptyMessage="Belum ada nama di database yang cocok."
            />
            <input type="date" value={searchDate} onChange={(event) => setSearchDate(event.target.value)} className={inputClassName} />
            <div className="rounded-2xl border border-sky-100 bg-white/80 p-4 text-sm text-ink/70">
              {searchResult ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void onHandleLoadEdit(searchResult)}
                    disabled={!searchResultCanReload}
                    className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {searchResultLoaded ? "Selesai" : searchResultNeedsReload ? "Muat ulang data asli" : "Muat untuk edit"}
                  </button>
                  <p>
                    {searchResultLoaded
                      ? `Berhasil memuat data asli ${searchResult.nama}.`
                      : `Ditemukan laporan ${searchResult.nama}.`}
                  </p>
                </div>
              ) : (
                "Belum ada laporan cocok."
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-[28px] border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white/90 to-teal-50/70 p-5 shadow-soft">
          <DeviceNameHistory names={savedNames} onPick={(name) => onChange("nama", name)} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <AutocompleteInput
                value={draft.nama}
                onChange={(value) => onChange("nama", value)}
                options={reporterNames}
                placeholder="NAMA LENGKAP"
                className={inputClassName}
                emptyMessage="Nama ini belum ada di database. Kamu tetap bisa lanjut mengisi laporan."
              />
            </div>
            {similarName ? <p className="md:col-span-2 text-sm text-coral">Sepertinya Anda typo? Mungkin: {similarName}</p> : null}
            {draft.nama.trim() && (nameCheckLoading || nameExistsInDirectory === true) ? (
              <p className="md:col-span-2 text-sm text-ink/60">
                {nameCheckLoading
                  ? "Mengecek nama ke database..."
                  : "Nama ini sudah pernah tercatat di sistem."}
              </p>
            ) : null}
            {duplicateToday ? <p className="md:col-span-2 text-sm text-lagoon">Laporan hari ini sudah ada. Penyimpanan berikutnya akan memperbarui data yang sama.</p> : null}
            <input value={draft.tanggal} disabled className={`${inputClassName} md:col-span-2 cursor-not-allowed bg-slate-100 text-slate-600`} />
          </div>

          <div className="mt-6 rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className={`${sectionTitleClassName} text-amber-700`}>Aktivitas Harian</p>
                <h2 className="text-xl font-bold">Detail aktivitas</h2>
              </div>
              <button type="button" onClick={onAddActivity} className="rounded-full bg-lagoon px-4 py-2 text-sm font-semibold text-white">
                Tambah baris
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {draft.activities.map((activity, index) => (
                <div key={activity.no} className="rounded-[24px] border border-amber-100 bg-white/95 p-4 shadow-sm sm:p-5">
                  <div className="grid gap-3 md:grid-cols-[90px_160px_160px_auto] md:items-end">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">No</span>
                      <input value={activity.no} readOnly className={`${inputClassName} bg-slate-50`} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Jam mulai</span>
                      <input type="time" value={activity.startTime} onChange={(event) => onChangeActivity(index, "startTime", event.target.value)} className={inputClassName} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Jam selesai</span>
                      <input type="time" value={activity.endTime} onChange={(event) => onChangeActivity(index, "endTime", event.target.value)} className={inputClassName} />
                    </label>
                    {draft.activities.length > 1 ? (
                      <button type="button" onClick={() => onRemoveActivity(index)} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold">
                        Hapus baris
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-medium">Detail aktivitas</span>
                    <textarea rows={5} value={activity.description} onChange={(event) => onChangeActivity(index, "description", event.target.value)} className={`${textareaClassName} break-words`} />
                  </label>

                  <div className="mt-3 space-y-1 text-sm">
                    {activityTimeIssues[index]?.startAfterMorning ? <p className="text-coral">sepertinya anda melewatkan sesuatu pagi ini</p> : null}
                    {activityTimeIssues[index]?.endBeforeStart ? <p className="text-coral">jam selesai tidak boleh kurang dari jam mulai.</p> : null}
                    {activityTimeIssues[index]?.startsBeforePreviousEnd ? <p className="text-coral">jam mulai aktivitas ini tidak boleh kurang dari jam selesai aktivitas sebelumnya.</p> : null}
                    {activityTimeIssues[index]?.overtime ? <p className="text-lagoon">sepertinya anda lembur, hebat.</p> : null}
                  </div>

                  <div className="mt-4 rounded-[22px] border border-dashed border-amber-200 bg-amber-50/40 p-4">
                    <label className="block text-sm font-medium">Foto bukti dokumentasi</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple={reportRules.maxPhotosPerActivity > 1}
                      onChange={(event) => onSetActivityFiles(activity.no, event.target.files)}
                      className="mt-3 block w-full text-sm text-ink/70"
                    />
                    <p className="mt-2 text-xs text-ink/55">
                      {reportRules.maxPhotosPerActivity === 1
                        ? "Saat ini hanya 1 foto yang diizinkan untuk setiap baris aktivitas."
                        : `Saat ini maksimal ${reportRules.maxPhotosPerActivity} foto untuk setiap baris aktivitas.`}
                    </p>
                    {(pendingPreviews[activity.no]?.length ?? 0) > 0 || activity.photos.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {activity.photos.slice(0, 1).map((photo) => (
                          <img key={photo.id} src={photo.publicUrl} alt={photo.originalFileName} className="h-24 w-24 rounded-2xl object-cover" />
                        ))}
                        {(pendingPreviews[activity.no] ?? []).slice(0, 1).map((photo) => (
                          <img key={photo.url} src={photo.url} alt={photo.name} className="h-24 w-24 rounded-2xl object-cover ring-2 ring-coral/40" />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-ink/55">Belum ada foto bukti di aktivitas ini.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 p-4 sm:p-5">
            <div className="space-y-1">
              <p className={`${sectionTitleClassName} text-plum`}>Persetujuan</p>
              <h2 className="text-xl font-bold">Data pejabat penandatangan</h2>
              <p className="text-sm text-ink/60">Susun nama, jabatan, dan NIP agar tampilan dokumen akhir tetap rapi.</p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lagoon/10 text-sm font-bold text-lagoon">
                    KT
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-lagoon">Pihak 1</p>
                    <h3 className="text-lg font-bold">Koordinator Tim</h3>
                  </div>
                </div>

                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Nama pejabat</span>
                    <input
                      value={draft.approverCoordinator}
                      onChange={(event) => onChange("approverCoordinator", event.target.value.toUpperCase())}
                      placeholder="KOORDINATOR TIM"
                      className={inputClassName}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">NIP</span>
                    <input
                      value={draft.approverCoordinatorNip}
                      onChange={(event) => onChange("approverCoordinatorNip", event.target.value)}
                      placeholder="NIP KOORDINATOR"
                      className={inputClassName}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/10 text-sm font-bold text-coral">
                    KB
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-coral">Pihak 2</p>
                    <h3 className="text-lg font-bold">Kepala Bidang</h3>
                  </div>
                </div>

                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Nama pejabat</span>
                    <input
                      value={draft.approverDivisionHead}
                      onChange={(event) => onChange("approverDivisionHead", event.target.value.toUpperCase())}
                      placeholder="KEPALA BIDANG"
                      className={inputClassName}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Jabatan</span>
                    <input
                      value={draft.approverDivisionHeadTitle}
                      onChange={(event) => onChange("approverDivisionHeadTitle", event.target.value.toUpperCase())}
                      placeholder="JABATAN"
                      className={inputClassName}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">NIP</span>
                    <input
                      value={draft.approverDivisionHeadNip}
                      onChange={(event) => onChange("approverDivisionHeadNip", event.target.value)}
                      placeholder="NIP KEPALA BIDANG"
                      className={inputClassName}
                    />
                  </label>
                </div>
              </section>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => void onSaveReport()} disabled={submitting} className="rounded-full bg-lagoon px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? "Menyimpan..." : "Simpan laporan"}
            </button>
            <button type="button" onClick={() => void onHandleResetDraft()} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold">
              Reset draft
            </button>
          </div>
        </div>
      </div>

      <aside className="glass rounded-[28px] border border-indigo-100/80 bg-gradient-to-br from-indigo-50/85 via-white/92 to-blue-50/80 p-5 shadow-soft">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void onHandleExport(preview, "excel")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
              Export Excel
            </button>
            <button type="button" onClick={() => void onHandleExport(preview, "word")} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">
              Export Word
            </button>
          </div>
          <div className="mt-6 rounded-[30px] border border-indigo-100 bg-white p-6 shadow-sm">
            <p className="text-center text-lg font-bold uppercase">Laporan Harian Kinerja Tim Reaksi Cepat</p>
            <p className="mt-1 text-center text-sm font-semibold uppercase">Badan Penanggulangan Bencana Daerah Provinsi Sulawesi Tengah</p>
            <p className="mt-1 text-center text-sm font-semibold uppercase">Tahun Anggaran 2026</p>
            <div className="mt-6 space-y-2 text-sm">
              <p><span className="font-semibold">NAMA</span>: {preview.nama || "-"}</p>
              <p><span className="font-semibold">HARI/TANGGAL</span>: {preview.tanggal || "-"}</p>
            </div>
            <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="w-14 border border-slate-200 px-3 py-2 text-left">NO</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">DETAIL AKTIVITAS</th>
                    <th className="w-40 border border-slate-200 px-3 py-2 text-left">WAKTU</th>
                    <th className="w-40 border border-slate-200 px-3 py-2 text-left">BUKTI</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.activities.map((activity) => (
                    <tr key={activity.no}>
                      <td className="border border-slate-200 px-3 py-2 align-top">{activity.no}</td>
                      <td className="border border-slate-200 px-3 py-2 align-top whitespace-pre-wrap break-words">{activity.description || "-"}</td>
                      <td className="border border-slate-200 px-3 py-2 align-top">{activity.startTime} - {activity.endTime} WITA</td>
                      <td className="border border-slate-200 px-3 py-2 align-top">
                        {activity.photos.length > 0 ? (
                          <div className="w-full">
                            {activity.photos.slice(0, 1).map((photo) => (
                              <img key={photo.id} src={photo.publicUrl} alt={photo.originalFileName} className="block h-auto w-full rounded-xl object-cover" />
                            ))}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ApprovalCard title="Koordinator Tim" name={preview.approverCoordinator} meta={`NIP: ${preview.approverCoordinatorNip}`} />
              <ApprovalCard title="Kepala Bidang Kedaruratan & Logistik" name={preview.approverDivisionHead} meta={`${preview.approverDivisionHeadTitle} | NIP: ${preview.approverDivisionHeadNip}`} />
            </div>
            <div className="mt-6 rounded-[24px] bg-slate-50 p-4 text-sm">
              <p className="font-bold">CAT.</p>
              <ol className="mt-2 space-y-1 pl-5">{preview.notes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ol>
            </div>
            <p className="mt-4 text-sm text-ink/65">Terakhir diperbarui: {formatWitaDateTime(preview.updatedAt)}</p>
          </div>
        </div>
      </aside>
    </section>
  );
}
