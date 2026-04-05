import { motion, AnimatePresence } from "framer-motion";
import { useConnectivity } from "../hooks/useConnectivity";

export function ConnectivityBanner() {
  const { isOnline, status, refresh, isChecking } = useConnectivity();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 48, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="fixed inset-x-0 bottom-6 z-[9999] p-4 pointer-events-none flex justify-center"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--warning-soft)] bg-[var(--surface-popover)]/80 px-4 py-2 text-[13px] font-medium text-[var(--warning)] shadow-2xl backdrop-blur-xl transition hover:border-[var(--warning)] hover:bg-[var(--surface-popover)]">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--warning)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--warning)]" />
            </div>
            <span>
              {status === "offline"
                ? "Ops! Perangkat Anda sedang luring (Offline)."
                : "Basis data sedang dalam sinkronisasi ulang..."}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isChecking}
              className="animate-spin-slow group ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--warning-soft)] text-xs text-[var(--warning)] transition hover:bg-[var(--warning)] hover:text-[var(--surface-popover)] disabled:opacity-40"
              title="Coba hubungkan kembali"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="h-3.5 w-3.5 transition-transform duration-500 "
              >
                <path
                  d="M23 4v6h-6M1 20v-6h6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
