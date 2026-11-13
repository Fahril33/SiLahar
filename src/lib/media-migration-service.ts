import type { SupabaseClient } from "@supabase/supabase-js";
import {
  supabase,
  legacySupabase,
  supabaseUrl,
  legacySupabaseUrl,
} from "./supabase";
import { normalizeStoragePath, isStorageImage } from "./media-utils";
import { invalidateMediaReferences } from "./media-service";
import type {
  MediaMigrationBucketId,
  MediaMigrationItem,
  MediaMigrationItemStatus,
  MediaMigrationOptions,
  MediaMigrationProgressEvent,
  MediaMigrationScanResult,
  MediaMigrationSummaryResult,
  MediaMigrationUserGroup,
  MediaMigrationBucketGroup,
  MediaMigrationReportGroup,
  MediaMigrationReportActivity,
} from "../types/media-migration";

const AUDITED_BUCKETS: MediaMigrationBucketId[] = [
  "daily-report-proofs",
  "official-signatures",
];

function sanitizeCleanPath(path: string, bucketId: string): string {
  const norm = normalizeStoragePath(path, bucketId);
  return norm.replace(/^\/+/, "");
}

/**
 * Checks connection status to legacy and primary storage & databases.
 * Uses storage bucket listing as primary probe for legacy, since legacy DB
 * table quotas or schemas might be inaccessible while buckets remain active.
 */
export async function checkMediaMigrationConnections(): Promise<{
  canMigrate: boolean;
  legacyConnected: boolean;
  primaryConnected: boolean;
  legacyUrl: string;
  primaryUrl: string;
  error?: string;
  storageOnlyMode?: boolean;
}> {
  const res = {
    canMigrate: false,
    legacyConnected: Boolean(legacySupabase && legacySupabaseUrl),
    primaryConnected: Boolean(supabase && supabaseUrl),
    legacyUrl: legacySupabaseUrl || "(Belum dikonfigurasi)",
    primaryUrl: supabaseUrl || "(Belum dikonfigurasi)",
    error: undefined as string | undefined,
    storageOnlyMode: false,
  };

  if (!res.legacyConnected) {
    res.error = "Koneksi Supabase lama (VITE_SUPABASE_LEGACY_URL) belum terpasang.";
    return res;
  }
  if (!res.primaryConnected) {
    res.error = "Koneksi Supabase baru (VITE_SUPABASE_URL) belum terpasang.";
    return res;
  }

  // 1. Periksa akses ke Storage Supabase Lama (Metode Utama yang Handal)
  let legacyStorageOk = false;
  try {
    const { data, error } = await legacySupabase!.storage
      .from("daily-report-proofs")
      .list("", { limit: 1 });

    if (!error || Array.isArray(data)) {
      legacyStorageOk = true;
    } else {
      // Fallback check official-signatures
      const { data: sigData, error: sigErr } = await legacySupabase!.storage
        .from("official-signatures")
        .list("", { limit: 1 });
      if (!sigErr || Array.isArray(sigData)) {
        legacyStorageOk = true;
      } else {
        res.error = `Storage Supabase lama tidak dapat diakses: ${error.message}`;
      }
    }
  } catch (err: any) {
    res.error = `Gagal menghubungi storage lama: ${err?.message || err}`;
  }

  // 2. Periksa apakah table data di database lama masih bisa diakses (opsional / graceful)
  let legacyDbOk = false;
  try {
    const { error: dbErr } = await legacySupabase!.from("daily_reports").select("id").limit(1);
    legacyDbOk = !dbErr;
  } catch {
    legacyDbOk = false;
  }

  res.storageOnlyMode = legacyStorageOk && !legacyDbOk;
  res.legacyConnected = legacyStorageOk;

  // 3. Periksa koneksi ke Supabase Baru (Target Penyimpanan & Database)
  try {
    const { error: priDbErr } = await supabase!.from("reporter_directory").select("id").limit(1);
    if (priDbErr && priDbErr.code !== "PGRST116") {
      res.primaryConnected = false;
      res.error = `Database baru error: ${priDbErr.message}`;
    }
  } catch (err: any) {
    res.primaryConnected = false;
    res.error = `Gagal menghubungi database baru: ${err?.message || err}`;
  }

  res.canMigrate = res.legacyConnected && res.primaryConnected;
  return res;
}

/**
 * Ensures target buckets exist in primary Supabase storage.
 */
export async function ensureTargetBucketsExist(): Promise<void> {
  if (!supabase) throw new Error("Supabase primary client tidak tersedia.");

  try {
    const { data: existingBuckets } = await supabase.storage.listBuckets();
    const existingSet = new Set((existingBuckets || []).map((b) => b.id));

    for (const bucketId of AUDITED_BUCKETS) {
      if (!existingSet.has(bucketId)) {
        await supabase.storage.createBucket(bucketId, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        }).catch((err) => {
          console.warn(`Peringatan createBucket "${bucketId}":`, err?.message || err);
        });
      }
    }
  } catch (err) {
    console.warn("Gagal memastikan bucket target:", err);
  }
}

/**
 * Helper to fetch all rows with pagination from a Supabase client safely.
 */
async function fetchAllRowsSafe<T>(
  client: SupabaseClient,
  table: string,
  select: string,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  try {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from(table)
        .select(select)
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.warn(`Peringatan membaca tabel "${table}" (${error.message})`);
        break;
      }
      if (!data || data.length === 0) break;
      rows.push(...(data as unknown as T[]));
      if (data.length < pageSize) break;
    }
  } catch (err) {
    console.warn(`Gagal membaca tabel "${table}" secara penuh:`, err);
  }
  return rows;
}

export type FullReportRow = {
  id: string;
  template_id?: string | null;
  tim?: string | null;
  reporter_name: string;
  display_date_text?: string | null;
  report_date: string;
  reporter_directory_id?: string | null;
  template_approver_coordinator_id?: string | null;
  approver_coordinator_name?: string | null;
  approver_coordinator_nip?: string | null;
  approver_coordinator_signature_url?: string | null;
  template_approver_division_head_id?: string | null;
  approver_division_head_name?: string | null;
  approver_division_head_title?: string | null;
  approver_division_head_nip?: string | null;
  approver_division_head_signature_url?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_role?: string;
  created_by_label?: string;
  updated_by_role?: string;
  updated_by_label?: string;
  [key: string]: any;
};

export type FullActivityRow = {
  id: string;
  report_id: string;
  activity_order: number;
  activity_description: string;
  start_time_text?: string | null;
  end_time_text?: string | null;
  [key: string]: any;
};

export type FullPhotoRow = {
  id: string;
  activity_id: string;
  storage_path: string;
  original_file_name?: string | null;
  sort_order?: number | null;
  public_url?: string | null;
  created_at?: string | null;
  [key: string]: any;
};

/**
 * Scans all media in legacy storage buckets and correlates them with
 * primary database records (and legacy DB if readable) to preserve
 * strict user bindings and folder hierarchy.
 */
