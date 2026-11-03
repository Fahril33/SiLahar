import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MediaAccountOption,
  MediaAccountTarget,
  MediaBucket,
  MediaImage,
  MediaReference,
  MediaScan,
  StorageImage,
} from "../types/media";
import { correlateMedia, isStorageImage, normalizeStoragePath } from "./media-utils";
import { optimizeReportImage } from "./image-optimizer";
import { getActiveAdminSession } from "./report-service";
import {
  createIsolatedSupabaseClient,
  getReadSupabaseClients,
  legacySupabase,
  legacySupabaseUrl,
  supabase,
  supabaseUrl,
} from "./supabase";

const CACHE_TTL = 5 * 60 * 1000;
const CACHE_PREFIX = "silahar:media-scan:v1:";
const AUDITED_BUCKETS = new Set(["daily-report-proofs", "official-signatures"]);

function clientOrThrow() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  return supabase;
}

export function getClientForAccount(account: MediaAccountTarget = "primary"): SupabaseClient {
  if (account === "legacy") {
    if (legacySupabase) return legacySupabase;
    throw new Error("Akun Supabase lama (legacy) belum dikonfigurasi.");
  }
  return clientOrThrow();
}

export function getMediaAccountOptions(): MediaAccountOption[] {
  const options: MediaAccountOption[] = [
    {
      id: "primary",
      label: "Akun Baru (Penyimpanan Aktif)",
      url: supabaseUrl || "",
      isAvailable: Boolean(supabase),
    },
  ];

  if (legacySupabase && legacySupabaseUrl) {
    options.push({
      id: "legacy",
      label: "Akun Lama (Arsip Penuh)",
      url: legacySupabaseUrl,
      isAvailable: true,
    });
  }

  return options;
}

function mapBucket(bucket: { id: string; name: string; public: boolean }): MediaBucket {
  return { ...bucket, prefix: "", auditable: AUDITED_BUCKETS.has(bucket.id) };
}

export async function fetchMediaBuckets(account: MediaAccountTarget = "primary"): Promise<MediaBucket[]> {
  const client = getClientForAccount(account);
  const result = await client.storage.listBuckets();
  if (!result.error && result.data?.length) {
    return result.data.filter((bucket) => AUDITED_BUCKETS.has(bucket.id)).map(mapBucket);
  }
  // Both buckets are defined by migrations 001 and 027, even on older deployments.
  return ["daily-report-proofs", "official-signatures"].map((id) => mapBucket({ id, name: id, public: true }));
}

export function getScanCacheKey(bucket: MediaBucket, ownerId: string, account: MediaAccountTarget = "primary") {
  return cacheKey(bucket, ownerId, account);
}

function cacheKey(bucket: MediaBucket, ownerId: string, account: MediaAccountTarget = "primary") {
  const accountUrl = account === "legacy" ? (legacySupabaseUrl || "legacy") : (supabaseUrl || "primary");
  return `${CACHE_PREFIX}${accountUrl}:${ownerId}:${bucket.id}:${bucket.prefix}`;
}

const REFS_CACHE_KEY = "silahar:media-refs:v1";

