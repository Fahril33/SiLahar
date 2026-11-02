import { useEffect, useRef, useState } from "react";
import { useMediaManager } from "../../hooks/use-media-manager";
import { formatMediaBytes } from "../../lib/media-utils";
import { formatWitaDateTime } from "../../lib/time";
import type { AdminSessionState } from "../../types/admin";
import type { MediaSort } from "../../types/media";
import type { Report } from "../../types/report";
import { PhotoBackupDialog } from "../photo-backup-dialog";
import { SpinnerIcon } from "./shared";
import { MediaFileList } from "./media/media-file-list";
import { MediaLightbox } from "./media/media-lightbox";
import "../../styles/media-settings.css";

export function MediaSettingsPanel(props: {
  adminSession: AdminSessionState;
  reports: Report[];
  onBusyChange: (busy: boolean) => void;
  onRefreshReports?: () => Promise<void>;
}) {
  const manager = useMediaManager(props.adminSession, props.onBusyChange, props.onRefreshReports);
  const [showArchive, setShowArchive] = useState(false);
  const selectPage = useRef<HTMLInputElement>(null);
  const selectedOnPage = manager.visible.filter((file) => manager.selected.has(file.path)).length;
  const allPageSelected = manager.visible.length > 0 && selectedOnPage === manager.visible.length;
  const disabled = manager.loading || manager.deleting;
  useEffect(() => {
    if (selectPage.current) selectPage.current.indeterminate = selectedOnPage > 0 && !allPageSelected;
  }, [selectedOnPage, allPageSelected]);

  return <div className="media-settings">
    <div className="media-source-bar">
      <label className="media-bucket-select"><span className="settings-label">Bucket penyimpanan</span><select
        className="field-input"
        value={manager.bucketId}
        disabled={!manager.buckets.length || manager.deleting}
        onChange={(event) => manager.setBucketId(event.target.value)}
      >
        {!manager.buckets.length && <option value={manager.bucketId}>Memuat bucket…</option>}
        {manager.buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}
      </select></label>
      <div className="media-source-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={!manager.bucket || disabled}
          onClick={() => void manager.load(true)}
        >{manager.loading ? <SpinnerIcon /> : <span aria-hidden="true">↻</span>}Pindai ulang</button>
        {manager.bucket?.id === "daily-report-proofs" && <button
          type="button"
          className="btn-secondary"
          disabled={manager.deleting}
          onClick={() => setShowArchive(true)}
        >Arsip ZIP laporan</button>}
      </div>
    </div>
    <div className="media-metrics" aria-label="Ringkasan media">
      <div><span>Total gambar</span><strong>{manager.scan ? manager.metrics.count.toLocaleString("id-ID") : "—"}</strong><small>Dalam bucket yang dipilih</small></div>
      <div><span>Ukuran gambar</span><strong>{manager.scan ? formatMediaBytes(manager.metrics.bytes) : "—"}</strong><small>Berdasarkan metadata berkas</small></div>
      <div className="media-metric-linked"><span>Terkait data</span><strong>{manager.scan ? manager.metrics.linked.toLocaleString("id-ID") : "—"}</strong><small>Foto laporan dan tanda tangan</small></div>
      <div className="media-metric-orphan"><span>File orphan</span><strong>{manager.scan ? manager.metrics.orphans.toLocaleString("id-ID") : "—"}</strong><small>{manager.scan ? `${formatMediaBytes(manager.metrics.orphanBytes)} tanpa referensi` : "Menunggu hasil audit"}</small></div>
    </div>
    <div className="media-audit-caption"><span className="media-audit-dot" aria-hidden="true" /><p>{manager.scan ? <>Metadata {manager.scan.cached ? "dari cache sesi" : "dipindai"} · {formatWitaDateTime(new Date(manager.scan.scannedAt).toISOString())} WITA. Referensi data diperiksa saat halaman dimuat.</> : "Pemindaian mencakup seluruh folder dan halaman berkas."}</p></div>

    <div className="media-toolbar">
      <div
        className="media-filter-tabs"
        role="group"
        aria-label="Filter keterkaitan media"
      >
        {([{ key: "all", label: "Semua file", count: manager.metrics.count }, { key: "linked", label: "Terkait data", count: manager.metrics.linked }, { key: "orphan", label: "File orphan", count: manager.metrics.orphans }] as const).map((tab) => <button
          type="button"
          key={tab.key}
          aria-pressed={manager.filter === tab.key}
          disabled={disabled}
          onClick={() => manager.changeFilter(tab.key)}
        >{tab.label}<span>{tab.count}</span></button>)}
      </div>
      <div className="media-search-toolbar">
        <label className="media-search"><span className="sr-only">Cari gambar</span><input
          type="search"
          className="field-input"
          placeholder="Cari nama, lokasi berkas, atau pelapor…"
          value={manager.query}
          disabled={disabled}
          onChange={(event) => manager.changeQuery(event.target.value)}
        /></label>
        <label><span className="sr-only">Urutkan gambar</span><select
          className="field-input"
          aria-label="Urutkan gambar"
          value={manager.sort}
          disabled={disabled}
          onChange={(event) => { manager.setSort(event.target.value as MediaSort); manager.setPage(1); }}
        ><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="largest">Terbesar</option><option value="smallest">Terkecil</option><option value="name">Nama A–Z</option></select></label>
        <div
          className="media-view-toggle"
          role="group"
          aria-label="Mode tampilan"
        ><button
          type="button"
          aria-pressed={manager.view === "grid"}
          disabled={manager.deleting}
          onClick={() => manager.setView("grid")}
          aria-label="Tampilan grid"
          title="Tampilan grid"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        ><rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1"
              /><rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1"
              /><rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1"
              /><rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1"
              /></svg></button><button
                type="button"
                aria-pressed={manager.view === "table"}
                disabled={manager.deleting}
                onClick={() => manager.setView("table")}
                aria-label="Tampilan tabel"
                title="Tampilan tabel"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              ><rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
              /><path d="M3 9h18M3 15h18M9 3v18" /></svg></button></div>
      </div>
      <div className="media-batch-toolbar">
        <label className="media-select-page"><input
          ref={selectPage}
          type="checkbox"
          checked={allPageSelected}
          disabled={disabled || !manager.visible.length}
          onChange={manager.togglePage}
        /><span>Pilih halaman</span></label>
        <span className="media-selection-count" aria-live="polite">{manager.selectedImages.length} dipilih{manager.selectedLinked > 0 && ` · ${manager.selectedLinked} terkait data`}{manager.selectedImages.length > selectedOnPage && ` · ${manager.selectedImages.length - selectedOnPage} di halaman lain`}</span>
        <div className="media-batch-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={!manager.canDelete || !manager.metrics.orphans}
            onClick={manager.selectOrphans}
          >Pilih semua orphan</button>
          {manager.selectedImages.length > 0 && <button
            type="button"
            className="btn-ghost"
            disabled={manager.deleting}
            onClick={manager.resetSelection}
          >Batalkan pilihan</button>}
          <button
            type="button"
            className="btn-danger"
            disabled={!manager.canDelete || !manager.selectedImages.length}
            onClick={() => void manager.removeFiles(manager.selectedImages)}
          >{manager.deleting && <SpinnerIcon />}Hapus terpilih{manager.selectedImages.length > 0 && ` (${manager.selectedImages.length})`}</button>
        </div>
      </div>
    </div>

    {manager.error ? <div className="media-empty-state" role="alert"><h4>Audit belum selesai</h4><p>{manager.error}</p><p>Penghapusan dinonaktifkan sampai seluruh referensi berhasil diperiksa.</p><button
      type="button"
      className="btn-secondary"
      onClick={() => void manager.load(true)}
    >Coba lagi</button></div> : manager.loading ? <div className="media-empty-state" role="status"><SpinnerIcon className="h-6 w-6 animate-spin" /><h4>Memeriksa media gambar</h4><p>{manager.scannedFiles} gambar ditemukan. Membaca seluruh folder dan referensi data…</p></div> : manager.visible.length ? <>
      {manager.urlError && <p className="media-error-message" role="alert">{manager.urlError}</p>}
      <MediaFileList
        images={manager.visible}
        urls={manager.urls}
        view={manager.view}
        selected={manager.selected}
        disabled={manager.deleting}
        canDelete={manager.canDelete}
        onToggle={manager.toggleFile}
        onPreview={manager.setPreview}
        onDelete={(image) => void manager.removeFiles([image])}
      />
    </> : <div className="media-empty-state"><h4>{manager.query || manager.filter !== "all" ? "Tidak ada gambar yang sesuai" : "Belum ada gambar dalam bucket ini"}</h4><p>{manager.query || manager.filter !== "all" ? "Sesuaikan kata pencarian atau filter keterkaitan." : "Gambar yang tersimpan akan muncul setelah pemindaian."}</p></div>}

    {manager.deleting && <div className="media-operation-progress" role="status"><span>{manager.deleteProgress.done ? `Memproses ${manager.deleteProgress.done} dari ${manager.deleteProgress.total} gambar…` : "Memeriksa referensi dan otorisasi penghapusan…"}</span><progress
      max={manager.deleteProgress.total || 1}
      value={manager.deleteProgress.done}
      aria-label="Progres penghapusan gambar"
    /></div>}
    <footer className="media-pagination">
      <p>{manager.filtered.length ? `${(manager.page - 1) * manager.pageSize + 1}–${Math.min(manager.page * manager.pageSize, manager.filtered.length)} dari ${manager.filtered.length} gambar` : "0 gambar"}</p>
      <div><label><span>Per halaman</span><select
        className="field-input"
        aria-label="Gambar per halaman"
        disabled={disabled}
        value={manager.pageSize}
        onChange={(event) => manager.setPageSize(Number(event.target.value))}
      >{[12, 24, 48].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button
        type="button"
        className="btn-secondary"
        aria-label="Halaman sebelumnya"
        disabled={disabled || manager.page === 1}
        onClick={() => manager.setPage(manager.page - 1)}
      >←</button><span>{manager.page} / {manager.pages}</span><button
        type="button"
        className="btn-secondary"
        aria-label="Halaman berikutnya"
        disabled={disabled || manager.page >= manager.pages}
        onClick={() => manager.setPage(manager.page + 1)}
      >→</button></div>
    </footer>
    {manager.preview && manager.bucket && <MediaLightbox
      image={manager.preview}
      bucket={manager.bucket}
      url={manager.urls[manager.preview.path]}
      onClose={() => manager.setPreview(null)}
    />}
    <PhotoBackupDialog
      isOpen={showArchive}
      onClose={() => setShowArchive(false)}
      reports={props.reports}
    />
  </div>;
}