export async function scanMediaMigration(
  onProgress?: (statusText: string) => void,
): Promise<MediaMigrationScanResult> {
  if (!legacySupabase || !supabase) {
    throw new Error("Koneksi Supabase lama atau baru belum siap.");
  }

  // 1. Baca metadata relasi dari DATABASE BARU (Target) terlebih dahulu
  onProgress?.("Membaca data pengguna dan laporan aktif dari Database Baru...");

  type PrimaryUser = { id: string; full_name: string };

  const [primaryUsers, primaryReports, primaryActivities, primaryPhotos, primaryTeams, primaryApprovers] =
    await Promise.all([
      fetchAllRowsSafe<PrimaryUser>(supabase, "reporter_directory", "id,full_name"),
      fetchAllRowsSafe<FullReportRow>(supabase, "daily_reports", "*"),
      fetchAllRowsSafe<FullActivityRow>(supabase, "daily_report_activities", "*"),
      fetchAllRowsSafe<FullPhotoRow>(supabase, "daily_report_activity_photos", "*"),
      fetchAllRowsSafe<{ id: string; name: string; signature_url: string }>(
        supabase,
        "team_types",
        "id,name,signature_url",
      ),
      fetchAllRowsSafe<{ id: string; official_name: string; signature_url: string }>(
        supabase,
        "report_template_approvers",
        "id,official_name,signature_url",
      ),
    ]);

  // Indexing Target DB lookups
  const primaryUserMapByName = new Map<string, string>(); // full_name.toLowerCase() -> id
  const primaryUserMapById = new Map<string, string>(); // id -> full_name
  for (const u of primaryUsers) {
    if (u.full_name) {
      primaryUserMapByName.set(u.full_name.trim().toLowerCase(), u.id);
      primaryUserMapById.set(u.id, u.full_name.trim());
    }
  }

  const primaryReportsMap = new Map<string, FullReportRow>();
  const primaryReportsByKey = new Map<string, FullReportRow>(); // `${report_date}:::${reporter_name.toLowerCase()}`
  for (const r of primaryReports) {
    primaryReportsMap.set(r.id, r);
    if (r.report_date && r.reporter_name) {
      const key = `${r.report_date}:::${r.reporter_name.trim().toLowerCase()}`;
      primaryReportsByKey.set(key, r);
    }
  }

  const primaryActivitiesMap = new Map<string, FullActivityRow>();
  const primaryActivitiesByReportAndOrder = new Map<string, FullActivityRow>(); // `${report_id}:::${order}`
  for (const a of primaryActivities) {
    primaryActivitiesMap.set(a.id, a);
    if (a.report_id && a.activity_order != null) {
      primaryActivitiesByReportAndOrder.set(`${a.report_id}:::${a.activity_order}`, a);
    }
  }

  const primaryPhotosByPath = new Map<string, FullPhotoRow>();
  for (const p of primaryPhotos) {
    if (p.storage_path) {
      const clean = sanitizeCleanPath(p.storage_path, "daily-report-proofs");
      primaryPhotosByPath.set(clean, p);
    }
  }

  // 2. Safe Graceful check on Legacy DB tables (ambil seluruh data laporan dan aktivitas)
  onProgress?.("Membaca seluruh data laporan dan aktivitas di database lama...");

  const legacyReportsMap = new Map<string, FullReportRow>();
  const legacyReportsByKey = new Map<string, FullReportRow>();
  const legacyActivitiesMap = new Map<string, FullActivityRow>();
  const legacyActivitiesByReport = new Map<string, FullActivityRow[]>();
  const legacyPhotosMap = new Map<string, FullPhotoRow>();
  let legacyTeams: Array<{ id: string; name: string; signature_url: string }> = [];
  let legacyApprovers: Array<{ id: string; official_name: string; scope_label: string; signature_url: string }> = [];

  try {
    let legReps = await fetchAllRowsSafe<FullReportRow>(legacySupabase, "daily_reports", "*");
    if (legReps.length === 0) {
      legReps = await fetchAllRowsSafe<FullReportRow>(
        legacySupabase,
        "daily_reports",
        "id,reporter_name,report_date,tim,display_date_text,template_id",
      );
    }
    for (const r of legReps) {
      legacyReportsMap.set(r.id, r);
      if (r.report_date && r.reporter_name) {
        const key = `${r.report_date}:::${r.reporter_name.trim().toLowerCase()}`;
        legacyReportsByKey.set(key, r);
      }
    }
  } catch {
    // Non-blocking
  }

  try {
    const legActs = await fetchAllRowsSafe<FullActivityRow>(legacySupabase, "daily_report_activities", "*");
    for (const a of legActs) {
      legacyActivitiesMap.set(a.id, a);
      const list = legacyActivitiesByReport.get(a.report_id) || [];
      list.push(a);
      legacyActivitiesByReport.set(a.report_id, list);
    }
  } catch {
    // Non-blocking
  }

  try {
    const legPhotos = await fetchAllRowsSafe<FullPhotoRow>(legacySupabase, "daily_report_activity_photos", "*");
    for (const p of legPhotos) {
      if (p.storage_path) {
        const clean = sanitizeCleanPath(p.storage_path, "daily-report-proofs");
        legacyPhotosMap.set(clean, p);
      }
    }
  } catch {
    // Non-blocking
  }

  try {
    legacyTeams = await fetchAllRowsSafe<{ id: string; name: string; signature_url: string }>(
      legacySupabase,
      "team_types",
      "id,name,signature_url",
    );
  } catch {
    // Non-blocking
  }

  try {
    legacyApprovers = await fetchAllRowsSafe<{ id: string; official_name: string; scope_label: string; signature_url: string }>(
      legacySupabase,
      "report_template_approvers",
      "id,official_name,scope_label,signature_url",
    );
  } catch {
    // Non-blocking
  }

  // 3. Memindai Berkas Fisik Langsung dari Storage Supabase Lama (Sumber Kebenaran Utama)
  onProgress?.("Memindai file fisik di Supabase Storage lama (daily-report-proofs)...");

  type DiscoveredFile = {
    bucketId: MediaMigrationBucketId;
    storagePath: string;
    fileName: string;
    size: number;
    mimeType: string;
  };

  const discoveredFiles: DiscoveredFile[] = [];

  try {
    const { data: rootFolders, error: rfErr } = await legacySupabase.storage
      .from("daily-report-proofs")
      .list("", { limit: 1000 });

    if (!rfErr && Array.isArray(rootFolders)) {
      // BATCH CONCURRENT SCAN: Telusuri folder {reportId}/{activityId}
      const BATCH_SIZE = 12;
      for (let i = 0; i < rootFolders.length; i += BATCH_SIZE) {
        const chunk = rootFolders.slice(i, i + BATCH_SIZE);
        await Promise.all(
          chunk.map(async (rf) => {
            if (rf.name === ".emptyFolderPlaceholder") return;

            // Jika item di root adalah file langsung
            if (rf.id != null || rf.metadata != null) {
              if (isStorageImage(rf.name, rf.metadata?.mimetype || "")) {
                discoveredFiles.push({
                  bucketId: "daily-report-proofs",
                  storagePath: rf.name,
                  fileName: rf.name,
                  size: Number(rf.metadata?.size || 0),
                  mimeType: rf.metadata?.mimetype || "image/jpeg",
                });
              }
              return;
            }

            // rf.name adalah reportId
            const { data: actFolders } = await legacySupabase!.storage
              .from("daily-report-proofs")
              .list(rf.name, { limit: 100 });

            if (!actFolders) return;

            await Promise.all(
              actFolders.map(async (af) => {
                if (af.name === ".emptyFolderPlaceholder") return;

                // Jika di level 2 adalah file langsung
                if (af.id != null || af.metadata != null) {
                  if (isStorageImage(af.name, af.metadata?.mimetype || "")) {
                    const fullP = `${rf.name}/${af.name}`;
                    discoveredFiles.push({
                      bucketId: "daily-report-proofs",
                      storagePath: fullP,
                      fileName: af.name,
                      size: Number(af.metadata?.size || 0),
                      mimeType: af.metadata?.mimetype || "image/jpeg",
                    });
                  }
                  return;
                }

                // af.name adalah activityId
                const subFolder = `${rf.name}/${af.name}`;
                const { data: files } = await legacySupabase!.storage
                  .from("daily-report-proofs")
                  .list(subFolder, { limit: 100 });

                if (files && files.length > 0) {
                  for (const f of files) {
                    if (f.name === ".emptyFolderPlaceholder") continue;
                    if (isStorageImage(f.name, f.metadata?.mimetype || "")) {
                      discoveredFiles.push({
                        bucketId: "daily-report-proofs",
                        storagePath: `${subFolder}/${f.name}`,
                        fileName: f.name,
                        size: Number(f.metadata?.size || 0),
                        mimeType: f.metadata?.mimetype || "image/jpeg",
                      });
                    }
                  }
                }
              }),
            );
          }),
        );
      }
    }
  } catch (err) {
    console.warn("Gagal memindai bucket daily-report-proofs legacy:", err);
  }

  // Pindai juga official-signatures dari storage lama
  onProgress?.("Memindai file fisik tanda tangan di Supabase Storage lama...");
  try {
    const { data: sigFiles } = await legacySupabase.storage
      .from("official-signatures")
      .list("", { limit: 100 });

    if (Array.isArray(sigFiles)) {
      for (const sf of sigFiles) {
        if (sf.name === ".emptyFolderPlaceholder") continue;
        if (isStorageImage(sf.name, sf.metadata?.mimetype || "")) {
          discoveredFiles.push({
            bucketId: "official-signatures",
            storagePath: sf.name,
            fileName: sf.name,
            size: Number(sf.metadata?.size || 0),
            mimeType: sf.metadata?.mimetype || "image/png",
          });
        }
      }
    }
  } catch {
    // Non-blocking
  }

  onProgress?.("Mengorelasikan seluruh berkas dengan akun pengguna dan laporan...");

  // 4. Konstruksi Item Migrasi Relasional
  const items: MediaMigrationItem[] = [];
  const reportActivityOrderMap = new Map<string, Map<string, number>>();

  for (const file of discoveredFiles) {
    const cleanPath = sanitizeCleanPath(file.storagePath, file.bucketId);
    if (!cleanPath) continue;

    const parts = cleanPath.split("/");

    if (file.bucketId === "daily-report-proofs") {
      // Struktur normal: {reportId}/{activityId}/{fileName}
      const reportId = parts.length >= 3 ? parts[0] : parts.length === 2 ? parts[0] : null;
      const activityId = parts.length >= 3 ? parts[1] : null;
      const fileName = parts[parts.length - 1];

      // A. Ambil metadata laporan
      const reportInfo = (reportId ? primaryReportsMap.get(reportId) : null) ||
        (reportId ? legacyReportsMap.get(reportId) : null);

      const reporterName = reportInfo?.reporter_name || "Petugas Tidak Terdata";
      const reportDate = reportInfo?.report_date || null;
      const tim = reportInfo?.tim || null;

      // Temukan userId dari reporter_directory di DB Baru
      let userId = (reportInfo as any)?.reporter_directory_id || null;
      if (!userId && reporterName) {
        userId = primaryUserMapByName.get(reporterName.trim().toLowerCase()) || null;
      }

      // B. Ambil metadata aktivitas
      const actInfo = (activityId ? primaryActivitiesMap.get(activityId) : null) ||
        (activityId ? legacyActivitiesMap.get(activityId) : null);

      // Hitung activityOrder agar tiap aktivitas dalam laporan yang sama memiliki nomor urut unik
      let resolvedOrder = actInfo?.activity_order;
      if (!resolvedOrder && reportId && activityId) {
        if (!reportActivityOrderMap.has(reportId)) {
          reportActivityOrderMap.set(reportId, new Map());
        }
        const actMap = reportActivityOrderMap.get(reportId)!;
        if (!actMap.has(activityId)) {
          actMap.set(activityId, actMap.size + 1);
        }
        resolvedOrder = actMap.get(activityId);
      }
      if (!resolvedOrder) {
        resolvedOrder = 1;
      }

      // C. Ambil metadata photo DB lama/baru jika ada
      const legacyPhoto = legacyPhotosMap.get(cleanPath);
      const primaryPhoto = primaryPhotosByPath.get(cleanPath);
      const isAlreadyInTargetDb = Boolean(primaryPhoto);

      const sourceUrl = `${legacySupabaseUrl}/storage/v1/object/public/daily-report-proofs/${cleanPath}`;
      const targetUrl = `${supabaseUrl}/storage/v1/object/public/daily-report-proofs/${cleanPath}`;

      const photoId = primaryPhoto?.id || legacyPhoto?.id || crypto.randomUUID();
      const status: MediaMigrationItemStatus = isAlreadyInTargetDb
        ? "already_synced"
        : "pending";

      items.push({
        id: photoId,
        bucketId: "daily-report-proofs",
        storagePath: cleanPath,
        originalFileName: legacyPhoto?.original_file_name || fileName,
        fileSize: file.size || 150000,
        mimeType: file.mimeType || "image/jpeg",
        kind: "report_photo",
        userRel: {
          userId,
          userName: reporterName,
          reportId,
          reportDate,
          tim,
          activityId,
          activityOrder: resolvedOrder,
          activityDescription: actInfo?.activity_description || null,
        },
        status,
        sourceUrl,
        targetUrl,
        isAlreadyInTargetStorage: isAlreadyInTargetDb,
        isAlreadyInTargetDb,
      });
    } else if (file.bucketId === "official-signatures") {
      // Tanda tangan
      const teamMatch =
        primaryTeams.find((t) => t.signature_url && t.signature_url.includes(cleanPath)) ||
        legacyTeams.find((t) => t.signature_url && t.signature_url.includes(cleanPath));

      const approverMatch =
        primaryApprovers.find((a) => a.signature_url && a.signature_url.includes(cleanPath)) ||
        legacyApprovers.find((a) => a.signature_url && a.signature_url.includes(cleanPath));

      const sourceUrl = `${legacySupabaseUrl}/storage/v1/object/public/official-signatures/${cleanPath}`;
      const targetUrl = `${supabaseUrl}/storage/v1/object/public/official-signatures/${cleanPath}`;

      const kind = teamMatch
        ? "team_signature"
        : approverMatch
          ? "approver_signature"
          : "orphan_storage";

      const label = teamMatch
        ? `Tanda Tangan Tim: ${teamMatch.name}`
        : approverMatch
          ? `Pejabat: ${approverMatch.official_name}`
          : `Tanda Tangan: ${cleanPath}`;

      const itemId = teamMatch?.id || approverMatch?.id || crypto.randomUUID();

      items.push({
        id: itemId,
        bucketId: "official-signatures",
        storagePath: cleanPath,
        originalFileName: file.fileName,
        fileSize: file.size || 45000,
        mimeType: "image/png",
        kind,
        userRel: {
          userId: null,
          userName: label,
          reportId: null,
          reportDate: null,
          tim: teamMatch?.name || null,
          activityId: null,
          activityOrder: null,
          activityDescription: null,
        },
        status: "pending",
        sourceUrl,
        targetUrl,
        isAlreadyInTargetStorage: false,
        isAlreadyInTargetDb: false,
      });
    }
  }

  // 5. Agregasi Kelompok Berdasarkan User & Bucket
  const userMap = new Map<string, MediaMigrationUserGroup>();
  for (const it of items) {
    const key = it.userRel.userId || it.userRel.userName;
    const group = userMap.get(key) || {
      id: key,
      name: it.userRel.userName,
      totalPhotos: 0,
      totalBytes: 0,
      syncedCount: 0,
      needsMigrationCount: 0,
    };
    group.totalPhotos += 1;
    group.totalBytes += it.fileSize;
    if (it.status === "already_synced") {
      group.syncedCount += 1;
    } else {
      group.needsMigrationCount += 1;
    }
    userMap.set(key, group);
  }

  const bucketMap = new Map<MediaMigrationBucketId, MediaMigrationBucketGroup>();
  for (const bId of AUDITED_BUCKETS) {
    bucketMap.set(bId, {
      id: bId,
      name: bId,
      totalItems: 0,
      totalBytes: 0,
      syncedCount: 0,
      needsMigrationCount: 0,
    });
  }

  for (const it of items) {
    const bg = bucketMap.get(it.bucketId);
    if (bg) {
      bg.totalItems += 1;
      bg.totalBytes += it.fileSize;
      if (it.status === "already_synced") {
        bg.syncedCount += 1;
      } else {
        bg.needsMigrationCount += 1;
      }
    }
  }

  // 5. Agregasi Kelompok Berdasarkan Laporan (Report Groups) dengan Data Teks Lengkap
  const reportMap = new Map<string, MediaMigrationReportGroup>();

  // A. Muat seluruh laporan dari database lama ke dalam reportMap terlebih dahulu
  for (const legRep of legacyReportsMap.values()) {
    const normName = (legRep.reporter_name || "").trim().toLowerCase();
    const repKey = `${legRep.report_date}:::${normName}`;
    const primaryRep = primaryReportsMap.get(legRep.id) || primaryReportsByKey.get(repKey);
    const isReportInTargetDb = Boolean(primaryRep);

    const legActs = (legacyActivitiesByReport.get(legRep.id) || []).sort(
      (a, b) => a.activity_order - b.activity_order,
    );

    const reportActivities: MediaMigrationReportActivity[] = legActs.map((act) => {
      const isActInPrimary =
        primaryActivitiesMap.has(act.id) ||
        (primaryRep
          ? primaryActivitiesByReportAndOrder.has(`${primaryRep.id}:::${act.activity_order}`)
          : false);

      return {
        id: act.id,
        reportId: legRep.id,
        activityOrder: act.activity_order,
        activityDescription: act.activity_description || "Aktivitas Dokumentasi",
        startTimeText: act.start_time_text || "08:00",
        endTimeText: act.end_time_text || "16:00",
        photosCount: 0,
        isSynced: isActInPrimary,
      };
    });

    reportMap.set(legRep.id, {
      reportId: legRep.id,
      reporterName: legRep.reporter_name,
      userId: legRep.reporter_directory_id || primaryUserMapByName.get(normName) || null,
      reportDate: legRep.report_date,
      tim: legRep.tim || null,
      displayDateText: legRep.display_date_text || legRep.report_date,
      templateId: legRep.template_id || null,
      activitiesCount: legActs.length,
      totalPhotos: 0,
      syncedPhotosCount: 0,
      needsMigrationCount: isReportInTargetDb ? 0 : 1,
      totalBytes: 0,
      isReportInTargetDb,
      isReportFullySynced: false,
      items: [],
      activities: reportActivities,
      legacyReportData: legRep,
    });
  }

  // B. Kaitkan seluruh berkas foto media dengan grup laporan bersangkutan
  for (const it of items) {
    if (it.bucketId === "daily-report-proofs" && it.userRel.reportId) {
      const repId = it.userRel.reportId;
      let group = reportMap.get(repId);

      if (!group) {
        // Fallback jika ada file di storage yang reportId nya tidak ada di tabel daily_reports legacy
        const normName = (it.userRel.userName || "").trim().toLowerCase();
        const repKey = `${it.userRel.reportDate}:::${normName}`;
        const primaryRep =
          primaryReportsMap.get(repId) ||
          (it.userRel.reportDate ? primaryReportsByKey.get(repKey) : null);

        group = {
          reportId: repId,
          reporterName: it.userRel.userName,
          userId: it.userRel.userId,
          reportDate: it.userRel.reportDate,
          tim: it.userRel.tim,
          displayDateText: it.userRel.reportDate,
          templateId: null,
          activitiesCount: 1,
          totalPhotos: 0,
          syncedPhotosCount: 0,
          needsMigrationCount: 0,
          totalBytes: 0,
          isReportInTargetDb: Boolean(primaryRep),
          isReportFullySynced: false,
          items: [],
          activities: [],
          legacyReportData: null,
        };
        reportMap.set(repId, group);
      }

      group.totalPhotos += 1;
      group.totalBytes += it.fileSize;
      if (it.status === "already_synced" || it.status === "synced") {
        group.syncedPhotosCount += 1;
      } else {
        group.needsMigrationCount += 1;
      }
      group.items.push(it);

      // Hitung dan tandai foto pada detail aktivitas laporan
      if (it.userRel.activityId && group.activities) {
        const matchedAct = group.activities.find((a) => a.id === it.userRel.activityId);
        if (matchedAct) {
          matchedAct.photosCount += 1;
        }
      }
    }
  }

  // C. Evaluasi kesiapan sinkronisasi penuh (isReportFullySynced)
  for (const group of reportMap.values()) {
    const allActsSynced = (group.activities || []).every((a) => a.isSynced);
    const allPhotosSynced =
      group.totalPhotos === 0 || group.syncedPhotosCount === group.totalPhotos;

    group.isReportFullySynced = Boolean(
      group.isReportInTargetDb &&
        (group.activitiesCount === 0 || allActsSynced) &&
        allPhotosSynced,
    );

    if (!group.isReportFullySynced && group.needsMigrationCount === 0) {
      group.needsMigrationCount = 1;
    }
  }

  const reportGroups = Array.from(reportMap.values()).sort((a, b) => {
    const dateA = a.reportDate || "";
    const dateB = b.reportDate || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return a.reporterName.localeCompare(b.reporterName);
  });

  const totalItems = items.length;
  const totalBytes = items.reduce((acc, it) => acc + it.fileSize, 0);
  const alreadySyncedCount = items.filter((it) => it.status === "already_synced").length;
  const needsMigrationCount = totalItems - alreadySyncedCount;

  return {
    items,
    totalItems,
    totalBytes,
    alreadySyncedCount,
    needsMigrationCount,
    userGroups: Array.from(userMap.values()).sort((a, b) => b.totalPhotos - a.totalPhotos),
    bucketGroups: Array.from(bucketMap.values()),
    reportGroups,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Downloads a file from legacy storage or public URL fallback.
 */
async function downloadFileFromLegacy(
  bucketId: string,
  storagePath: string,
  sourceUrl?: string,
): Promise<{ blob: Blob; contentType: string }> {
  if (!legacySupabase) throw new Error("Klien database lama tidak tersedia.");

  // 1. Coba download langsung via Storage SDK
  try {
    const { data, error } = await legacySupabase.storage
      .from(bucketId)
      .download(storagePath);

    if (data && !error && data.size > 0) {
      return {
        blob: data,
        contentType: data.type || "image/jpeg",
      };
    }
  } catch {
    // Lanjutkan ke fallback HTTP fetch
  }

  // 2. Fallback ke HTTP fetch via publicUrl
  const effectiveUrl =
    sourceUrl ||
    legacySupabase.storage.from(bucketId).getPublicUrl(storagePath).data?.publicUrl;

  if (effectiveUrl) {
    try {
      const resp = await fetch(effectiveUrl);
      if (resp.ok) {
        const fetchedBlob = await resp.blob();
        if (fetchedBlob.size > 0) {
          return {
            blob: fetchedBlob,
            contentType: fetchedBlob.type || resp.headers.get("content-type") || "image/jpeg",
          };
        }
      }
    } catch {
      // ignore
    }
  }

  throw new Error(`Berkas tidak dapat diunduh dari storage lama pada path "${storagePath}".`);
}

/**
 * Checks if a file physically exists in the target Supabase storage bucket.
 */
async function checkFileExistsInTargetStorage(
  bucketId: string,
  storagePath: string,
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const parts = storagePath.split("/");
    const fileName = parts.pop();
    const folder = parts.join("/");
    const { data, error } = await supabase.storage.from(bucketId).list(folder, {
      limit: 100,
      search: fileName,
    });
    if (!error && Array.isArray(data)) {
      return data.some((f) => f.name === fileName);
    }
  } catch {
    // Non-blocking
  }
  return false;
}

/**
 * Executes migration of media images and complete report data from legacy to primary Supabase.
 * Strictly preserves folder paths, file names, complete textual report contents, and relational bindings.
 * Enforces strict deduplication so neither reports nor media files are duplicated.
 */
export async function executeMediaMigration(
  items: MediaMigrationItem[],
  options: MediaMigrationOptions = {},
  onProgress?: (event: MediaMigrationProgressEvent) => void,
): Promise<MediaMigrationSummaryResult> {
  if (!legacySupabase || !supabase) {
    throw new Error("Koneksi Supabase lama atau baru belum siap.");
  }

  // Filter items based on options
  const filteredItems = items.filter((it) => {
    if (options.selectedBucketIds && options.selectedBucketIds.length > 0) {
      if (!options.selectedBucketIds.includes(it.bucketId)) return false;
    }
    if (options.selectedUserIds && options.selectedUserIds.length > 0) {
      const userKey = it.userRel.userId || it.userRel.userName;
      if (!options.selectedUserIds.includes(userKey)) return false;
    }
    if (options.selectedReportIds && options.selectedReportIds.length > 0) {
      if (it.userRel.reportId && !options.selectedReportIds.includes(it.userRel.reportId)) {
        return false;
      }
    }
    if (options.startDate && it.userRel.reportDate) {
      if (it.userRel.reportDate < options.startDate) return false;
    }
    if (options.endDate && it.userRel.reportDate) {
      if (it.userRel.reportDate > options.endDate) return false;
    }
    if (options.skipAlreadySynced !== false && it.status === "already_synced") {
      return false;
    }
    if (!options.includeOrphans && it.kind === "orphan_storage") {
      return false;
    }
    return true;
  });

  const selectedReportIdSet =
    options.selectedReportIds && options.selectedReportIds.length > 0
      ? new Set(options.selectedReportIds)
      : null;

  // Filter target report groups if provided
  const targetReportGroups = (options.reportGroups || []).filter((rg) => {
    if (selectedReportIdSet && !selectedReportIdSet.has(rg.reportId)) return false;
    if (options.startDate && rg.reportDate && rg.reportDate < options.startDate) return false;
    if (options.endDate && rg.reportDate && rg.reportDate > options.endDate) return false;
    if (options.skipAlreadySynced !== false && rg.isReportFullySynced) return false;
    return true;
  });

  const totalItems = filteredItems.length + targetReportGroups.length;

  if (totalItems === 0) {
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      alreadySyncedCount: 0,
      failedCount: 0,
      transferredBytes: 0,
      completedAt: new Date().toISOString(),
      errors: [],
    };
  }

  // Pastikan bucket target tersedia
  await ensureTargetBucketsExist();

  // 0. Pastikan sesi Admin aktif pada client target (Supabase Baru)
  if (options.adminSession?.session) {
    try {
      const { data: currentAuth } = await supabase.auth.getSession();
      if (!currentAuth?.session) {
        await supabase.auth.setSession(options.adminSession.session);
      }
    } catch (err) {
      console.warn("Gagal menyetel sesi Supabase Auth:", err);
    }
  }

  // 1. Aktifkan allow_any_report_date pada app_settings di Supabase baru
  // Ini krusial agar trigger sync_daily_report_fields() dan policy RLS tidak memblokir laporan tanggal lampau
  try {
    await supabase.from("app_settings").upsert(
      {
        key: "report_rules",
        value: {
          allow_any_report_date: true,
          max_photos_per_activity: 10,
          system_start_date: "2020-01-01",
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  } catch (err) {
    console.warn("Gagal menyetel aturan allow_any_report_date di app_settings:", err);
  }

  let completedItems = 0;
  let successCount = 0;
  let alreadySyncedCount = 0;
  let failedCount = 0;
  let transferredBytes = 0;
  let migratedReportsCount = 0;
  let migratedActivitiesCount = 0;
  const errors: Array<{ path: string; error: string }> = [];

  // Memory caches to avoid duplicate DB checks in a single migration run
  const verifiedUsers = new Map<string, string>(); // name.toLowerCase() -> userId
  const reportIdMap = new Map<string, string>(); // legacyReportId -> targetReportId
  const usedOrdersByReport = new Map<string, Set<number>>();
  const processedPhotoPaths = new Set<string>();

  // Pre-seed known users from target DB
  const { data: existingUsers } = await supabase.from("reporter_directory").select("id, full_name");
  if (existingUsers) {
    for (const u of existingUsers) {
      if (u.full_name) {
        verifiedUsers.set(u.full_name.trim().toLowerCase(), u.id);
      }
    }
  }

  // Helper resolving user directory ID
  async function resolveTargetUserId(name: string, fallbackId?: string | null): Promise<string | null> {
    const norm = (name || "").trim().toLowerCase();
    if (!norm || norm === "petugas tidak terdata") return null;
    if (verifiedUsers.has(norm)) return verifiedUsers.get(norm)!;

    try {
      const { data: matched } = await supabase!
        .from("reporter_directory")
        .select("id")
        .ilike("full_name", name.trim())
        .maybeSingle();

      if (matched?.id) {
        verifiedUsers.set(norm, matched.id);
        return matched.id;
      }

      const newId = fallbackId || crypto.randomUUID();
      await supabase!.from("reporter_directory").upsert(
        { id: newId, full_name: name.trim(), is_active: true },
        { onConflict: "id" },
      );
      verifiedUsers.set(norm, newId);
      return newId;
    } catch {
      return fallbackId || null;
    }
  }

  // -----------------------------------------------------------------------
  // TAHAP A: MIGRASI LAPORAN LENGKAP (Teks Laporan, Detail Aktivitas & Foto)
  // -----------------------------------------------------------------------
  if (targetReportGroups.length > 0) {
    const totalReports = targetReportGroups.length;
    onProgress?.({
      phase: "migrating",
      completedItems: 0,
      totalItems,
      transferredBytes: 0,
      totalBytes: 0,
      percent: 0,
      statusText: `Memulai migrasi ${totalReports} laporan lengkap ke Database Baru...`,
      logMessage: `[START] Memulai migrasi data teks dan detail untuk ${totalReports} laporan terpilih.`,
    });

    // Pre-cache valid target template IDs and approver IDs for foreign key safety
    let validTemplateIds = new Set<string>();
    let validApproverIds = new Set<string>();
    try {
      const [{ data: tList }, { data: aList }] = await Promise.all([
        supabase.from("report_templates").select("id"),
        supabase.from("report_template_approvers").select("id"),
      ]);
      if (tList) validTemplateIds = new Set(tList.map((t: any) => t.id));
      if (aList) validApproverIds = new Set(aList.map((a: any) => a.id));
    } catch (e) {
      console.warn("Gagal mengambil daftar template/approver target:", e);
    }

    for (let rIdx = 0; rIdx < targetReportGroups.length; rIdx++) {
      options.signal?.throwIfAborted();
      const repGroup = targetReportGroups[rIdx];

      onProgress?.({
        phase: "migrating",
        completedItems: rIdx,
        totalItems,
        transferredBytes,
        totalBytes: 0,
        percent: Math.round((rIdx / totalItems) * 100),
        statusText: `Memproses Laporan (${rIdx + 1}/${totalReports}): ${repGroup.reportDate} - ${repGroup.reporterName}`,
        logMessage: `[PROSES LAPORAN] Memeriksa data laporan ${repGroup.reportDate} [${repGroup.reporterName}]`,
      });

      try {
        const targetUserId = await resolveTargetUserId(repGroup.reporterName, repGroup.userId);
        const legacyRep = repGroup.legacyReportData || {};

        // 1. DEDUPLIKASI LAPORAN (daily_reports)
        let targetReportId: string | null = null;

        // A. Cek berdasarkan ID terlebih dahulu
        const { data: existingRepById } = await supabase
          .from("daily_reports")
          .select("id, reporter_name, report_date")
          .eq("id", repGroup.reportId)
          .maybeSingle();

        if (existingRepById?.id) {
          targetReportId = existingRepById.id;
        } else if (repGroup.reportDate && repGroup.reporterName) {
          // B. Cek berdasarkan Tanggal + Nama Pelapor untuk mencegah bentrok unique constraint (uq_daily_report_per_name_day)
          const { data: existingRepByNameDate } = await supabase
            .from("daily_reports")
            .select("id, reporter_name, report_date")
            .eq("report_date", repGroup.reportDate)
            .ilike("reporter_name", repGroup.reporterName.trim())
            .maybeSingle();

          if (existingRepByNameDate?.id) {
            targetReportId = existingRepByNameDate.id;
          }
        }

        const repDate = repGroup.reportDate || legacyRep.report_date || new Date().toISOString().split("T")[0];
        const repName = repGroup.reporterName || legacyRep.reporter_name || "Petugas";

        const safeTemplateId =
          legacyRep.template_id && validTemplateIds.has(legacyRep.template_id)
            ? legacyRep.template_id
            : null;
        const safeCoordinatorId =
          legacyRep.template_approver_coordinator_id && validApproverIds.has(legacyRep.template_approver_coordinator_id)
            ? legacyRep.template_approver_coordinator_id
            : null;
        const safeDivisionHeadId =
          legacyRep.template_approver_division_head_id && validApproverIds.has(legacyRep.template_approver_division_head_id)
            ? legacyRep.template_approver_division_head_id
            : null;

        if (targetReportId) {
          // Laporan sudah ada di DB Target: Perbarui field teks lengkap jika sebelumnya kosong/placeholder
          const updatePayload: any = {
            display_date_text: legacyRep.display_date_text || repDate,
            tim: legacyRep.tim || repGroup.tim || "TRC",
            template_id: safeTemplateId,
            template_approver_coordinator_id: safeCoordinatorId,
            approver_coordinator_name: legacyRep.approver_coordinator_name || null,
            approver_coordinator_nip: legacyRep.approver_coordinator_nip || null,
            template_approver_division_head_id: safeDivisionHeadId,
            approver_division_head_name: legacyRep.approver_division_head_name || null,
            approver_division_head_title: legacyRep.approver_division_head_title || null,
            approver_division_head_nip: legacyRep.approver_division_head_nip || null,
            updated_at: legacyRep.updated_at || new Date().toISOString(),
            updated_by_role: legacyRep.updated_by_role || "admin",
            updated_by_label: legacyRep.updated_by_label || "Migrasi Lengkap",
          };
          if (targetUserId) {
            updatePayload.reporter_directory_id = targetUserId;
          }

          let { error: updErr } = await supabase
            .from("daily_reports")
            .update(updatePayload)
            .eq("id", targetReportId);

          if (updErr && (updErr.code === "23503" || updErr.message?.includes("foreign key constraint"))) {
            updatePayload.template_id = null;
            updatePayload.template_approver_coordinator_id = null;
            updatePayload.template_approver_division_head_id = null;
            const retryFk = await supabase.from("daily_reports").update(updatePayload).eq("id", targetReportId);
            updErr = retryFk.error;
          }

          if (updErr && updatePayload.reporter_directory_id) {
            delete updatePayload.reporter_directory_id;
            await supabase.from("daily_reports").update(updatePayload).eq("id", targetReportId);
          }

          onProgress?.({
            phase: "migrating",
            completedItems: rIdx,
            totalItems,
            transferredBytes,
            totalBytes: 0,
            percent: Math.round((rIdx / totalItems) * 100),
            statusText: `Laporan sudah ada, teks diperbarui: ${repDate} - ${repName}`,
            logMessage: `[DEDUP LAPORAN] Laporan ${repDate} (${repName}) terhubung ke ID [${targetReportId}]. Data teks lengkap diperbarui.`,
          });
        } else {
          // Laporan baru: Simpan seluruh baris lengkap
          targetReportId = repGroup.reportId;
          const insertPayload: any = {
            id: targetReportId,
            reporter_name: repName,
            report_date: repDate,
            display_date_text: legacyRep.display_date_text || repDate,
            tim: legacyRep.tim || repGroup.tim || "TRC",
            template_id: safeTemplateId,
            template_approver_coordinator_id: safeCoordinatorId,
            approver_coordinator_name: legacyRep.approver_coordinator_name || null,
            approver_coordinator_nip: legacyRep.approver_coordinator_nip || null,
            template_approver_division_head_id: safeDivisionHeadId,
            approver_division_head_name: legacyRep.approver_division_head_name || null,
            approver_division_head_title: legacyRep.approver_division_head_title || null,
            approver_division_head_nip: legacyRep.approver_division_head_nip || null,
            created_at: legacyRep.created_at || new Date().toISOString(),
            updated_at: legacyRep.updated_at || new Date().toISOString(),
            created_by_role: legacyRep.created_by_role || "admin",
            created_by_label: legacyRep.created_by_label || "Migrasi Lengkap",
            updated_by_role: legacyRep.updated_by_role || "admin",
            updated_by_label: legacyRep.updated_by_label || "Migrasi Lengkap",
          };
          if (targetUserId) {
            insertPayload.reporter_directory_id = targetUserId;
          }

          let { error: insErr } = await supabase
            .from("daily_reports")
            .upsert(insertPayload, { onConflict: "id" });

          if (insErr && (insErr.code === "23503" || insErr.message?.includes("foreign key constraint"))) {
            insertPayload.template_id = null;
            insertPayload.template_approver_coordinator_id = null;
            insertPayload.template_approver_division_head_id = null;
            const retryFk = await supabase
              .from("daily_reports")
              .upsert(insertPayload, { onConflict: "id" });
            insErr = retryFk.error;
          }

          if (insErr && insertPayload.reporter_directory_id) {
            delete insertPayload.reporter_directory_id;
            const retry = await supabase
              .from("daily_reports")
              .upsert(insertPayload, { onConflict: "id" });
            insErr = retry.error;
          }

          if (insErr) {
            throw new Error(`Gagal menyimpan laporan [${repGroup.reportId}]: ${insErr.message}`);
          }

          onProgress?.({
            phase: "migrating",
            completedItems: rIdx,
            totalItems,
            transferredBytes,
            totalBytes: 0,
            percent: Math.round((rIdx / totalItems) * 100),
            statusText: `Laporan baru tersimpan: ${repDate} - ${repName}`,
            logMessage: `[LAPORAN BARU] ${repDate} - ${repName} berhasil didaftarkan ke DB Baru.`,
          });
        }

        reportIdMap.set(repGroup.reportId, targetReportId);
        migratedReportsCount += 1;

        // 2. DEDUPLIKASI AKTIVITAS (daily_report_activities)
        const { data: existingActs } = await supabase
          .from("daily_report_activities")
          .select("id, activity_order, activity_description, start_time_text, end_time_text")
          .eq("report_id", targetReportId);

        const usedOrders = new Set((existingActs || []).map((a) => Number(a.activity_order)));
        usedOrdersByReport.set(targetReportId, usedOrders);

        const activityIdMap = new Map<string, string>(); // legacyActId -> targetActId

        const activitiesToMigrate =
          repGroup.activities && repGroup.activities.length > 0 ? repGroup.activities : [];

        for (const act of activitiesToMigrate) {
          let targetActId: string | null = null;

          // Cek apakah aktivitas ini sudah ada di target
          const matchedById = (existingActs || []).find((ea) => ea.id === act.id);
          const matchedByOrder = (existingActs || []).find(
            (ea) => Number(ea.activity_order) === act.activityOrder,
          );

          const matchedAct = matchedById || matchedByOrder;

          if (matchedAct) {
            targetActId = matchedAct.id;
            // Perbarui deskripsi teks dan jam aktivitas jika perlu
            await supabase
              .from("daily_report_activities")
              .update({
                activity_description: act.activityDescription,
                start_time_text: act.startTimeText || "08:00",
                end_time_text: act.endTimeText || "16:00",
              })
              .eq("id", targetActId);
          } else {
            // Tentukan urutan aman yang belum terpakai
            let safeOrder = act.activityOrder || 1;
            while (usedOrders.has(safeOrder)) {
              safeOrder += 1;
            }
            usedOrders.add(safeOrder);

            targetActId = act.id || crypto.randomUUID();
            const actPayload = {
              id: targetActId,
              report_id: targetReportId,
              activity_order: safeOrder,
              activity_description: act.activityDescription || "Aktivitas Dokumentasi Lapangan",
              start_time_text: act.startTimeText || "08:00",
              end_time_text: act.endTimeText || "16:00",
            };

            const { error: actErr } = await supabase
              .from("daily_report_activities")
              .upsert(actPayload, { onConflict: "id" });

            if (actErr) {
              // Coba via RPC jika direct upsert terkendala RLS
              await supabase.rpc("upsert_daily_report_activity", {
                act_id: targetActId,
                act_report_id: targetReportId,
                act_activity_order: safeOrder,
                act_description: act.activityDescription || "Aktivitas Dokumentasi Lapangan",
                act_start_time: act.startTimeText || "08:00",
                act_end_time: act.endTimeText || "16:00",
              });
            }
          }

          if (targetActId) {
            activityIdMap.set(act.id, targetActId);
          }
          migratedActivitiesCount += 1;
        }

        // 3. DEDUPLIKASI FOTO MEDIA & TRANSFER STORAGE
        for (const photoItem of repGroup.items) {
          options.signal?.throwIfAborted();
          processedPhotoPaths.add(photoItem.storagePath);

          const targetActId =
            (photoItem.userRel.activityId ? activityIdMap.get(photoItem.userRel.activityId) : null) ||
            activityIdMap.values().next().value ||
            null;

          if (!targetActId) continue;

          // Cek apakah file sudah ada di Storage Supabase Baru
          const isFileInTargetStorage =
            photoItem.isAlreadyInTargetStorage ||
            (await checkFileExistsInTargetStorage("daily-report-proofs", photoItem.storagePath));

          if (!isFileInTargetStorage) {
            // Unduh dari storage lama dan upload ke storage baru
            const { blob, contentType } = await downloadFileFromLegacy(
              "daily-report-proofs",
              photoItem.storagePath,
              photoItem.sourceUrl,
            );

            const { error: uploadErr } = await supabase.storage
              .from("daily-report-proofs")
              .upload(photoItem.storagePath, blob, {
                upsert: true,
                contentType: contentType || photoItem.mimeType || "image/jpeg",
              });

            if (uploadErr) {
              throw new Error(`Gagal upload media [${photoItem.storagePath}]: ${uploadErr.message}`);
            }

            transferredBytes += blob.size || photoItem.fileSize;
          } else {
            onProgress?.({
              phase: "migrating",
              completedItems: rIdx,
              totalItems,
              transferredBytes,
              totalBytes: 0,
              percent: Math.round((rIdx / totalItems) * 100),
              statusText: `Media sudah ada di Storage baru: ${photoItem.originalFileName}`,
              logMessage: `[DEDUP MEDIA] ${photoItem.storagePath} sudah ada di storage target. Melewati upload berkas fisik.`,
            });
          }

          // Simpan / update relasi foto di DB Baru
          const targetPublicUrl = `${supabaseUrl}/storage/v1/object/public/daily-report-proofs/${photoItem.storagePath}`;

          let photoSaved = false;
          try {
            const { error: rpcErr } = await supabase.rpc("upsert_daily_report_activity_photo", {
              photo_id: photoItem.id || null,
              photo_activity_id: targetActId,
              photo_storage_path: photoItem.storagePath,
              photo_public_url: targetPublicUrl,
              photo_original_file_name: photoItem.originalFileName || "photo.jpg",
              photo_sort_order: photoItem.userRel.activityOrder || 1,
            });
            if (!rpcErr) photoSaved = true;
          } catch {
            // fallback
          }

          if (!photoSaved) {
            await supabase.from("daily_report_activity_photos").upsert(
              {
                id: photoItem.id,
                activity_id: targetActId,
                storage_path: photoItem.storagePath,
                public_url: targetPublicUrl,
                original_file_name: photoItem.originalFileName,
                sort_order: photoItem.userRel.activityOrder || 1,
              },
              { onConflict: "storage_path" },
            );
          }

          photoItem.status = "synced";
          photoItem.targetUrl = targetPublicUrl;
          photoItem.isAlreadyInTargetStorage = true;
          photoItem.isAlreadyInTargetDb = true;
          successCount += 1;
        }

        completedItems += 1;

        onProgress?.({
          phase: "migrating",
          completedItems,
          totalItems,
          transferredBytes,
          totalBytes: 0,
          percent: Math.round((completedItems / totalItems) * 100),
          statusText: `Selesai Laporan (${rIdx + 1}/${totalReports}): ${repDate} - ${repName}`,
          logMessage: `[BERHASIL LAPORAN] Laporan ${repDate} - ${repName} (${repGroup.activitiesCount} aktivitas, ${repGroup.totalPhotos} foto) berhasil dimigrasi penuh.`,
        });
      } catch (err: any) {
        failedCount += 1;
        const msg = err?.message || String(err);
        errors.push({ path: repGroup.reportId, error: msg });
        onProgress?.({
          phase: "migrating",
          completedItems: completedItems + 1,
          totalItems,
          transferredBytes,
          totalBytes: 0,
          percent: Math.round(((completedItems + 1) / totalItems) * 100),
          statusText: `Gagal memigrasi laporan ${repGroup.reportDate}: ${msg}`,
          logMessage: `[ERROR LAPORAN] ${repGroup.reportDate} [${repGroup.reporterName}]: ${msg}`,
        });
      }

      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // -----------------------------------------------------------------------
  // TAHAP B: PROSES MEDIA STANDALONE LAINNYA (TANDA TANGAN & MEDIA YANG BELUM TERPROSES)
  // -----------------------------------------------------------------------
  const remainingItems = filteredItems.filter((it) => !processedPhotoPaths.has(it.storagePath));

  for (let i = 0; i < remainingItems.length; i++) {
    options.signal?.throwIfAborted();
    const item = remainingItems[i];

    onProgress?.({
      phase: "migrating",
      currentItem: item,
      completedItems,
      totalItems,
      transferredBytes,
      totalBytes: 0,
      percent: Math.round((completedItems / totalItems) * 100),
      statusText: `Memproses media (${i + 1}/${remainingItems.length}): ${item.originalFileName}`,
    });

    try {
      if (item.kind === "report_photo" && item.userRel.reportId) {
        const targetUserId = await resolveTargetUserId(item.userRel.userName, item.userRel.userId);
        let targetRepId = reportIdMap.get(item.userRel.reportId) || null;

        if (!targetRepId) {
          const { data: repExist } = await supabase
            .from("daily_reports")
            .select("id")
            .eq("id", item.userRel.reportId)
            .maybeSingle();

          if (repExist?.id) {
            targetRepId = repExist.id;
          } else if (item.userRel.reportDate && item.userRel.userName) {
            const { data: repByName } = await supabase
              .from("daily_reports")
              .select("id")
              .eq("report_date", item.userRel.reportDate)
              .ilike("reporter_name", item.userRel.userName.trim())
              .maybeSingle();
            if (repByName?.id) targetRepId = repByName.id;
          }

          if (!targetRepId) {
            targetRepId = item.userRel.reportId;
            const repPayload: any = {
              id: targetRepId,
              reporter_name: item.userRel.userName || "Petugas",
              report_date: item.userRel.reportDate || new Date().toISOString().split("T")[0],
              display_date_text: item.userRel.reportDate || new Date().toISOString().split("T")[0],
              tim: item.userRel.tim || "TRC",
              created_by_role: "admin",
              created_by_label: "Migrasi Media",
              updated_by_role: "admin",
              updated_by_label: "Migrasi Media",
            };
            if (targetUserId) repPayload.reporter_directory_id = targetUserId;
            await supabase.from("daily_reports").upsert(repPayload, { onConflict: "id" });
          }
          reportIdMap.set(item.userRel.reportId, targetRepId);
        }

        let targetActId = item.userRel.activityId || null;
        if (targetActId && targetRepId) {
          const { data: actExist } = await supabase
            .from("daily_report_activities")
            .select("id")
            .eq("id", targetActId)
            .maybeSingle();

          if (!actExist) {
            let used = usedOrdersByReport.get(targetRepId);
            if (!used) {
              const { data: acts } = await supabase
                .from("daily_report_activities")
                .select("activity_order")
                .eq("report_id", targetRepId);
              used = new Set((acts || []).map((a) => Number(a.activity_order)));
              usedOrdersByReport.set(targetRepId, used);
            }
            let safeOrder = item.userRel.activityOrder || 1;
            while (used.has(safeOrder)) safeOrder += 1;
            used.add(safeOrder);

            await supabase.from("daily_report_activities").upsert(
              {
                id: targetActId,
                report_id: targetRepId,
                activity_order: safeOrder,
                activity_description: item.userRel.activityDescription || "Aktivitas Dokumentasi",
                start_time_text: "08:00",
                end_time_text: "16:00",
              },
              { onConflict: "id" },
            );
          }
        }
      }

      // Transfer file ke storage target
      const isFileInTarget =
        item.isAlreadyInTargetStorage ||
        (await checkFileExistsInTargetStorage(item.bucketId, item.storagePath));

      if (!isFileInTarget) {
        const { blob, contentType } = await downloadFileFromLegacy(
          item.bucketId,
          item.storagePath,
          item.sourceUrl,
        );

        const { error: uploadErr } = await supabase.storage
          .from(item.bucketId)
          .upload(item.storagePath, blob, {
            upsert: true,
            contentType: contentType || item.mimeType || "image/jpeg",
          });

        if (uploadErr) {
          throw new Error(`Gagal upload media [${item.storagePath}]: ${uploadErr.message}`);
        }
        transferredBytes += blob.size || item.fileSize;
      }

      const targetPublicUrl = `${supabaseUrl}/storage/v1/object/public/${item.bucketId}/${item.storagePath}`;

      if (item.kind === "report_photo" && item.userRel.activityId) {
        let photoSaved = false;
        try {
          const { error: rpcErr } = await supabase.rpc("upsert_daily_report_activity_photo", {
            photo_id: item.id || null,
            photo_activity_id: item.userRel.activityId,
            photo_storage_path: item.storagePath,
            photo_public_url: targetPublicUrl,
            photo_original_file_name: item.originalFileName || "photo.jpg",
            photo_sort_order: item.userRel.activityOrder || 1,
          });
          if (!rpcErr) photoSaved = true;
        } catch {
          // fallback
        }

        if (!photoSaved) {
          await supabase.from("daily_report_activity_photos").upsert(
            {
              id: item.id,
              activity_id: item.userRel.activityId,
              storage_path: item.storagePath,
              public_url: targetPublicUrl,
              original_file_name: item.originalFileName,
              sort_order: item.userRel.activityOrder || 1,
            },
            { onConflict: "storage_path" },
          );
        }
      } else if (item.kind === "team_signature") {
        await supabase
          .from("team_types")
          .update({ signature_url: targetPublicUrl })
          .eq("id", item.id);
      } else if (item.kind === "approver_signature") {
        await supabase
          .from("report_template_approvers")
          .update({ signature_url: targetPublicUrl })
          .eq("id", item.id);
      }

      item.status = "synced";
      item.targetUrl = targetPublicUrl;
      item.isAlreadyInTargetStorage = true;
      item.isAlreadyInTargetDb = true;
      successCount += 1;
    } catch (err: any) {
      failedCount += 1;
      const msg = err?.message || String(err);
      errors.push({ path: item.storagePath, error: msg });
    }

    completedItems += 1;
  }

  // Refresh cache relasi media
  invalidateMediaReferences();

  const grandTotal = successCount + migratedReportsCount;
  onProgress?.({
    phase: "done",
    completedItems: grandTotal,
    totalItems: grandTotal,
    transferredBytes,
    totalBytes: 0,
    percent: 100,
    statusText: `Migrasi selesai! ${migratedReportsCount} laporan, ${migratedActivitiesCount} aktivitas, dan ${successCount} berkas media berhasil.`,
    logMessage: `[SELESAI] Migrasi rampung. ${migratedReportsCount} laporan lengkap dan ${successCount} media berhasil disinkronkan tanpa duplikasi.`,
  });

  return {
    success: failedCount === 0,
    totalItems: grandTotal,
    successCount,
    alreadySyncedCount,
    failedCount,
    transferredBytes,
    migratedReportsCount,
    migratedActivitiesCount,
    completedAt: new Date().toISOString(),
    errors,
  };
}