export function getCachedMediaReferences(): MediaReference[] | null {
  try {
    const raw = sessionStorage.getItem(REFS_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { data: MediaReference[]; timestamp: number };
    const age = Date.now() - value.timestamp;
    if (!Number.isFinite(age) || age < 0 || age >= CACHE_TTL || !Array.isArray(value.data)) return null;
    return value.data;
  } catch {
    return null;
  }
}

export function invalidateMediaReferences(): void {
  try {
    sessionStorage.removeItem(REFS_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function readScanCache(key: string): MediaScan | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as MediaScan;
    const age = Date.now() - value.scannedAt;
    if (!Number.isFinite(age) || age < 0 || age >= CACHE_TTL || !Array.isArray(value.files)) return null;
    if (!value.files.every((file) => typeof file.path === "string" && typeof file.name === "string" && Number.isFinite(file.size) && file.size >= 0 && typeof file.createdAt === "string" && typeof file.updatedAt === "string")) return null;
    return { ...value, cached: true };
  } catch { return null; }
}

export function invalidateMediaScan(bucket: MediaBucket, ownerId: string, account: MediaAccountTarget = "primary") {
  try { sessionStorage.removeItem(cacheKey(bucket, ownerId, account)); } catch { /* Storage may be unavailable. */ }
  invalidateMediaReferences();
}

export async function scanStorageImages(
  bucket: MediaBucket,
  ownerId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (files: number) => void;
    account?: MediaAccountTarget;
  } = {},
): Promise<MediaScan> {
  const account = options.account || "primary";
  const client = getClientForAccount(account);
  const key = cacheKey(bucket, ownerId, account);
  if (!options.force) {
    const cached = readScanCache(key);
    if (cached) return cached;
  }
  const files: StorageImage[] = [];
  const queue = [bucket.prefix];
  const visited = new Set<string>();
  const checkCancelled = () => options.signal?.throwIfAborted();
  while (queue.length) {
    checkCancelled();
    const folders = queue.splice(0, 16).filter((folder) => !visited.has(folder));
    folders.forEach((folder) => visited.add(folder));
    await Promise.all(folders.map(async (folder) => {
      for (let offset = 0;;offset += 1000) {
        checkCancelled();
        const { data, error } = await client.storage.from(bucket.id).list(folder, {
          limit: 1000, offset, sortBy: { column: "name", order: "asc" },
        }, { signal: options.signal });
        checkCancelled();
        if (error) throw new Error(`Tidak dapat membaca folder ${folder || "/"}: ${error.message}`);
        if (!Array.isArray(data)) throw new Error("Daftar berkas storage tidak valid.");
        for (const object of data) {
          if (object.name === ".emptyFolderPlaceholder") continue;
          const path = folder ? `${folder}/${object.name}` : object.name;
          if (object.id == null && object.metadata == null) { queue.push(path); continue; }
          const mimeType = String(object.metadata?.mimetype || object.metadata?.contentType || "");
          if (!isStorageImage(object.name, mimeType)) continue;
          const size = Number(object.metadata?.size || 0);
          files.push({ id: object.id || path, path, name: object.name, size: Number.isFinite(size) ? Math.max(0, size) : 0, mimeType, createdAt: object.created_at || "", updatedAt: object.updated_at || "" });
        }
        options.onProgress?.(files.length);
        if (data.length < 1000) break;
      }
    }));
  }
  checkCancelled();
  const result: MediaScan = { files: [...new Map(files.map((file) => [file.path, file])).values()], scannedAt: Date.now(), cached: false };
  try { sessionStorage.setItem(key, JSON.stringify(result)); } catch { /* A full cache must not prevent an audit. */ }
  return result;
}

async function fetchAllRowsFromClient<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0;;offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`Audit referensi ${table} gagal: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`Audit referensi ${table} tidak lengkap.`);
    rows.push(...data as unknown as T[]);
    if (data.length < 1000) return rows;
  }
}

function referenceBucket(path: string, fallback: string) {
  const match = path.match(/\/?storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/?#]+)\//);
  if (!match) return fallback;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

type PhotoReferenceRow = {
  id: string; storage_path: string; public_url: string;
  daily_report_activities: { id: string; report_id: string; daily_reports?: { id: string; reporter_name: string; report_date: string } | Array<{ id: string; reporter_name: string; report_date: string }> } | Array<{ id: string; report_id: string; daily_reports?: { id: string; reporter_name: string; report_date: string } | Array<{ id: string; reporter_name: string; report_date: string }> }>;
};

export async function fetchMediaReferences(force = false): Promise<MediaReference[]> {
  if (!force) {
    const cached = getCachedMediaReferences();
    if (cached) return cached;
  }

  const readClients = typeof getReadSupabaseClients === "function" ? getReadSupabaseClients() : [clientOrThrow()];
  const clients = readClients.length ? readClients : [clientOrThrow()];

  const [allPhotos, allTeams, allApprovers] = await Promise.all([
    Promise.all(clients.map((c) => fetchAllRowsFromClient<PhotoReferenceRow>(c, "daily_report_activity_photos", "id,storage_path,public_url,daily_report_activities(id,report_id,daily_reports(id,reporter_name,report_date))"))),
    Promise.all(clients.map((c) => fetchAllRowsFromClient<{ id: string; name: string; signature_url: string }>(c, "team_types", "id,name,signature_url"))),
    Promise.all(clients.map((c) => fetchAllRowsFromClient<{ id: string; official_name: string; scope_label: string; signature_url: string }>(c, "report_template_approvers", "id,official_name,scope_label,signature_url"))),
  ]);

  const photos = allPhotos.flat();
  const teams = allTeams.flat();
  const approvers = allApprovers.flat();

  const references: MediaReference[] = [];
  for (const photo of photos) {
    const rawActivity = photo.daily_report_activities as unknown;
    const activity = (Array.isArray(rawActivity) ? rawActivity[0] : rawActivity) as { id: string; report_id: string; daily_reports?: unknown } | null | undefined;
    const rawReport = activity?.daily_reports;
    const report = (Array.isArray(rawReport) ? rawReport[0] : rawReport) as { id: string; reporter_name: string; report_date: string } | null | undefined;
    if (!report) throw new Error("Relasi laporan tidak lengkap. Audit dihentikan untuk menjaga foto yang masih digunakan.");
    const pathsByBucket = new Map<string, string[]>();
    for (const raw of [photo.storage_path, photo.public_url].filter(Boolean)) {
      const path = String(raw).trim();
      if (!path || path === "undefined" || path === "null" || path.startsWith("data:")) continue;
      const bucketId = referenceBucket(path, "daily-report-proofs");
      pathsByBucket.set(bucketId, [...(pathsByBucket.get(bucketId) ?? []), path]);
    }
    for (const [bucketId, paths] of pathsByBucket) {
      references.push({ id: `photo:${photo.id}:${bucketId}`, recordId: report.id, label: report.reporter_name, date: report.report_date, kind: "report", bucketId, paths });
    }
  }
  for (const team of teams) {
    if (!team.signature_url || team.signature_url.startsWith("data:")) continue;
    const explicitBucket = referenceBucket(team.signature_url, "");
    const buckets = explicitBucket ? [explicitBucket] : ["official-signatures", "daily-report-proofs"];
    for (const bucketId of buckets) {
      references.push({ id: `team:${team.id}:${bucketId}`, recordId: team.id, label: `Tanda tangan ${team.name}`, date: null, kind: "team", bucketId, paths: [team.signature_url] });
    }
  }
  for (const approver of approvers) {
    if (!approver.signature_url || approver.signature_url.startsWith("data:")) continue;
    const explicitBucket = referenceBucket(approver.signature_url, "");
    const buckets = explicitBucket ? [explicitBucket] : ["official-signatures", "daily-report-proofs"];
    for (const bucketId of buckets) {
      references.push({ id: `approver:${approver.id}:${bucketId}`, recordId: approver.id, label: approver.official_name || approver.scope_label, date: null, kind: "approver", bucketId, paths: [approver.signature_url] });
    }
  }
  try {
    sessionStorage.setItem(REFS_CACHE_KEY, JSON.stringify({ data: references, timestamp: Date.now() }));
  } catch {
    /* ignore storage quota exceeded */
  }
  return references;
}

export function getMediaImageUrlSync(
  bucket: MediaBucket,
  path: string,
  account: MediaAccountTarget = "primary",
): string {
  if (!bucket.public) return "";
  const client = getClientForAccount(account);
  return client.storage.from(bucket.id).getPublicUrl(path).data.publicUrl;
}

export async function getMediaImageUrls(
  bucket: MediaBucket,
  paths: string[],
  account: MediaAccountTarget = "primary",
): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const storage = getClientForAccount(account).storage.from(bucket.id);
  if (bucket.public) return Object.fromEntries(paths.map((path) => [path, storage.getPublicUrl(path).data.publicUrl]));
  const { data, error } = await storage.createSignedUrls(paths, 300);
  if (error) throw new Error(`Pratinjau tidak dapat dimuat: ${error.message}`);
  return Object.fromEntries((data || []).filter((item) => item.path && item.signedUrl && !item.error).map((item) => [item.path!, item.signedUrl]));
}

export type VerifiedMediaAccess = { client: SupabaseClient; adminId: string; expiresAt: number };

export async function verifyMediaDeletionPassword(password: string, expectedAdminId: string): Promise<VerifiedMediaAccess> {
  const session = await getActiveAdminSession();
  if (!session || session.user.id !== expectedAdminId || !session.user.email) throw new Error("Sesi admin tidak valid. Silakan masuk kembali.");
  const client = createIsolatedSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email: session.user.email, password });
  if (error || !data.user || data.user.id !== expectedAdminId) throw new Error("Password administrator tidak sesuai.");
  return { client, adminId: expectedAdminId, expiresAt: Date.now() + CACHE_TTL };
}

export class MediaPasswordRequiredError extends Error {
  constructor() { super("Keterkaitan berkas telah berubah. Foto terkait data memerlukan verifikasi password administrator."); }
}

export async function deleteMediaImages(
  bucket: MediaBucket,
  files: MediaImage[],
  ownerId: string,
  access: VerifiedMediaAccess | null,
  accountOrProgress?: MediaAccountTarget | ((done: number, total: number) => void),
  maybeProgress?: (done: number, total: number) => void,
): Promise<{ deleted: string[]; failed: string[] }> {
  const account: MediaAccountTarget = typeof accountOrProgress === "string" ? accountOrProgress : "primary";
  const onProgress = typeof accountOrProgress === "function" ? accountOrProgress : maybeProgress;
  if (!bucket.auditable) throw new Error("Sumber referensi bucket ini belum terhubung. Penghapusan dinonaktifkan.");
  const session = await getActiveAdminSession();
  if (!session || session.user.id !== ownerId) throw new Error("Akses administrator diperlukan.");
  const unique = [...new Map(files.map((file) => [file.path, file])).values()];
  const references = await fetchMediaReferences(true);
  const latest = correlateMedia(unique, references, bucket.id, true);
  const requiresPassword = latest.some((file) => file.status === "linked");
  if (requiresPassword && (!access || access.adminId !== ownerId || access.expiresAt <= Date.now())) throw new MediaPasswordRequiredError();
  const client = account === "legacy" ? getClientForAccount("legacy") : (access?.client ?? clientOrThrow());
  const deleted: string[] = [];
  const failed: string[] = [];
  // Invalidate before the first request, including failures and interrupted operations.
  invalidateMediaScan(bucket, ownerId, account);
  for (let offset = 0; offset < latest.length; offset += 50) {
    const batch = latest.slice(offset, offset + 50);
    const paths = batch.map((file) => normalizeStoragePath(file.path, bucket.id));
    try {
      const { data, error } = await client.storage.from(bucket.id).remove(paths);
      if (error) {
        failed.push(...batch.map((f) => f.path));
      } else {
        const removed = new Set((data || []).map((item) => normalizeStoragePath(item.name, bucket.id)));
        for (const file of batch) {
          const norm = normalizeStoragePath(file.path, bucket.id);
          if (removed.has(norm) || removed.has(file.name)) {
            deleted.push(file.path);
          } else {
            failed.push(file.path);
          }
        }
      }
    } catch {
      failed.push(...batch.map((f) => f.path));
    }
    onProgress?.(Math.min(offset + batch.length, latest.length), latest.length);
  }
  return { deleted, failed };
}

export async function compressAndOverwriteMediaImages(
  bucket: MediaBucket,
  files: MediaImage[],
  ownerId: string,
  account: MediaAccountTarget = "primary",
  onProgress?: (done: number, total: number, savedBytes: number) => void,
  options?: { signal?: AbortSignal },
): Promise<{
  processed: string[];
  skipped: string[];
  failed: string[];
  savedBytes: number;
  results: { path: string; success: boolean; oldSize: number; newSize?: number }[];
}> {
  if (!bucket.auditable) {
    throw new Error(`Bucket "${bucket.id}" tidak terdaftar untuk audit dan kompresi media.`);
  }

  const session = await getActiveAdminSession();
  if (!session || session.user.id !== ownerId) throw new Error("Akses administrator diperlukan.");

  const client = getClientForAccount(account);
  const processed: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const results: { path: string; success: boolean; oldSize: number; newSize?: number }[] = [];
  let totalSavedBytes = 0;

  // Invalidate scan cache so refreshed metadata will be loaded after compression
  invalidateMediaScan(bucket, ownerId, account);

  for (let i = 0; i < files.length; i++) {
    options?.signal?.throwIfAborted();
    const file = files[i];

    // Jika ukuran file sudah <= 300 KB, lewati
    if (file.size <= 300 * 1024) {
      skipped.push(file.path);
      results.push({ path: file.path, success: false, oldSize: file.size });
      onProgress?.(i + 1, files.length, totalSavedBytes);
      continue;
    }

    try {
      const canonicalPath = normalizeStoragePath(file.path, bucket.id);

      // 1. Download file gambar asli dari bucket
      const { data: blob, error: downloadError } = await client.storage
        .from(bucket.id)
        .download(canonicalPath);

      if (downloadError || !blob) {
        failed.push(file.path);
        results.push({ path: file.path, success: false, oldSize: file.size });
        onProgress?.(i + 1, files.length, totalSavedBytes);
        continue;
      }

      // 2. Kompresi gambar menjadi WebP/JPEG <= 300 KB dengan format yang sesuai ekstensi berkas
      const isJpg = /\.(jpe?g)$/i.test(file.name);
      const fileType = blob.type && blob.type.startsWith("image/")
        ? blob.type
        : (isJpg ? "image/jpeg" : (file.mimeType || "image/jpeg"));

      const rawFile: File = typeof File !== "undefined"
        ? new File([blob], file.name, { type: fileType })
        : Object.assign(blob, { name: file.name, lastModified: Date.now() }) as unknown as File;

      const optimized = await optimizeReportImage(rawFile, {
        forceMimeType: isJpg ? "image/jpeg" : undefined,
      });

      // 3. Timpa file lama hanya jika hasil kompresi lebih kecil dari ukuran file saat ini
      if (optimized.size < file.size) {
        const optimizedFile =
          optimized.name === file.name
            ? optimized
            : typeof File !== "undefined"
              ? new File([optimized], file.name, { type: optimized.type })
              : Object.assign(optimized, { name: file.name });

        const { error: uploadError } = await client.storage
          .from(bucket.id)
          .upload(canonicalPath, optimizedFile, {
            upsert: true,
            contentType: optimizedFile.type || fileType,
          });

        if (uploadError) {
          failed.push(file.path);
          results.push({ path: file.path, success: false, oldSize: file.size });
        } else {
          processed.push(file.path);
          const saved = file.size - optimized.size;
          totalSavedBytes += saved;
          results.push({ path: file.path, success: true, oldSize: file.size, newSize: optimized.size });
        }
      } else {
        skipped.push(file.path);
        results.push({ path: file.path, success: false, oldSize: file.size });
      }
    } catch {
      failed.push(file.path);
      results.push({ path: file.path, success: false, oldSize: file.size });
    }

    onProgress?.(i + 1, files.length, totalSavedBytes);

    // Yield ke event loop agar antarmuka tidak freeze dan GC browser dapat membersihkan memori
    if (i < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }

  return { processed, skipped, failed, savedBytes: totalSavedBytes, results };
}

