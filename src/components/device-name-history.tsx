export function DeviceNameHistory(props: {
  names: string[];
  onPick: (name: string) => void;
}) {
  const { names, onPick } = props;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Riwayat Perangkat Ini</p>
        <p className="text-xs text-ink/50">{names.length} nama</p>
      </div>

      <div className="max-h-36 overflow-y-auto rounded-[22px] border border-emerald-100 bg-white/80 p-3 sm:max-h-40">
        {names.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onPick(name)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/60">Belum ada nama yang pernah disubmit dari perangkat ini.</p>
        )}
      </div>
    </div>
  );
}
