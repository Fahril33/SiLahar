import { useEffect, useRef, useState } from "react";
import { formatMediaBytes } from "../../../lib/media-utils";
import { formatWitaDate, formatWitaDateTime } from "../../../lib/time";
import type { MediaBucket, MediaImage } from "../../../types/media";
import { MediaStatus, MediaThumbnail } from "./media-file-list";

export function MediaLightbox(props: { image: MediaImage; bucket: MediaBucket; url?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copyState, setCopyState] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => setCopyState(""), [props.image.path]);

  async function copyUrl() {
    if (!props.url) return;
    try { await navigator.clipboard.writeText(props.url); setCopyState("Tautan berhasil disalin."); }
    catch { setCopyState("Tidak dapat mengakses clipboard. Gunakan tautan buka gambar."); }
  }

  return (
    <dialog
      ref={dialog}
      className="media-lightbox"
      aria-labelledby="media-preview-title"
      onCancel={(event) => { event.preventDefault(); props.onClose(); }}
    >
      <header className="media-lightbox-header">
        <div className="min-w-0"><p className="settings-eyebrow">Pratinjau gambar</p><h4 id="media-preview-title">{props.image.name}</h4></div>
        <button
          type="button"
          className="btn-secondary"
          onClick={props.onClose}
        >Tutup</button>
      </header>
      <div className="media-lightbox-body">
        <div className="media-lightbox-image"><MediaThumbnail src={props.url} name={props.image.name} /></div>
        <div className="media-lightbox-info">
          <MediaStatus image={props.image} />
          <dl className="media-metadata">
            <div><dt>Bucket</dt><dd>{props.bucket.id}</dd></div>
            <div><dt>Lokasi berkas</dt><dd className="font-mono">{props.image.path}</dd></div>
            <div><dt>Ukuran</dt><dd>{formatMediaBytes(props.image.size)} · {new Intl.NumberFormat("id-ID").format(props.image.size)} byte</dd></div>
            <div><dt>Format</dt><dd>{props.image.mimeType || "Tidak tersedia"}</dd></div>
            <div><dt>Diunggah (WITA)</dt><dd>{formatWitaDateTime(props.image.createdAt) || "Tidak tersedia"}</dd></div>
            <div><dt>Terakhir diperbarui</dt><dd>{formatWitaDateTime(props.image.updatedAt) || "Tidak tersedia"}</dd></div>
          </dl>
          <div className="media-related-records">
            <h5 className="settings-label">Referensi terkait ({props.image.references.length})</h5>
            {props.image.references.length ? <ul>{props.image.references.map((reference) => (
              <li key={reference.id}><strong>{reference.label}</strong>{reference.date && <span>{formatWitaDate(reference.date)}</span>}<code>ID: {reference.recordId}</code></li>
            ))}</ul> : <p className="settings-hint">Tidak ditemukan pada data laporan maupun tanda tangan.</p>}
          </div>
          <div className="media-lightbox-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={!props.url}
              onClick={() => void copyUrl()}
            >{props.bucket.public ? "Salin public URL" : "Salin tautan sementara"}</button>
            {props.url && <a
              className="btn-primary"
              href={props.url}
              target="_blank"
              rel="noopener noreferrer"
            >Buka gambar ↗</a>}
          </div>
          {!props.bucket.public && <p className="settings-hint">Tautan pratinjau bucket privat berlaku selama 5 menit.</p>}
          <p className="settings-hint" role="status">{copyState}</p>
        </div>
      </div>
    </dialog>
  );
}
