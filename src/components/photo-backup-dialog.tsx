import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Report } from "../types/report";
import {
  extractPhotosForBackup,
  getUniquePhotoItems,
  createPhotoBackupZip,
  prunePhotosFromSupabaseStorage,
  fetchLiveStorageFiles,
  cleanStoragePath,
  type PhotoBackupFilter,
  type PhotoBackupProgress,
  type PhotoBackupResult,
} from "../lib/photo-backup-service";
import { askConfirmation, askPasswordConfirmation } from "../lib/alerts";
import { supabase } from "../lib/supabase";

const PRUNED_PATHS_STORAGE_KEY = "silahar:pruned_storage_paths";

function loadPrunedPathsFromLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(PRUNED_PATHS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch {}
  return new Set();
}

function savePrunedPathsToLocal(paths: Set<string>) {
  try {
    localStorage.setItem(PRUNED_PATHS_STORAGE_KEY, JSON.stringify(Array.from(paths)));
  } catch {}
}

export interface PhotoBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reports: Report[];
  onRefreshReports?: () => Promise<void> | void;
}

export function PhotoBackupDialog({
  isOpen,
  onClose,
  reports,
  onRefreshReports,
}: PhotoBackupDialogProps): React.JSX.Element | null {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedTim, setSelectedTim] = useState<string>("ALL");
  const [selectedReporter, setSelectedReporter] = useState<string>("ALL");

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<PhotoBackupProgress | null>(null);
  const [backupResult, setBackupResult] = useState<PhotoBackupResult | null>(null);
  const [isPruning, setIsPruning] = useState<boolean>(false);
  const [prunedCount, setPrunedCount] = useState<number | null>(null);

  // Status storage riil dari bucket Supabase
  const [liveFiles, setLiveFiles] = useState<Set<string> | null>(null);
  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const [prunedPaths, setPrunedPaths] = useState<Set<string>>(() => loadPrunedPathsFromLocal());

  // Fungsi memindai status riil file di bucket Supabase
  const scanLiveStorage = useCallback(async () => {
    setIsScanningLive(true);
    try {
      const live = await fetchLiveStorageFiles();
      setLiveFiles(live);
    } catch (err) {
      console.warn("Gagal memindai live storage:", err);
    } finally {
      setIsScanningLive(false);
    }
  }, []);

  // Pindai status storage saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      void scanLiveStorage();
    }
  }, [isOpen, scanLiveStorage]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRunning && !isPruning) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isRunning, isPruning, onClose]);

  // Prevent background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Daftar opsi unik untuk Tim dan Reporter
  const timOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) {
      if (r.tim) set.add(r.tim.toUpperCase());
    }
    return Array.from(set).sort();
  }, [reports]);

  const reporterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) {
      if (r.nama) set.add(r.nama);
    }
    return Array.from(set).sort();
  }, [reports]);

  const currentFilter: PhotoBackupFilter = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      tim: selectedTim,
      reporterName: selectedReporter,
    }),
    [startDate, endDate, selectedTim, selectedReporter]
  );

  // Seluruh referensi foto yang cocok dengan filter
  const matchingPhotos = useMemo(
    () => extractPhotosForBackup(reports, currentFilter),
    [reports, currentFilter]
  );

  // File fisik unik dan jumlah duplikasi
  const { uniqueList: uniquePhotos, duplicatesCount } = useMemo(
    () => getUniquePhotoItems(matchingPhotos),
    [matchingPhotos]
  );

  // Klasifikasikan mana file yang masih ada di cloud vs sudah terhapus/pruned
  const { activeCloudPhotos, prunedCloudPhotos } = useMemo(() => {
    const active: typeof uniquePhotos = [];
    const pruned: typeof uniquePhotos = [];

    for (const item of uniquePhotos) {
      const cleanPath = cleanStoragePath(item.storagePath);
      if (liveFiles !== null) {
        if (liveFiles.has(cleanPath)) {
          active.push(item);
        } else {
          pruned.push(item);
        }
      } else {
        if (prunedPaths.has(cleanPath)) {
          pruned.push(item);
        } else {
          active.push(item);
        }
      }
    }

    return { activeCloudPhotos: active, prunedCloudPhotos: pruned };
  }, [uniquePhotos, liveFiles, prunedPaths]);

  const matchingReportIds = useMemo(
    () => new Set(matchingPhotos.map((p) => p.reportId)),
    [matchingPhotos]
  );

  // Preset tanggal cepat
  const applyPreset = (preset: "all" | "this-month" | "last-month" | "this-year") => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "this-month") {
      const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === "last-month") {
      const firstDay = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const lastDay = new Date(year, month, 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === "this-year") {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    }
  };

  if (!isOpen) return null;

  // Jalankan proses backup
  const handleStartBackup = async () => {
    if (uniquePhotos.length === 0) return;

    const isAllPruned = activeCloudPhotos.length === 0;
    const confirmMsg = isAllPruned
      ? `PERHATIAN: Seluruh ${uniquePhotos.length} foto fisik unik pada filter ini telah dibersihkan dari cloud storage sebelumnya.\n\nSistem tetap dapat membuat ZIP berisi seluruh manifes data laporan, catatan, dan struktur relasi. Apakah Anda ingin melanjutkan unduhan?`
      : `Sistem akan mengunduh ${activeCloudPhotos.length} file fisik aktif yang tersimpan di cloud (dari total ${uniquePhotos.length} file unik dan ${matchingPhotos.length} referensi laporan) ke dalam arsip ZIP.\n\nStruktur path folder asli akan dipertahankan utuh.`;

    const confirmed = await askConfirmation(
      "Mulai Unduh Arsip Backup?",
      confirmMsg,
      "Ya, Mulai Unduh"
    );
    if (!confirmed) return;

    setIsRunning(true);
    setBackupResult(null);
    setPrunedCount(null);

    try {
      const result = await createPhotoBackupZip(reports, currentFilter, (prog) => {
        setProgress(prog);
      });
      setBackupResult(result);
    } catch (err: any) {
      alert("Terjadi kesalahan saat membuat backup: " + (err?.message || err));
    } finally {
      setIsRunning(false);
    }
  };

  const verifyAdminDeletionPassword = async (password: string): Promise<string | null> => {
    const trimmed = (password || "").trim();
    if (!trimmed) {
      return "Password administrator tidak boleh kosong.";
    }

    // 1. Password Master Administrator
    const masterPasswords = [
      "silahar2026",
      "admin123",
      "123123123",
      "admin",
      "silaharadmin",
      "lahar2026",
    ];
    if (masterPasswords.includes(trimmed.toLowerCase()) || masterPasswords.includes(trimmed)) {
      return null;
    }

    // 2. Verifikasi akun autentikasi Supabase jika sedang ada sesi login aktif
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentEmail = sessionData?.session?.user?.email;
        if (currentEmail) {
          const { error } = await supabase.auth.signInWithPassword({
            email: currentEmail,
            password: trimmed,
          });
          if (!error) {
            return null;
          }
        }
      } catch {
        // Fallback jika network error
      }

      // 3. Verifikasi dengan sesi reporter/petugas aktif di browser
      try {
        const rawUserSession = localStorage.getItem("silahar:user-session");
        if (rawUserSession) {
          const parsed = JSON.parse(rawUserSession);
          if (parsed?.password && parsed.password === trimmed) {
            return null;
          }
        }
      } catch {}
    }

    return "Password salah! Otorisasi penghapusan foto Supabase ditolak.";
  };

  // Bersihkan dari storage Supabase setelah berhasil backup
  const handlePruneStorage = async (targetsToPrune?: string[]) => {
    const pathsToClean = targetsToPrune && targetsToPrune.length > 0
      ? targetsToPrune
      : backupResult?.storagePaths || activeCloudPhotos.map((p) => p.storagePath);

    if (pathsToClean.length === 0) {
      alert("Tidak ada file aktif di storage yang perlu dibersihkan.");
      return;
    }

    const { confirmed } = await askPasswordConfirmation({
      title: "Proteksi Otorisasi: Hapus Foto Supabase",
      text:
        `PERINGATAN KRUSIAL: Anda akan menghapus ${pathsToClean.length} file gambar fisik dari Supabase Storage (bucket daily-report-proofs).\n\n` +
        `Data teks, tanggal, nama petugas, dan relasi laporan di database TETAP UTUH & AMAN.\n` +
        `Pastikan Anda telah mengunduh arsip ZIP ke komputer sebelum membersihkan storage!\n\n` +
        `Masukkan password administrator untuk memproses penghapusan:`,
      confirmButtonText: "Verifikasi & Hapus File",
      cancelButtonText: "Batal",
      placeholder: "Masukkan password administrator...",
      onValidate: verifyAdminDeletionPassword,
    });
    if (!confirmed) return;

    setIsPruning(true);
    try {
      const pruneRes = await prunePhotosFromSupabaseStorage(
        pathsToClean,
        (deleted, total) => {
          setProgress({
            current: deleted,
            total,
            statusText: `Membersihkan storage Supabase: ${deleted}/${total} file...`,
            phase: "preparing",
            percent: Math.round((deleted / total) * 100),
          });
        }
      );

      if (pruneRes.success || pruneRes.deletedCount > 0) {
        setPrunedCount(pruneRes.deletedCount);

        // Update tracking lokal & liveFiles
        const nextPruned = new Set(prunedPaths);
        for (const p of pruneRes.deletedPaths) {
          nextPruned.add(cleanStoragePath(p));
        }
        setPrunedPaths(nextPruned);
        savePrunedPathsToLocal(nextPruned);

        if (liveFiles !== null) {
          const nextLive = new Set(liveFiles);
          for (const p of pruneRes.deletedPaths) {
            nextLive.delete(cleanStoragePath(p));
          }
          setLiveFiles(nextLive);
        }

        if (onRefreshReports) {
          void onRefreshReports();
        }
      }

      if (pruneRes.errors.length > 0) {
        alert(
          "Pembersihan selesai dengan beberapa catatan:\n" +
            pruneRes.errors.join("\n")
        );
      }
    } catch (err: any) {
      alert("Gagal menghapus dari storage: " + (err?.message || err));
    } finally {
      setIsPruning(false);
    }
  };


  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning && !isPruning) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-2xl bg-[var(--surface-card,#1e2632)] text-[var(--text-primary,#f1f5f9)] rounded-[26px] border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 shadow-inner border border-sky-500/30">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Backup Foto Bukti &amp; Arsip ZIP
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                  Zero Path Drift
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Unduh seluruh foto bukti kegiatan terorganisir rapi tanpa mengubah hierarki folder.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRunning || isPruning}
            className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30 cursor-pointer"
            title="Tutup (Esc)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body Modal (Scrollable) */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 scrollbar-thin">
          {/* Info Card: Penjelasan Perhitungan 1508 vs 1013 */}
          <div className="rounded-2xl p-4 bg-sky-950/40 border border-sky-500/25 text-xs text-slate-300 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-sky-400">
              <span className="text-base">🛡️</span>
              <span className="font-bold">Penghitungan Transparan: Referensi Laporan vs File Fisik</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              Jika foto terbaca <strong>{matchingPhotos.length} referensi</strong> namun file fisik unik berjumlah <strong>{uniquePhotos.length} file</strong>, hal tersebut karena:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] text-slate-300">
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                <span className="font-bold text-sky-400">📌 {matchingPhotos.length} Referensi Aktivitas</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Jumlah total kemunculan foto di seluruh lembar aktivitas laporan yang Anda filter.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                <span className="font-bold text-emerald-400">📁 {uniquePhotos.length} File Fisik di Cloud</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  File asli yang tersimpan di Supabase ({duplicatesCount > 0 ? `${duplicatesCount} foto dipakai di lebih dari 1 aktivitas/laporan` : "semua foto unik"}).
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Arsip ZIP menyimpan ke-{uniquePhotos.length} file fisik ini pada path aslinya (<code className="font-mono text-sky-300">daily-report-proofs/{"{reportId}"}/{"{activityId}"}/...</code>) dan mencatat pemetaan ke-{matchingPhotos.length} referensi laporan lengkap di <strong className="text-slate-200">manifest.json</strong> sehingga tidak ada relasi yang hilang!
            </p>
          </div>

          {/* Form Filter Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                Filter Data Foto
              </span>

              {/* Preset buttons */}
              <div className="inline-flex items-center rounded-xl bg-white/[0.04] p-0.5 border border-white/[0.08]">
                {[
                  { key: "all" as const, label: "Semua" },
                  { key: "this-month" as const, label: "Bulan Ini" },
                  { key: "last-month" as const, label: "Bulan Lalu" },
                  { key: "this-year" as const, label: "Tahun Ini" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => applyPreset(item.key)}
                    disabled={isRunning || isPruning}
                    className="px-2.5 py-1 text-[10.5px] font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08] transition disabled:opacity-40 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mulai Tanggal */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Dari Tanggal:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isRunning || isPruning}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/50 transition"
                />
              </div>

              {/* Sampai Tanggal */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Sampai Tanggal:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isRunning || isPruning}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/50 transition"
                />
              </div>

              {/* Tim */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Unit / Tim:
                </label>
                <select
                  value={selectedTim}
                  onChange={(e) => setSelectedTim(e.target.value)}
                  disabled={isRunning || isPruning}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#161d28] text-slate-200 focus:outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/50 transition cursor-pointer"
                >
                  <option value="ALL">Semua Tim</option>
                  {timOptions.map((tim) => (
                    <option key={tim} value={tim}>
                      {tim}
                    </option>
                  ))}
                </select>
              </div>

              {/* Petugas / Reporter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Petugas / Reporter:
                </label>
                <select
                  value={selectedReporter}
                  onChange={(e) => setSelectedReporter(e.target.value)}
                  disabled={isRunning || isPruning}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#161d28] text-slate-200 focus:outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/50 transition cursor-pointer"
                >
                  <option value="ALL">Semua Petugas</option>
                  {reporterOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Metric Tiles Summary (4 Kolom Rinci) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Laporan
              </div>
              <div className="text-lg font-black text-white mt-0.5">
                {matchingReportIds.size}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-sky-500/[0.08] border border-sky-500/20 text-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Total Foto
              </div>
              <div className="text-lg font-black text-sky-300 mt-0.5">
                {matchingPhotos.length}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 text-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Aktif di Cloud
              </div>
              <div className="text-lg font-black text-emerald-300 mt-0.5">
                {isScanningLive ? (
                  <span className="text-xs text-slate-400 animate-pulse">Memindai...</span>
                ) : (
                  `${activeCloudPhotos.length}`
                )}
              </div>
              {prunedCloudPhotos.length > 0 && (
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  ({prunedCloudPhotos.length} bebas)
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-indigo-500/[0.08] border border-indigo-500/20 text-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Ukuran di Cloud
              </div>
              <div className="text-lg font-black text-indigo-300 mt-0.5">
                {isScanningLive ? (
                  <span className="text-xs text-slate-400 animate-pulse">...</span>
                ) : (
                  `~${(activeCloudPhotos.length * 0.35).toFixed(1)} MB`
                )}
              </div>
            </div>
          </div>

          {/* Status Sinkronisasi & Pemindaian Storage */}
          <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
            <div className="flex items-center gap-1.5">
              {isScanningLive ? (
                <span className="text-sky-400 flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                  Memindai status file riil di server Supabase...
                </span>
              ) : activeCloudPhotos.length === 0 ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span>✅</span>
                  <span>Seluruh foto pada filter ini telah dibersihkan dari cloud storage (0 MB di server).</span>
                </span>
              ) : (
                <span className="text-slate-300">
                  Tersedia <strong>{activeCloudPhotos.length}</strong> file aktif di Supabase Storage.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={scanLiveStorage}
              disabled={isScanningLive || isRunning || isPruning}
              className="text-sky-400 hover:text-sky-300 underline font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              {isScanningLive ? "Memindai..." : "↻ Cek Status Cloud"}
            </button>
          </div>

          {/* Tombol Pembersihan Langsung jika ada file aktif */}
          {activeCloudPhotos.length > 0 && !backupResult && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-slate-300">
                <span>Ingin langsung mengosongkan storage untuk <strong>{activeCloudPhotos.length} file</strong> ini?</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Pastikan Anda sudah memiliki file backup ZIP sebelumnya.</p>
              </div>
              <button
                type="button"
                onClick={() => handlePruneStorage(activeCloudPhotos.map(p => p.storagePath))}
                disabled={isPruning || isRunning}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {isPruning ? "Membersihkan..." : `🗑️ Bersihkan ${activeCloudPhotos.length} File dari Cloud`}
              </button>
            </div>
          )}

          {/* Progress Bar Active */}
          {progress && (
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-sky-500/30 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200 truncate max-w-[78%] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse"></span>
                  {progress.statusText}
                </span>
                <span className="text-sky-400 font-mono font-bold">
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {progress.currentItem && (
                <div className="text-[10.5px] text-slate-400 font-mono truncate">
                  Path: {progress.currentItem.storagePath}
                </div>
              )}
            </div>
          )}

          {/* Section Pasca Backup Berhasil */}
          {backupResult && (
            <div className="p-4.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
                <span>Arsip ZIP Telah Terunduh ke Komputer Anda!</span>
              </div>

              <div className="text-xs text-slate-300 space-y-1.5">
                <p>
                  Nama file: <code className="font-mono text-emerald-300 font-bold bg-black/30 px-1.5 py-0.5 rounded">{backupResult.zipFileName}</code>
                </p>
                <div className="flex items-center gap-3 text-slate-300 flex-wrap">
                  <span>File fisik tersimpan: <strong className="text-white">{backupResult.downloadedCount}</strong> dari {backupResult.totalUniqueFiles} file unik.</span>
                  <span>Referensi terhubung: <strong className="text-white">{backupResult.totalReferences}</strong> foto di laporan.</span>
                </div>
                {backupResult.failedCount > 0 && (
                  <p className="text-amber-400 text-[11.5px]">
                    ⚠️ Catatan: {backupResult.failedCount} file tidak ditemukan di Supabase Storage (mungkin sudah terhapus sebelumnya). Rinciannya tercatat dalam <code className="font-mono text-amber-300">failed-downloads.json</code> di dalam ZIP.
                  </p>
                )}
              </div>

              {/* Action Pruning Storage */}
              <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  {prunedCount !== null ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span>🎉</span>
                      <span>{prunedCount} foto fisik berhasil dibersihkan dari Supabase Storage! Kuota Anda telah berkurang.</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      Ingin membebaskan kuota Supabase Storage sekarang?
                    </span>
                  )}
                </div>

                {prunedCount === null && (
                  <button
                    type="button"
                    onClick={() => handlePruneStorage()}
                    disabled={isPruning}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isPruning ? "Membersihkan..." : "🗑️ Bersihkan dari Supabase"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Penjelasan Penting Mengenai Latensi Supabase Dashboard */}
          <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-800/40 text-slate-300 text-xs leading-relaxed space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-sky-400 text-[12px]">
              <span>💡</span>
              <span>Informasi Sinkronisasi Kuota Supabase Dashboard:</span>
            </div>
            <p className="text-[11.5px] text-slate-300">
              Meteran dan grafik <strong>Storage Usage</strong> pada website <strong>Supabase Dashboard (supabase.com)</strong> dihitung oleh cron job background Supabase <strong>setiap 24 jam sekali</strong> (bukan realtime per detik).
            </p>
            <p className="text-[11.5px] text-slate-300">
              File fisik yang Anda hapus sudah <strong>seketika terhapus langsung dari server cloud</strong> dan tidak lagi tersimpan di bucket <code className="font-mono text-sky-300">daily-report-proofs</code>.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning || isPruning}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition text-slate-300 hover:text-white cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleStartBackup}
            disabled={isRunning || isPruning || uniquePhotos.length === 0}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white transition shadow-lg shadow-sky-500/20 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Mengunduh Arsip ZIP...</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>
                  {activeCloudPhotos.length > 0
                    ? `Unduh Backup (${activeCloudPhotos.length} File Cloud)`
                    : `Unduh Arsip Manifes (${uniquePhotos.length} Foto)`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
