import { useEffect, useState } from "react";
import { formatMediaBytes, mediaStatusLabel } from "../../../lib/media-utils";
import { formatWitaDateTime } from "../../../lib/time";
import type { MediaImage } from "../../../types/media";

export function MediaThumbnail({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img
    src={src}
    alt={name}
    loading="lazy"
    decoding="async"
    onError={() => setFailed(true)}
  /> : (
    <span className="media-thumbnail-placeholder">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
      ><rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3"
        /><circle
          cx="8.5"
          cy="8.5"
          r="1.5"
        /><path d="m21 15-5-5L5 21" /></svg>
      <span>{failed ? "Pratinjau tidak tersedia" : "Memuat gambar…"}</span>
    </span>
  );
}

export function MediaStatus({ image }: { image: MediaImage }) {
  return <span className={`media-status media-status-${image.status}`}>{mediaStatusLabel(image.status)}</span>;
}

export function MediaFileList(props: {
  images: MediaImage[];
  urls: Record<string, string>;
  view: "grid" | "table";
  selected: Set<string>;
  disabled: boolean;
  canDelete: boolean;
  onToggle: (path: string) => void;
  onPreview: (image: MediaImage) => void;
  onDelete: (image: MediaImage) => void;
}) {
  const selection = (image: MediaImage) => <input
    type="checkbox"
    checked={props.selected.has(image.path)}
    disabled={props.disabled}
    onChange={() => props.onToggle(image.path)}
    aria-label={`Pilih ${image.path}`}
  />;
  const deleteButton = (image: MediaImage) => (
    <button
      type="button"
      className="media-delete-file"
      disabled={!props.canDelete}
      onClick={() => props.onDelete(image)}
      aria-label={`Hapus ${image.path}`}
      title="Hapus gambar"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      ><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
    </button>
  );

  if (props.view === "table") return (
    <div
      className="media-table-scroll"
      role="region"
      aria-label="Daftar media gambar"
      tabIndex={0}
    >
      <table className="media-table">
        <thead><tr><th scope="col"><span className="sr-only">Pilih</span></th><th scope="col">Nama berkas</th><th scope="col">Status</th><th scope="col">Ukuran</th><th scope="col">Diunggah (WITA)</th><th scope="col"><span className="sr-only">Aksi</span></th></tr></thead>
        <tbody>{props.images.map((image) => (
          <tr key={image.path} data-selected={props.selected.has(image.path)}>
            <td>{selection(image)}</td>
            <td><button
              type="button"
              className="media-table-file"
              onClick={() => props.onPreview(image)}
              disabled={props.disabled}
            >
              <span className="media-table-thumbnail"><MediaThumbnail src={props.urls[image.path]} name={image.name} /></span>
              <span className="min-w-0"><strong>{image.name}</strong><span className="media-file-path">{image.path}</span></span>
            </button></td>
            <td><MediaStatus image={image} /><span className="media-table-reference">{image.references.length ? `${image.references.length} referensi` : "—"}</span></td>
            <td className="whitespace-nowrap">{formatMediaBytes(image.size)}</td>
            <td className="whitespace-nowrap">{formatWitaDateTime(image.createdAt) || "—"}</td>
            <td>{deleteButton(image)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );

  return <div className="media-grid">{props.images.map((image) => (
    <article
      key={image.path}
      className="media-file-card"
      data-selected={props.selected.has(image.path)}
    >
      <div className="media-file-image">
        <button
          type="button"
          className="media-preview-button"
          onClick={() => props.onPreview(image)}
          disabled={props.disabled}
          aria-label={`Pratinjau ${image.name}`}
        >
          <MediaThumbnail src={props.urls[image.path]} name={image.name} />
        </button>
        <label className="media-card-checkbox">{selection(image)}<span className="sr-only">Pilih gambar</span></label>
        <div className="media-card-status"><MediaStatus image={image} /></div>
      </div>
      <div className="media-file-details">
        <button
          type="button"
          className="media-file-name"
          onClick={() => props.onPreview(image)}
          disabled={props.disabled}
          title={image.path}
        >{image.name}</button>
        <p className="media-file-path" title={image.path}>{image.path}</p>
        <div className="media-file-meta"><span>{formatMediaBytes(image.size)}</span><span>{image.references.length ? `${image.references.length} referensi` : "Tanpa referensi"}</span></div>
        <div className="media-file-footer"><time dateTime={image.createdAt}>{formatWitaDateTime(image.createdAt) || "Tanggal tidak tersedia"}</time>{deleteButton(image)}</div>
      </div>
    </article>
  ))}</div>;
}
