import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatWitaDateTime } from "../lib/time";
import type { LocalReportDraftSummary } from "../types/local-draft";

function TrashIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function UploadIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileTextIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function PencilIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function XIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SpinnerIcon(props: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${props.className || "h-3.5 w-3.5"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function FileDownIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || "h-4 w-4"}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </svg>
  );
}

export interface LocalDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedLocalDrafts: LocalReportDraftSummary[];
  activeLocalDraftId?: string | null;
  pdfExportingDraftId?: string | null;
  onHandleLoadLocalDraft?: (draftId: string) => Promise<void> | void;
  onHandleDeleteLocalDraft?: (draftId: string) => Promise<void> | void;
  onHandleQueueLocalDraftUpload?: (draftId: string) => Promise<void> | void;
  onHandleDownloadLocalDraftPdf?: (draftId: string) => Promise<void> | void;
}

export function LocalDraftsModal(props: LocalDraftsModalProps) {
  const {
    isOpen,
    onClose,
    savedLocalDrafts = [],
    activeLocalDraftId,
    pdfExportingDraftId,
    onHandleLoadLocalDraft,
    onHandleDeleteLocalDraft,
    onHandleQueueLocalDraftUpload,
    onHandleDownloadLocalDraftPdf,
  } = props;

  const [draftSearchQuery, setDraftSearchQuery] = useState("");

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredDrafts = useMemo(() => {
    if (!draftSearchQuery.trim()) return savedLocalDrafts;
    const query = draftSearchQuery.toLowerCase();
    return savedLocalDrafts.filter(
      (d) =>
        d.title.toLowerCase().includes(query) ||
        d.reporterName.toLowerCase().includes(query) ||
        d.reportDate.toLowerCase().includes(query) ||
        d.displayDate.toLowerCase().includes(query),
    );
  }, [draftSearchQuery, savedLocalDrafts]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="surface-card rounded-[28px] border border-[var(--border-soft)] shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border-soft)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileTextIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[var(--text-primary)]">
                  Draft Lokal Tersimpan
                </h3>
                <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-xs font-extrabold">
                  {savedLocalDrafts.length}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Draft yang tersimpan di browser/perangkat ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0"
            title="Tutup"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Search Filter */}
        {savedLocalDrafts.length > 2 && (
          <div className="px-5 pt-4 shrink-0">
            <div className="flex items-center h-[42px] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-full px-3.5 shadow-sm gap-2 w-full">
              <SearchIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              <input
                type="text"
                value={draftSearchQuery}
                onChange={(e) => setDraftSearchQuery(e.target.value)}
                placeholder="Cari draft..."
                className="bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] w-full focus:ring-0 p-0"
              />
            </div>
          </div>
        )}

        {/* Modal Body: Scrollable Drafts List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-0 overscroll-contain">
          {filteredDrafts.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">
              {savedLocalDrafts.length === 0
                ? "Tidak ada draft yang tersimpan di perangkat ini."
                : "Tidak ada draft yang cocok dengan kata kunci pencarian."}
            </div>
          ) : (
            filteredDrafts.map((draft) => (
              <div
                key={draft.id}
                className="surface-card rounded-[22px] p-4 border border-[var(--border-soft)] shadow-sm hover:border-amber-500/40 transition-all flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[var(--text-primary)] truncate">
                      {draft.title || draft.reporterName || "Draft Tanpa Judul"}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium">
                      {draft.displayDate || draft.reportDate} • {draft.activityCount} Aktivitas
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Diperbarui {formatWitaDateTime(draft.updatedAt)}
                    </p>
                  </div>
                  <span
                    className={`status-pill text-[10px] shrink-0 ${
                      draft.uploadStatus === "uploading"
                        ? "status-pill-info"
                        : draft.uploadStatus === "queued"
                          ? "status-pill-warning"
                          : draft.uploadStatus === "failed"
                            ? "status-pill-danger"
                            : draft.uploadStatus === "uploaded"
                              ? "status-pill-success"
                              : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    }`}
                  >
                    {draft.uploadStatus === "uploading"
                      ? "Mengunggah..."
                      : draft.uploadStatus === "queued"
                        ? "Antrean Upload"
                        : draft.uploadStatus === "failed"
                          ? "Gagal Upload"
                          : draft.uploadStatus === "uploaded"
                            ? "Terunggah"
                            : "Draft Lokal"}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-[var(--border-soft)]/50 pt-2.5">
                  {onHandleLoadLocalDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        void onHandleLoadLocalDraft(draft.id);
                      }}
                      disabled={activeLocalDraftId === draft.id}
                      className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                      title="Buka dan Lanjutkan Draft"
                    >
                      {activeLocalDraftId === draft.id ? (
                        <SpinnerIcon />
                      ) : (
                        <PencilIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Buka Draft</span>
                    </button>
                  )}

                  {onHandleDownloadLocalDraftPdf && (
                    <button
                      type="button"
                      onClick={() => void onHandleDownloadLocalDraftPdf(draft.id)}
                      disabled={pdfExportingDraftId === draft.id}
                      className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                      title="Download Draft sebagai PDF"
                    >
                      {pdfExportingDraftId === draft.id ? (
                        <SpinnerIcon />
                      ) : (
                        <FileDownIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                  )}

                  {onHandleQueueLocalDraftUpload && draft.uploadStatus !== "uploaded" && (
                    <button
                      type="button"
                      onClick={() => void onHandleQueueLocalDraftUpload(draft.id)}
                      disabled={draft.uploadStatus === "queued" || draft.uploadStatus === "uploading"}
                      className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                      title="Upload ke Server"
                    >
                      {draft.uploadStatus === "uploading" ? (
                        <SpinnerIcon />
                      ) : (
                        <UploadIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Upload</span>
                    </button>
                  )}

                  {onHandleDeleteLocalDraft && (
                    <button
                      type="button"
                      onClick={() => void onHandleDeleteLocalDraft(draft.id)}
                      className="btn-danger px-3 py-1.5 text-xs flex items-center gap-1.5"
                      title="Hapus Draft"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-soft)] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
