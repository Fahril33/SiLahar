import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminSessionState } from "../types/admin";
import type { MediaBucket, MediaFilter, MediaImage, MediaReference, MediaScan, MediaSort } from "../types/media";
import { askConfirmation, askPasswordConfirmation, showError, showSuccess } from "../lib/alerts";
import { correlateMedia, formatMediaBytes } from "../lib/media-utils";
import {
  deleteMediaImages, fetchMediaBuckets, fetchMediaReferences, getMediaImageUrls,
  scanStorageImages, verifyMediaDeletionPassword, type VerifiedMediaAccess,
} from "../lib/media-service";

type Snapshot = { bucketId: string; scan: MediaScan; references: MediaReference[] };

export function useMediaManager(admin: AdminSessionState, onBusyChange: (busy: boolean) => void, onRefreshReports?: () => Promise<void>) {
  const [buckets, setBuckets] = useState<MediaBucket[]>([]);
  const [bucketId, setBucketId] = useState(() => localStorage.getItem("silahar:media-bucket") || "daily-report-proofs");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scannedFiles, setScannedFiles] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
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
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const operationLock = useRef(false);
  const bucket = buckets.find((item) => item.id === bucketId) ?? null;

  useEffect(() => {
    mounted.current = true;
    void fetchMediaBuckets().then((items) => {
      if (!mounted.current) return;
      setBuckets(items);
      setBucketId((id) => items.some((item) => item.id === id) ? id : items[0]?.id || "");
      if (!items.length) { setError("Tidak ada bucket gambar yang dapat diakses."); setLoading(false); }
    }).catch((reason: unknown) => {
      if (mounted.current) { setError(reason instanceof Error ? reason.message : "Daftar bucket gagal dimuat."); setLoading(false); }
    });
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);

  const load = useCallback(async (force = false) => {
    if (!bucket) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setScannedFiles(0);
    try {
      const [scan, references] = await Promise.all([
        scanStorageImages(bucket, admin.user.id, { force, signal: controller.signal, onProgress: (count) => { if (!controller.signal.aborted) setScannedFiles(count); } }),
        bucket.auditable ? fetchMediaReferences() : Promise.resolve([]),
      ]);
      if (controller.signal.aborted || !mounted.current) return;
      setSnapshot({ bucketId: bucket.id, scan, references });
      const available = new Set(scan.files.map((file) => file.path));
      setSelected((previous) => new Set([...previous].filter((path) => available.has(path))));
    } catch (reason) {
      if (controller.signal.aborted || !mounted.current) return;
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "Pemindaian media gagal.");
    } finally {
      if (!controller.signal.aborted && mounted.current) setLoading(false);
    }
  }, [bucket, admin.user.id]);

  useEffect(() => {
    setSelected(new Set()); setPreview(null); setPage(1); setFilter("all"); setQuery("");
    localStorage.setItem("silahar:media-bucket", bucketId);
    void load();
    return () => request.current?.abort();
  }, [bucketId, load]);

  useEffect(() => {
    onBusyChange(deleting);
    if (!deleting) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [deleting, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const currentSnapshot = snapshot?.bucketId === bucketId ? snapshot : null;
  const images = useMemo(() => bucket && currentSnapshot
    ? correlateMedia(currentSnapshot.scan.files, currentSnapshot.references, bucket.id, bucket.auditable)
    : [], [bucket, currentSnapshot]);
  const metrics = useMemo(() => ({
    count: images.length,
    bytes: images.reduce((sum, file) => sum + file.size, 0),
    linked: images.filter((file) => file.status === "linked").length,
    orphans: images.filter((file) => file.status === "orphan").length,
    orphanBytes: images.filter((file) => file.status === "orphan").reduce((sum, file) => sum + file.size, 0),
  }), [images]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("id-ID");
    const files = images.filter((file) => (filter === "all" || file.status === filter) && (!keyword || `${file.name} ${file.path} ${file.references.map((ref) => `${ref.label} ${ref.recordId} ${ref.date || ""}`).join(" ")}`.toLocaleLowerCase("id-ID").includes(keyword)));
    return files.sort((a, b) => {
      const timeA = Date.parse(a.createdAt) || 0;
      const timeB = Date.parse(b.createdAt) || 0;
      const order = sort === "name" ? a.name.localeCompare(b.name, "id") : sort === "largest" ? b.size - a.size : sort === "smallest" ? a.size - b.size : sort === "oldest" ? timeA - timeB : timeB - timeA;
      return order || a.path.localeCompare(b.path);
    });
  }, [images, query, filter, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedImages = images.filter((file) => selected.has(file.path));
  const selectedLinked = selectedImages.filter((file) => file.status === "linked").length;
  const canDelete = Boolean(bucket?.auditable && currentSnapshot && !loading && !error && !deleting);
  const pathsToPreview = JSON.stringify([...new Set([...visible.map((file) => file.path), ...(preview ? [preview.path] : [])])].sort());

  useEffect(() => {
    if (!bucket) return;
    let active = true;
    setUrls({}); setUrlError("");
    const resolveUrls = () => {
      void getMediaImageUrls(bucket, JSON.parse(pathsToPreview) as string[]).then((value) => {
        if (active) setUrls(value);
      }).catch((reason: unknown) => { if (active) setUrlError(reason instanceof Error ? reason.message : "Pratinjau gagal dimuat."); });
    };
    resolveUrls();
    const timer = bucket.public ? null : window.setInterval(resolveUrls, 240000);
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [bucket, pathsToPreview]);

  const resetSelection = () => setSelected(new Set());
  const changeFilter = (value: MediaFilter) => { setFilter(value); setPage(1); resetSelection(); };
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
      const references = await fetchMediaReferences();
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
      const result = await deleteMediaImages(bucket, latest, admin.user.id, access, (done, total) => {
        if (mounted.current) setDeleteProgress({ done, total });
      });
      if (mounted.current) {
        setPreview(null);
        setSelected(new Set(result.failed));
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

  return {
    buckets, bucket, bucketId, setBucketId, loading, error, scannedFiles, load,
    query, changeQuery, filter, changeFilter, sort, setSort, view, setView,
    page: currentPage, pages, pageSize, setPageSize: (size: number) => { setPageSize(size); setPage(1); }, setPage,
    images, metrics, filtered, visible, selected, selectedImages, selectedLinked, toggleFile, togglePage, resetSelection,
    selectOrphans: () => setSelected(new Set(images.filter((file) => file.status === "orphan").map((file) => file.path))),
    preview, setPreview, urls, urlError, deleting, deleteProgress, canDelete, removeFiles,
    scan: currentSnapshot?.scan ?? null,
  };
}
