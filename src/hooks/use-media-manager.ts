import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminSessionState } from "../types/admin";
import type {
  MediaAccountTarget,
  MediaBucket,
  MediaFilter,
  MediaImage,
  MediaMonthOption,
  MediaReference,
  MediaScan,
  MediaSort,
} from "../types/media";
import { askConfirmation, askPasswordConfirmation, showError, showSuccess } from "../lib/alerts";
import {
  correlateMedia,
  formatMediaBytes,
  formatMediaMonthLabel,
  getImageReportMonthKeys,
} from "../lib/media-utils";
import {
  compressAndOverwriteMediaImages,
  deleteMediaImages,
  fetchMediaBuckets,
  fetchMediaReferences,
  getCachedMediaReferences,
  getMediaAccountOptions,
  getMediaImageUrls,
  getMediaImageUrlSync,
  getScanCacheKey,
  readScanCache,
  scanStorageImages,
  verifyMediaDeletionPassword,
  type VerifiedMediaAccess,
} from "../lib/media-service";

type Snapshot = { account: MediaAccountTarget; bucketId: string; scan: MediaScan; references: MediaReference[] };

export function useMediaManager(admin: AdminSessionState, onBusyChange: (busy: boolean) => void, onRefreshReports?: () => Promise<void>) {
  const [account, setAccountState] = useState<MediaAccountTarget>(() => {
    return (localStorage.getItem("silahar:media-account") as MediaAccountTarget) || "primary";
  });
  const accountOptions = useMemo(() => getMediaAccountOptions(), []);
  const [buckets, setBuckets] = useState<MediaBucket[]>([]);
  const [bucketId, setBucketId] = useState(() => localStorage.getItem("silahar:media-bucket") || "daily-report-proofs");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scannedFiles, setScannedFiles] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [sort, setSort] = useState<MediaSort>("newest");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaImage | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [urlError, setUrlError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState({ done: 0, total: 0, savedBytes: 0 });
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const operationLock = useRef(false);
  const bucket = buckets.find((item) => item.id === bucketId) ?? null;

  const setAccount = useCallback((next: MediaAccountTarget) => {
    setAccountState(next);
    localStorage.setItem("silahar:media-account", next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void fetchMediaBuckets(account).then((items) => {
      if (!mounted.current) return;
      setBuckets(items);
      setBucketId((id) => items.some((item) => item.id === id) ? id : items[0]?.id || "");
      if (!items.length) { setError("Tidak ada bucket gambar yang dapat diakses."); setLoading(false); }
    }).catch((reason: unknown) => {
      if (mounted.current) { setError(reason instanceof Error ? reason.message : "Daftar bucket gagal dimuat."); setLoading(false); }
    });
    return () => { mounted.current = false; request.current?.abort(); };
  }, [account]);

  const load = useCallback(async (force = false) => {
    if (!bucket) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    // Fast path: Immediately apply cached scan and references if available to eliminate blocking reloads
    if (!force) {
      const cacheKey = getScanCacheKey(bucket, admin.user.id, account);
      const cachedScan = readScanCache(cacheKey);
      const cachedRefs = bucket.auditable ? getCachedMediaReferences() : [];
      if (cachedScan && (!bucket.auditable || cachedRefs)) {
        setSnapshot({ account, bucketId: bucket.id, scan: cachedScan, references: cachedRefs || [] });
        setLoading(false);
        setError("");
        const available = new Set(cachedScan.files.map((file) => file.path));
        setSelected((previous) => new Set([...previous].filter((path) => available.has(path))));
        return;
      }
    }

    setLoading(true);
    setError("");
    setScannedFiles(0);
    try {
      const [scan, references] = await Promise.all([
        scanStorageImages(bucket, admin.user.id, {
          force,
          signal: controller.signal,
          account,
          onProgress: (count) => { if (!controller.signal.aborted) setScannedFiles(count); },
        }),
        bucket.auditable ? fetchMediaReferences() : Promise.resolve([]),
      ]);
      if (controller.signal.aborted || !mounted.current) return;
      setSnapshot({ account, bucketId: bucket.id, scan, references });
      const available = new Set(scan.files.map((file) => file.path));
      setSelected((previous) => new Set([...previous].filter((path) => available.has(path))));
    } catch (reason) {
      if (controller.signal.aborted || !mounted.current) return;
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "Pemindaian media gagal.");
    } finally {
      if (!controller.signal.aborted && mounted.current) setLoading(false);
    }
  }, [bucket, admin.user.id, account]);

  useEffect(() => {
    setSelected(new Set()); setPreview(null); setPage(1); setFilter("all"); setMonthFilter("all"); setQuery("");
    localStorage.setItem("silahar:media-bucket", bucketId);
    void load();
    return () => request.current?.abort();
  }, [bucketId, load]);

  const isBusy = deleting || compressing;
  useEffect(() => {
    onBusyChange(isBusy);
    if (!isBusy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isBusy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const currentSnapshot = snapshot && snapshot.account === account && snapshot.bucketId === bucketId ? snapshot : null;
  const images = useMemo(() => bucket && currentSnapshot
    ? correlateMedia(currentSnapshot.scan.files, currentSnapshot.references, bucket.id, bucket.auditable)
    : [], [bucket, currentSnapshot]);
  const metrics = useMemo(() => ({
    count: images.length,
    bytes: images.reduce((sum, file) => sum + file.size, 0),
    linked: images.filter((file) => file.status === "linked").length,
    orphans: images.filter((file) => file.status === "orphan").length,
    orphanBytes: images.filter((file) => file.status === "orphan").reduce((sum, file) => sum + file.size, 0),
    heavyCount: images.filter((file) => file.size > 300 * 1024).length,
    heavyBytes: images.filter((file) => file.size > 300 * 1024).reduce((sum, file) => sum + file.size, 0),
  }), [images]);

  const availableMonths = useMemo<MediaMonthOption[]>(() => {
    const counts = new Map<string, number>();
    let unlinkedCount = 0;
    let masterCount = 0;

    for (const file of images) {
      const keys = getImageReportMonthKeys(file);
      for (const key of keys) {
        if (key === "unlinked") {
          unlinkedCount += 1;
        } else if (key === "master") {
          masterCount += 1;
        } else {
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }

    const list: MediaMonthOption[] = Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: formatMediaMonthLabel(key),
        count,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));

    if (masterCount > 0) {
      list.push({ key: "master", label: "Tanda tangan master", count: masterCount });
    }
    if (unlinkedCount > 0) {
      list.push({ key: "unlinked", label: "Tidak terkait laporan (Orphan)", count: unlinkedCount });
    }
    return list;
  }, [images]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("id-ID");
    const files = images.filter((file) => {
      if (filter !== "all" && file.status !== filter) return false;
      if (monthFilter !== "all") {
        const fileKeys = getImageReportMonthKeys(file);
        if (!fileKeys.includes(monthFilter)) return false;
      }
      if (keyword) {
        const target = `${file.name} ${file.path} ${file.references.map((ref) => `${ref.label} ${ref.recordId} ${ref.date || ""}`).join(" ")}`.toLocaleLowerCase("id-ID");
        if (!target.includes(keyword)) return false;
      }
      return true;
    });
    return files.sort((a, b) => {
      const timeA = Date.parse(a.createdAt) || 0;
      const timeB = Date.parse(b.createdAt) || 0;
      const order = sort === "name" ? a.name.localeCompare(b.name, "id") : sort === "largest" ? b.size - a.size : sort === "smallest" ? a.size - b.size : sort === "oldest" ? timeA - timeB : timeB - timeA;
      return order || a.path.localeCompare(b.path);
    });
  }, [images, query, filter, monthFilter, sort]);

  const activePool = monthFilter !== "all" || filter !== "all" || query ? filtered : images;

  const filteredMetrics = useMemo(() => ({
    count: filtered.length,
    bytes: filtered.reduce((sum, file) => sum + file.size, 0),
    linked: filtered.filter((file) => file.status === "linked").length,
    orphans: filtered.filter((file) => file.status === "orphan").length,
    orphanBytes: filtered.filter((file) => file.status === "orphan").reduce((sum, file) => sum + file.size, 0),
    heavyCount: filtered.filter((file) => file.size > 300 * 1024).length,
    heavyBytes: filtered.filter((file) => file.size > 300 * 1024).reduce((sum, file) => sum + file.size, 0),
  }), [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedImages = activePool.filter((file) => selected.has(file.path));
  const selectedLinked = selectedImages.filter((file) => file.status === "linked").length;

  // Pastikan berkas yang terpilih selalu dibatasi oleh batas filter bulan dan pencarian aktif
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const allowed = new Set(activePool.map((f) => f.path));
      const next = new Set([...prev].filter((p) => allowed.has(p)));
      return next.size === prev.size ? prev : next;
    });
  }, [activePool]);

  const canDelete = Boolean(bucket?.auditable && currentSnapshot && !loading && !error && !deleting);
  const canCompress = Boolean(bucket?.auditable && currentSnapshot && !deleting);
  const pathsToPreview = JSON.stringify([...new Set([...visible.map((file) => file.path), ...(preview ? [preview.path] : [])])].sort());

  const urlsRef = useRef<Record<string, string>>({});
  urlsRef.current = urls;

  // Clear URLs cache only when switching bucket or account
  useEffect(() => {
    setUrls({});
    urlsRef.current = {};
    setUrlError("");
  }, [bucketId, account]);

  useEffect(() => {
    if (!bucket) return;
    const paths = (JSON.parse(pathsToPreview) as string[]).filter(Boolean);
    if (!paths.length) return;

    // Instant synchronous URL resolution for public buckets
    if (bucket.public) {
      const missing = paths.filter((path) => !urlsRef.current[path]);
      if (missing.length) {
        const generated: Record<string, string> = {};
        for (const path of missing) {
          generated[path] = getMediaImageUrlSync(bucket, path, account);
        }
        setUrls((previous) => ({ ...previous, ...generated }));
      }
      return;
    }

    // Signed URLs resolution for private buckets (accumulative, no blanket clearing on pagination)
    let active = true;
    const missing = paths.filter((path) => !urlsRef.current[path]);
    if (!missing.length) return;

    const resolveUrls = () => {
      void getMediaImageUrls(bucket, missing, account).then((value) => {
        if (active) setUrls((previous) => ({ ...previous, ...value }));
      }).catch((reason: unknown) => { if (active) setUrlError(reason instanceof Error ? reason.message : "Pratinjau gagal dimuat."); });
    };
    resolveUrls();
    const timer = window.setInterval(resolveUrls, 240000);
    return () => { active = false; window.clearInterval(timer); };
  }, [bucket, pathsToPreview, account]);

  const resetSelection = () => setSelected(new Set());
  const changeFilter = (value: MediaFilter) => { setFilter(value); setPage(1); resetSelection(); };
  const changeMonthFilter = (value: string) => { setMonthFilter(value); setPage(1); resetSelection(); };
  const changeQuery = (value: string) => { setQuery(value); setPage(1); resetSelection(); };
  const toggleFile = (path: string) => setSelected((previous) => {
    const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next;
  });
  const togglePage = () => setSelected((previous) => {
    const next = new Set(previous);
    const allSelected = visible.every((file) => next.has(file.path));
    visible.forEach((file) => allSelected ? next.delete(file.path) : next.add(file.path));
    return next;
  });

  async function removeFiles(targets: MediaImage[]) {
    if (!bucket || !canDelete || !targets.length || operationLock.current) return;
    operationLock.current = true;
    setDeleting(true); setDeleteProgress({ done: 0, total: targets.length });
    let access: VerifiedMediaAccess | null = null;
    try {
      // Never authorize deletion from the five-minute metadata cache or cached reports.
      const references = await fetchMediaReferences(true);
      const latest = correlateMedia(targets, references, bucket.id, true);
      const linked = latest.filter((file) => file.status === "linked").length;
      const totalBytes = latest.reduce((sum, file) => sum + file.size, 0);
      const description = `${latest.length} gambar (${formatMediaBytes(totalBytes)}): ${linked} terkait data dan ${latest.length - linked} orphan. Penghapusan permanen.`;
      if (linked) {
        const result = await askPasswordConfirmation({
          title: "Hapus gambar terkait data?",
          text: `${description} Foto pada laporan atau tanda tangan terkait tidak akan dapat ditampilkan lagi. Masukkan password akun administrator yang sedang masuk.`,
          confirmButtonText: "Verifikasi dan hapus",
          onValidate: async (password) => {
            try { access = await verifyMediaDeletionPassword(password, admin.user.id); return null; }
            catch (reason) { return reason instanceof Error ? reason.message : "Verifikasi gagal."; }
          },
        });
        if (!result.confirmed) return;
      } else if (!await askConfirmation("Hapus gambar orphan?", `${description} Berkas ini tidak ditemukan dalam referensi laporan dan tanda tangan saat pemeriksaan terakhir.`, "Hapus gambar")) return;
      const result = await deleteMediaImages(bucket, latest, admin.user.id, access, account, (done, total) => {
        if (mounted.current) setDeleteProgress({ done, total });
      });
      if (mounted.current) {
        setPreview(null);
        setSelected(new Set(result.failed));
        setUrls((prev) => {
          const next = { ...prev };
          for (const path of result.deleted) {
            delete next[path];
            delete urlsRef.current[path];
          }
          return next;
        });
        await load(true);
      }
      if (result.deleted.length && onRefreshReports) {
        try { await onRefreshReports(); } catch { /* The storage audit already reflects confirmed removals. */ }
      }
      if (result.failed.length) await showError("Sebagian gambar belum terhapus", `${result.deleted.length} gambar terhapus; ${result.failed.length} gagal atau ditolak oleh izin storage. Berkas yang masih tersedia tetap dipilih untuk diperiksa kembali.`);
      else await showSuccess("Gambar dihapus", `${result.deleted.length} gambar telah dihapus dari storage.`);
    } catch (reason) {
      await showError("Penghapusan dibatalkan", reason instanceof Error ? reason.message : "Gambar tidak berhasil dihapus.");
    } finally {
      const verified = access as VerifiedMediaAccess | null;
      if (verified) await verified.client.auth.signOut({ scope: "local" }).catch(() => { });
      operationLock.current = false;
      if (mounted.current) setDeleting(false);
    }
  }

  async function compressFiles(targets: MediaImage[]) {
    if (!bucket || !canCompress || operationLock.current || !targets.length) return;
    const heavy = targets.filter((f) => f.size > 300 * 1024);
    if (!heavy.length) {
      await showSuccess("Sudah optimal", "Semua gambar yang dipilih sudah berukuran <= 300 KB.");
      return;
    }

    const totalHeavyBytes = heavy.reduce((sum, f) => sum + f.size, 0);
    const confirmed = await askConfirmation(
      "Kompres dan timpa berkas gambar?",
      `${heavy.length} gambar (> 300 KB, total ${formatMediaBytes(totalHeavyBytes)}) akan diunduh, dikompresi di browser menjadi <= 300 KB, dan diunggah kembali menimpa file lama di storage. Lokasi berkas dan referensi laporan tidak berubah.`,
      "Kompres & Timpa",
    );
    if (!confirmed) return;

    operationLock.current = true;
    setCompressing(true);
    setCompressProgress({ done: 0, total: heavy.length, savedBytes: 0 });

    try {
      const result = await compressAndOverwriteMediaImages(
        bucket,
        heavy,
        admin.user.id,
        account,
        (done, total, savedBytes) => {
          if (mounted.current) setCompressProgress({ done, total, savedBytes });
        },
      );

      if (mounted.current) {
        // Invalidate URL preview cache and bust browser HTTP cache with timestamp
        const timestamp = Date.now();
        const updatedUrls: Record<string, string> = {};
        for (const path of result.processed) {
          delete urlsRef.current[path];
          const base = getMediaImageUrlSync(bucket, path, account);
          const sep = base.includes("?") ? "&" : "?";
          const freshUrl = `${base}${sep}v=${timestamp}`;
          urlsRef.current[path] = freshUrl;
          updatedUrls[path] = freshUrl;
        }
        setUrls((prev) => ({ ...prev, ...updatedUrls }));

        // Update preview state if currently open in lightbox
        if (preview && result.processed.includes(preview.path)) {
          const updatedItem = result.results?.find((r) => r.path === preview.path);
          if (updatedItem?.newSize) {
            setPreview((prev) => (prev ? {
              ...prev,
              size: updatedItem.newSize!,
              updatedAt: new Date().toISOString(),
            } : null));
          }
        }

        await load(true);
      }

      if (result.processed.length > 0) {
        await showSuccess(
          "Kompresi Berhasil",
          `Berhasil mengompresi ${result.processed.length} gambar dan menghemat ${formatMediaBytes(result.savedBytes)} ruang storage.`,
        );
      }
      if (result.failed.length > 0) {
        await showError(
          "Sebagian Berkas Gagal",
          `${result.failed.length} gambar gagal diunduh atau ditimpa di storage.`,
        );
      }
    } catch (reason) {
      await showError(
        "Kompresi Gagal",
        reason instanceof Error ? reason.message : "Terjadi kesalahan saat memproses gambar.",
      );
    } finally {
      operationLock.current = false;
      if (mounted.current) setCompressing(false);
    }
  }

  return {
    account, setAccount, accountOptions,
    buckets, bucket, bucketId, setBucketId, loading, error, scannedFiles, load,
    query, changeQuery, filter, changeFilter, monthFilter, setMonthFilter, changeMonthFilter, availableMonths,
    sort, setSort, view, setView,
    page: currentPage, pages, pageSize, setPageSize: (size: number) => { setPageSize(size); setPage(1); }, setPage,
    images, metrics, filtered, filteredMetrics, visible, selected, selectedImages, selectedLinked, toggleFile, togglePage, resetSelection,
    selectOrphans: () => setSelected(new Set(activePool.filter((file) => file.status === "orphan").map((file) => file.path))),
    selectHeavyFiles: () => setSelected(new Set(activePool.filter((file) => file.size > 300 * 1024).map((file) => file.path))),
    preview, setPreview, urls, urlError, deleting, deleteProgress, canDelete, removeFiles,
    canCompress, compressing, compressProgress, compressFiles,
    scan: currentSnapshot?.scan ?? null,
  };
}
