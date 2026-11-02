import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaBucket, MediaImage, MediaReference, MediaScan, StorageImage } from "../types/media";
import { correlateMedia, isStorageImage } from "./media-utils";
import { getActiveAdminSession } from "./report-service";
import { createIsolatedSupabaseClient, supabase } from "./supabase";

const CACHE_TTL = 5 * 60 * 1000;
const CACHE_PREFIX = "silahar:media-scan:v1:";
const AUDITED_BUCKETS = new Set(["daily-report-proofs", "official-signatures"]);

function clientOrThrow() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  return supabase;
}

function mapBucket(bucket: { id: string; name: string; public: boolean }): MediaBucket {
  return { ...bucket, prefix: "", auditable: AUDITED_BUCKETS.has(bucket.id) };
}

export async function fetchMediaBuckets(): Promise<MediaBucket[]> {
  const client = clientOrThrow();
  const result = await client.storage.listBuckets();
  if (!result.error && result.data?.length) {
    return result.data.filter((bucket) => AUDITED_BUCKETS.has(bucket.id)).map(mapBucket);
  }
  // Both buckets are defined by migrations 001 and 027, even on older deployments.
  return ["daily-report-proofs", "official-signatures"].map((id) => mapBucket({ id, name: id, public: true }));
}

function cacheKey(bucket: MediaBucket, ownerId: string) {
  return `${CACHE_PREFIX}${(import.meta.env.VITE_SUPABASE_URL || "unconfigured")}:${ownerId}:${bucket.id}:${bucket.prefix}`;
}

function readScanCache(key: string): MediaScan | null {
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

export function invalidateMediaScan(bucket: MediaBucket, ownerId: string) {
  try { sessionStorage.removeItem(cacheKey(bucket, ownerId)); } catch { /* Storage may be unavailable. */ }
}

export async function scanStorageImages(
  bucket: MediaBucket,
  ownerId: string,
  options: { force?: boolean; signal?: AbortSignal; onProgress?: (files: number) => void } = {},
): Promise<MediaScan> {
  const client = clientOrThrow();
  const key = cacheKey(bucket, ownerId);
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
    const folders = queue.splice(0, 4).filter((folder) => !visited.has(folder));
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

async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
  const client = clientOrThrow();
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

export async function fetchMediaReferences(): Promise<MediaReference[]> {
  const [photos, teams, approvers] = await Promise.all([
    fetchAllRows<PhotoReferenceRow>("daily_report_activity_photos", "id,storage_path,public_url,daily_report_activities(id,report_id,daily_reports(id,reporter_name,report_date))"),
    fetchAllRows<{ id: string; name: string; signature_url: string }>("team_types", "id,name,signature_url"),
    fetchAllRows<{ id: string; official_name: string; scope_label: string; signature_url: string }>("report_template_approvers", "id,official_name,scope_label,signature_url"),
  ]);
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
  return references;
}

export async function getMediaImageUrls(bucket: MediaBucket, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const storage = clientOrThrow().storage.from(bucket.id);
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
  bucket: MediaBucket, files: MediaImage[], ownerId: string,
  access: VerifiedMediaAccess | null,
  onProgress?: (done: number, total: number) => void,
): Promise<{ deleted: string[]; failed: string[] }> {
  if (!bucket.auditable) throw new Error("Sumber referensi bucket ini belum terhubung. Penghapusan dinonaktifkan.");
  const session = await getActiveAdminSession();
  if (!session || session.user.id !== ownerId) throw new Error("Akses administrator diperlukan.");
  const unique = [...new Map(files.map((file) => [file.path, file])).values()];
  const references = await fetchMediaReferences();
  const latest = correlateMedia(unique, references, bucket.id, true);
  const requiresPassword = latest.some((file) => file.status === "linked");
  if (requiresPassword && (!access || access.adminId !== ownerId || access.expiresAt <= Date.now())) throw new MediaPasswordRequiredError();
  const client = access?.client ?? clientOrThrow();
  const deleted: string[] = [];
  const failed: string[] = [];
  // Invalidate before the first request, including failures and interrupted operations.
  invalidateMediaScan(bucket, ownerId);
  for (let offset = 0;offset < latest.length;offset += 50) {
    const paths = latest.slice(offset, offset + 50).map((file) => file.path);
    try {
      const { data, error } = await client.storage.from(bucket.id).remove(paths);
      if (error) { failed.push(...paths); }
      else {
        const removed = new Set((data || []).map((item) => item.name));
        for (const path of paths) (removed.has(path) ? deleted : failed).push(path);
      }
    } catch { failed.push(...paths); }
    onProgress?.(Math.min(offset + paths.length, latest.length), latest.length);
  }
  return { deleted, failed };
}
