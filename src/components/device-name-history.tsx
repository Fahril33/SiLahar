export function DeviceNameHistory(props: {
  names: string[];
  onPick: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const { names, onPick, onRemove } = props;

  return (
    <div className="space-y-3">

      <div className="max-h-32 overflow-y-auto rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 sm:max-h-36 ">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Riwayat Perangkat Ini</p>
        <p className="text-xs text-[var(--text-muted)]">{names.length} nama</p>
      </div>
        {names.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <div key={name} className="group relative">
                <button
                  type="button"
                  onClick={() => onPick(name)}
                  className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 py-1.5 text-left text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--surface-accent)] group-hover:pr-9"
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(name);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  title="Hapus riwayat"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Belum ada nama yang pernah disubmit dari perangkat ini.</p>
        )}
      </div>
    </div>
  );
}
