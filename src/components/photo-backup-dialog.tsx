import { useEffect, useMemo, useRef, useState } from "react";
import type { Report } from "../types/report";
import { createPhotoBackupZip, extractPhotosForBackup, getUniquePhotoItems, type PhotoBackupProgress, type PhotoBackupResult } from "../lib/photo-backup-service";

export interface PhotoBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reports: Report[];
}

export function PhotoBackupDialog(props: PhotoBackupDialogProps) {
  return props.isOpen ? <PhotoBackupContent reports={props.reports} onClose={props.onClose} /> : null;
}

function PhotoBackupContent(props: Omit<PhotoBackupDialogProps, "isOpen">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tim, setTim] = useState("ALL");
  const [reporterName, setReporterName] = useState("ALL");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PhotoBackupProgress | null>(null);
  const [result, setResult] = useState<PhotoBackupResult | null>(null);
  const [error, setError] = useState("");
  const filter = useMemo(() => ({ startDate: startDate || undefined, endDate: endDate || undefined, tim, reporterName }), [startDate, endDate, tim, reporterName]);
  const photos = useMemo(() => extractPhotosForBackup(props.reports, filter), [props.reports, filter]);
  const { uniqueList } = useMemo(() => getUniquePhotoItems(photos), [photos]);
  const teams = [...new Set(props.reports.map((report) => report.tim).filter(Boolean))].sort();
  const reporters = [...new Set(props.reports.map((report) => report.nama))].sort((a, b) => a.localeCompare(b, "id"));

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  async function downloadArchive() {
    if (lock.current || !uniqueList.length) return;
    lock.current = true;
    setRunning(true); setError(""); setResult(null);
    try { setResult(await createPhotoBackupZip(props.reports, filter, setProgress)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Arsip foto belum berhasil dibuat."); }
    finally { lock.current = false; setRunning(false); }
  }

  return (
    <dialog
      ref={dialog}
      className="media-archive-dialog"
      aria-labelledby="media-archive-title"
      onCancel={(event) => { event.preventDefault(); if (!running) props.onClose(); }}
    >
      <form onSubmit={(event) => { event.preventDefault(); void downloadArchive(); }}>
        <header className="media-lightbox-header"><div><p className="settings-eyebrow">Cadangan dokumentasi</p><h4 id="media-archive-title">Arsip ZIP foto laporan</h4><p className="settings-hint">Unduh foto beserta manifest pemetaan laporan dan lokasi berkas aslinya.</p></div></header>
        <div className="media-archive-body">
          <fieldset disabled={running} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2"><span className="settings-label">Dari tanggal</span><input
              type="date"
              className="field-input"
              max={endDate || undefined}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            /></label>
            <label className="grid gap-2"><span className="settings-label">Sampai tanggal</span><input
              type="date"
              className="field-input"
              min={startDate || undefined}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            /></label>
            <label className="grid gap-2"><span className="settings-label">Tim</span><select
              className="field-input"
              value={tim}
              onChange={(event) => setTim(event.target.value)}
            ><option value="ALL">Semua tim</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
            <label className="grid gap-2"><span className="settings-label">Petugas</span><select
              className="field-input"
              value={reporterName}
              onChange={(event) => setReporterName(event.target.value)}
            ><option value="ALL">Semua petugas</option>{reporters.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          </fieldset>
          <p className="settings-hint mt-5">{uniqueList.length} berkas unik dari {photos.length} referensi foto pada {new Set(photos.map((photo) => photo.reportId)).size} laporan.</p>
          <p className="settings-hint">Arsip ini mencakup foto yang dirujuk oleh laporan. Berkas orphan dikelola melalui daftar Media gambar.</p>
          {progress && <div className="media-operation-progress" role="status"><span>{progress.statusText}</span><progress
            max={100}
            value={progress.percent}
            aria-label="Progres pengunduhan arsip foto"
          /></div>}
          {error && <p role="alert" className="media-error-message">{error}</p>}
          {result && <div className="media-archive-result" role="status"><strong>{result.downloadedCount} dari {result.totalUniqueFiles} gambar berhasil diarsipkan.</strong><p className="settings-hint">{result.zipFileName}</p>{result.failedCount > 0 && <p className="settings-hint">{result.failedCount} gambar gagal diunduh. Detailnya disertakan dalam berkas failed-downloads.json.</p>}</div>}
        </div>
        <footer className="settings-card-footer"><button
          type="button"
          className="btn-secondary"
          disabled={running}
          onClick={props.onClose}
        >Tutup</button><button
          type="submit"
          className="btn-primary"
          disabled={running || !uniqueList.length}
        >{running ? "Menyusun arsip…" : "Unduh arsip ZIP"}</button></footer>
      </form>
    </dialog>
  );
}
