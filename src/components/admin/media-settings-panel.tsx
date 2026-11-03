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

  const compressPercent = manager.compressProgress.total > 0
    ? Math.min(100, Math.round((manager.compressProgress.done / manager.compressProgress.total) * 100))
    : 0;
  const deletePercent = manager.deleteProgress.total > 0
    ? Math.min(100, Math.round((manager.deleteProgress.done / manager.deleteProgress.total) * 100))
    : 0;

  return <div className="media-settings">
    <div className="media-source-bar">
      <div className="media-source-selects">
        {manager.accountOptions.length > 1 && (
          <label className="media-compact-field">
            <span className="media-inline-label">Akun</span>
            <select
              className="field-input"
              value={manager.account}
              disabled={disabled}
              onChange={(event) => manager.setAccount(event.target.value as any)}
            >
              {manager.accountOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="media-compact-field">
          <span className="media-inline-label">Bucket</span>
          <select
            className="field-input"
            value={manager.bucketId}
            disabled={!manager.buckets.length || manager.deleting}
            onChange={(event) => manager.setBucketId(event.target.value)}
          >
            {!manager.buckets.length && <option value={manager.bucketId}>Memuat bucket…</option>}
            {manager.buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}
          </select>
        </label>
      </div>
      <div className="media-source-actions">
        <button
          type="button"
          className="btn-secondary media-btn-compact"
          disabled={!manager.bucket || disabled}
          onClick={() => void manager.load(true)}
          title="Pindai ulang seluruh berkas storage dan audit data"
        >
          {manager.loading ? <SpinnerIcon /> : <span aria-hidden="true">↻</span>}
          <span>Pindai ulang</span>
        </button>
        {manager.bucket?.id === "daily-report-proofs" && (
          <button
            type="button"
            className="btn-secondary media-btn-compact"
            disabled={manager.deleting}
            onClick={() => setShowArchive(true)}
            title="Unduh cadangan foto dalam format ZIP"
          >
            <span aria-hidden="true">📦</span>
            <span>Arsip ZIP</span>
          </button>
        )}
      </div>
    </div>
    <div className="media-metrics-card">
      <div className="media-metrics" aria-label="Ringkasan media">
        <div className="media-metric-cell">
          <span className="media-metric-title">Total gambar</span>
          <strong className="media-metric-value">{manager.scan ? manager.metrics.count.toLocaleString("id-ID") : "—"}</strong>
          <small className="media-metric-desc">Bucket aktif</small>
        </div>
        <div className="media-metric-cell">
          <span className="media-metric-title">Ukuran gambar</span>
          <strong className="media-metric-value">{manager.scan ? formatMediaBytes(manager.metrics.bytes) : "—"}</strong>
          <small className="media-metric-desc">
            {manager.scan && manager.metrics.heavyCount > 0 ? (
              <span className="media-heavy-highlight">
                ⚡ {manager.metrics.heavyCount} berkas &gt; 300 KB ({formatMediaBytes(manager.metrics.heavyBytes)})
              </span>
            ) : (
              "Semua berkas ≤ 300 KB"
            )}
          </small>
        </div>
        <div className="media-metric-cell media-metric-linked">
          <span className="media-metric-title">Terkait data</span>
          <strong className="media-metric-value">{manager.scan ? manager.metrics.linked.toLocaleString("id-ID") : "—"}</strong>
          <small className="media-metric-desc">Foto laporan &amp; TTD</small>
        </div>
        <div className="media-metric-cell media-metric-orphan">
          <span className="media-metric-title">File orphan</span>
          <strong className="media-metric-value">{manager.scan ? manager.metrics.orphans.toLocaleString("id-ID") : "—"}</strong>
          <small className="media-metric-desc">
            {manager.scan ? (manager.metrics.orphans > 0 ? `${formatMediaBytes(manager.metrics.orphanBytes)} tanpa referensi` : "Bersih / terpakai") : "Menunggu audit"}
          </small>
        </div>
      </div>
      <div className="media-audit-caption">
        <span className="media-audit-badge">{manager.account === "legacy" ? "Akun Lama (Arsip)" : "Akun Aktif"}</span>
        <span className="media-audit-dot" aria-hidden="true" />
        <p>{manager.scan ? <>Metadata {manager.scan.cached ? "dari cache sesi" : "pemindaian langsung"} · {formatWitaDateTime(new Date(manager.scan.scannedAt).toISOString())} WITA · Relasi diverifikasi lintas akun database.</> : "Pemindaian mencakup seluruh folder dan halaman berkas."}</p>
      </div>
    </div>

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
        <label className="media-select-month"><span className="sr-only">Filter bulan laporan</span><select
          className="field-input"
          aria-label="Filter bulan laporan"
          value={manager.monthFilter}
          disabled={disabled || !manager.availableMonths.length}
          onChange={(event) => manager.changeMonthFilter(event.target.value)}
        >
          <option value="all">Semua laporan ({manager.images.length.toLocaleString("id-ID")})</option>
          {manager.availableMonths.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label} ({item.count.toLocaleString("id-ID")})
            </option>
          ))}
        </select></label>
        <label className="media-select-sort"><span className="sr-only">Urutkan gambar</span><select
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
        <span className="media-selection-count" aria-live="polite">
          {manager.selectedImages.length} dipilih
          {manager.selectedLinked > 0 && ` · ${manager.selectedLinked} terkait data`}
          {manager.selectedImages.length > selectedOnPage && ` · ${manager.selectedImages.length - selectedOnPage} di halaman lain`}
          {manager.monthFilter !== "all" && (
            <span style={{ marginLeft: "6px", opacity: 0.85 }}>
              ({manager.availableMonths.find((m) => m.key === manager.monthFilter)?.label || manager.monthFilter})
            </span>
          )}
        </span>
        {manager.compressing && (
          <div className="media-batch-active-status" role="status">
            <SpinnerIcon />
            <span>
              Mengompresi {manager.compressProgress.done}/{manager.compressProgress.total} ({compressPercent}%)
              {manager.compressProgress.savedBytes > 0 && ` · Hemat ${formatMediaBytes(manager.compressProgress.savedBytes)}`}
            </span>
          </div>
        )}
        <div className="media-batch-actions">
          {Boolean(manager.filteredMetrics.heavyCount) && (
            <button
              type="button"
              className="btn-ghost"
              disabled={disabled || manager.compressing}
              onClick={manager.selectHeavyFiles}
              title={`Pilih semua berkas yang berukuran di atas 300 KB ${manager.monthFilter !== "all" ? "pada filter bulan ini" : "di bucket ini"}`}
            >Pilih &gt; 300 KB ({manager.filteredMetrics.heavyCount})</button>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={!manager.canDelete || !manager.filteredMetrics.orphans}
            onClick={manager.selectOrphans}
            title={`Pilih semua orphan ${manager.monthFilter !== "all" ? "pada filter bulan ini" : "di bucket ini"}`}
          >Pilih semua orphan ({manager.filteredMetrics.orphans})</button>
          {manager.selectedImages.length > 0 && <button
            type="button"
            className="btn-ghost"
            disabled={manager.deleting || manager.compressing}
            onClick={manager.resetSelection}
          >Batalkan pilihan</button>}
          {manager.selectedImages.some((f) => f.size > 300 * 1024) && (
            <button
              type="button"
              className="btn-secondary"
              disabled={disabled || manager.compressing || manager.deleting}
              onClick={() => void manager.compressFiles(manager.selectedImages)}
              title="Kompresi dan timpa berkas terpilih yang berukuran > 300 KB di storage"
            >
              {manager.compressing && <SpinnerIcon />}
              Kompres &amp; Timpa ({manager.selectedImages.filter((f) => f.size > 300 * 1024).length})
            </button>
          )}
          <button
            type="button"
            className="btn-danger"
            disabled={!manager.canDelete || !manager.selectedImages.length || manager.compressing}
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
    </> : <div className="media-empty-state"><h4>{manager.query || manager.filter !== "all" || manager.monthFilter !== "all" ? "Tidak ada gambar yang sesuai" : "Belum ada gambar dalam bucket ini"}</h4><p>{manager.query || manager.filter !== "all" || manager.monthFilter !== "all" ? "Sesuaikan kata pencarian atau filter keterkaitan dan bulan diunggah." : "Gambar yang tersimpan akan muncul setelah pemindaian."}</p></div>}

    {manager.compressing && (
      <aside className="media-progress-card" role="status" aria-live="polite">
        <div className="media-progress-card-header">
          <div className="media-progress-title-group">
            <div className="media-progress-pulse-icon">
              <SpinnerIcon />
            </div>
            <div>
              <h4 className="media-progress-title">Mengompresi &amp; Mengoptimalkan</h4>
              <p className="media-progress-subtitle">
                {manager.compressProgress.done} dari {manager.compressProgress.total} gambar diproses
              </p>
            </div>
          </div>
          <span className="media-progress-percent">{compressPercent}%</span>
        </div>
        <div className="media-progress-bar-track" aria-hidden="true">
          <div
            className="media-progress-bar-fill"
            style={{ width: `${compressPercent}%` }}
          >
            <div className="media-progress-shimmer" />
          </div>
        </div>
        <div className="media-progress-card-footer">
          {manager.compressProgress.savedBytes > 0 ? (
            <span className="media-progress-badge-saved">
              Hemat <strong>{formatMediaBytes(manager.compressProgress.savedBytes)}</strong>
            </span>
          ) : (
            <span className="media-progress-notice">Target berkas ≤ 300 KB</span>
          )}
          <span className="media-progress-notice">Mohon jangan tutup jendela</span>
        </div>
      </aside>
    )}

    {manager.deleting && (
      <aside className="media-progress-card media-delete-card" role="status" aria-live="polite">
        <div className="media-progress-card-header">
          <div className="media-progress-title-group">
            <div className="media-progress-pulse-icon delete-pulse">
              <SpinnerIcon />
            </div>
            <div>
              <h4 className="media-progress-title">Menghapus Berkas Storage</h4>
              <p className="media-progress-subtitle">
                {manager.deleteProgress.done ? `${manager.deleteProgress.done} dari ${manager.deleteProgress.total} gambar dihapus` : "Memeriksa referensi & otorisasi…"}
              </p>
            </div>
          </div>
          <span className="media-progress-percent">{deletePercent}%</span>
        </div>
        <div className="media-progress-bar-track" aria-hidden="true">
          <div
            className="media-progress-bar-fill delete-fill"
            style={{ width: `${deletePercent}%` }}
          >
            <div className="media-progress-shimmer" />
          </div>
        </div>
        <div className="media-progress-card-footer">
          <span className="media-progress-notice">Pemeriksaan integritas referensi aktif</span>
          <span className="media-progress-notice">Mohon jangan tutup jendela</span>
        </div>
      </aside>
    )}
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
      onCompress={(img) => void manager.compressFiles([img])}
      disabled={manager.compressing || manager.deleting}
    />}
    <PhotoBackupDialog
      isOpen={showArchive}
      onClose={() => setShowArchive(false)}
      reports={props.reports}
    />
  </div>;
}
