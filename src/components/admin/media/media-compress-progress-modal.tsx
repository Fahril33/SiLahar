import { useEffect, useRef } from "react";
import { formatMediaBytes } from "../../../lib/media-utils";
import type { CompressProgressState } from "../../../types/media";
import { SpinnerIcon } from "../shared";

export function MediaCompressProgressModal(props: {
  state: CompressProgressState;
  onAbort?: () => void;
  onClose: () => void;
}) {
  const { state, onAbort, onClose } = props;
  const listRef = useRef<HTMLDivElement>(null);

  const percent = state.total > 0 ? Math.min(100, Math.round((state.done / state.total) * 100)) : 0;

  // Auto-scroll to active item
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [state.currentFile, state.done]);

  if (!state.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compress-progress-title"
    >
      <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[var(--border-soft)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                  state.isFinished
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : state.isAborted
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 animate-pulse"
                }`}
              >
                {state.isFinished ? (
                  <span className="text-xl font-bold">✓</span>
                ) : state.isAborted ? (
                  <span className="text-xl font-bold">⚠️</span>
                ) : (
                  <SpinnerIcon className="w-5 h-5 animate-spin" />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  id="compress-progress-title"
                  className="text-base sm:text-lg font-bold truncate text-[var(--text-primary)]"
                >
                  {state.isFinished
                    ? "Optimalisasi & Kompresi Selesai"
                    : state.isAborted
                      ? "Kompresi Dibatalkan"
                      : "Mengompresi & Mengoptimalkan Media"}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] truncate mt-0.5">
                  {state.currentMessage || "Memproses berkas gambar di storage..."}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg sm:text-xl font-extrabold text-[var(--primary)] font-mono">
                {percent}%
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                {state.done} / {state.total} Berkas
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[var(--surface-muted)] h-2.5 rounded-full overflow-hidden border border-[var(--border-soft)]">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                state.isFinished
                  ? "bg-emerald-500"
                  : state.isAborted
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-[var(--surface-muted)]/50 border border-[var(--border-soft)]/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                Status
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5 truncate">
                {state.isFinished
                  ? "Selesai"
                  : state.isAborted
                    ? "Dibatalkan"
                    : "Berjalan"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-muted)]/50 border border-[var(--border-soft)]/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                Diproses
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5 truncate font-mono">
                {state.done} / {state.total}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-muted)]/50 border border-[var(--border-soft)]/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                Hemat Ruang
              </span>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate font-mono">
                {formatMediaBytes(state.savedBytes)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-muted)]/50 border border-[var(--border-soft)]/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                Target Ukuran
              </span>
              <p className="text-xs font-bold text-[var(--primary)] mt-0.5 truncate">
                ≤ 300 KB
              </p>
            </div>
          </div>
        </div>

        {/* Queue List (Scrollable) */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 flex flex-col space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
            <span>Daftar Berkas ({state.items.length})</span>
            {state.currentFile && !state.isFinished && (
              <span className="text-blue-500 font-normal truncate max-w-[240px]">
                Aktif: {state.currentFile}
              </span>
            )}
          </h4>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto rounded-xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)] bg-[var(--surface-panel-strong)] max-h-[300px]"
          >
            {state.items.map((item) => {
              const isProcessing = item.status === "processing";
              const isSuccess = item.status === "success";
              const isSkipped = item.status === "skipped";
              const isError = item.status === "error";

              return (
                <div
                  key={item.path}
                  data-active={isProcessing}
                  className={`p-3 flex items-center justify-between gap-3 text-xs transition ${
                    isProcessing
                      ? "bg-blue-500/10 dark:bg-blue-500/15"
                      : isSuccess
                        ? "bg-emerald-500/5"
                        : isError
                          ? "bg-rose-500/5"
                          : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {isProcessing ? (
                        <SpinnerIcon className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      ) : isSuccess ? (
                        <span className="text-emerald-500 font-bold text-sm">✓</span>
                      ) : isError ? (
                        <span className="text-rose-500 font-bold text-sm">✕</span>
                      ) : isSkipped ? (
                        <span className="text-slate-400 font-bold text-xs">—</span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">⏳</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-[var(--text-primary)]">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">
                        {item.path}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {isSuccess ? (
                      <div className="space-y-0.5">
                        <span className="font-mono text-slate-500 line-through mr-1.5 text-[11px]">
                          {formatMediaBytes(item.oldSize)}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {formatMediaBytes(item.newSize || 0)}
                        </span>
                        {item.savedBytes && item.savedBytes > 0 ? (
                          <p className="text-[10px] font-semibold text-emerald-500">
                            - {formatMediaBytes(item.savedBytes)}
                          </p>
                        ) : null}
                      </div>
                    ) : isProcessing ? (
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                        Mengompresi...
                      </span>
                    ) : isSkipped ? (
                      <span className="text-slate-400 text-[11px]">
                        ≤ 300 KB (Dilewati)
                      </span>
                    ) : isError ? (
                      <span
                        className="text-rose-500 font-semibold text-[11px]"
                        title={item.errorMessage}
                      >
                        {item.errorMessage || "Gagal"}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-mono">
                        {formatMediaBytes(item.oldSize)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-soft)] bg-[var(--surface-muted)]/30 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="select-none">🔒</span>
            <span>
              {state.isFinished
                ? "Optimalisasi storage selesai. Tampilan galeri telah diselaraskan."
                : "Mohon jangan menutup jendela browser selama proses berjalan."}
            </span>
          </p>

          <div className="flex items-center gap-2">
            {!state.isFinished && !state.isAborted && onAbort && (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={onAbort}
              >
                Batalkan Proses
              </button>
            )}

            {(state.isFinished || state.isAborted) && (
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={onClose}
              >
                Selesai &amp; Tutup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

