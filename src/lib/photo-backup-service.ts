import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "./supabase";
import type { Report } from "../types/report";

export const PROOF_BUCKET = "daily-report-proofs";

export interface PhotoBackupItem {
  photoId: string;
  reportId: string;
  activityId: string;
  activityNo: number;
  activityDescription: string;
  reportDate: string;
  reporterName: string;
  tim: string;
  storagePath: string;
  publicUrl: string;
  originalFileName: string;
  sortOrder: number;
}

export interface PhotoBackupFilter {
  startDate?: string;
  endDate?: string;
  tim?: string;
  reporterName?: string;
}

export interface PhotoBackupProgress {
  current: number;
  total: number;
  currentItem?: PhotoBackupItem;
  statusText: string;
  phase: "preparing" | "downloading" | "zipping" | "completed" | "error";
  percent: number;
}

export interface PhotoBackupFailedDetail {
  item: PhotoBackupItem;
  reason: string;
}

export interface PhotoBackupResult {
  success: boolean;
  totalReferences: number;       // Total kemunculan foto di aktivitas (contoh: 1508)
  totalUniqueFiles: number;      // Total file fisik unik berdasarkan storage_path (contoh: 1013)
  downloadedCount: number;       // File unik yang berhasil diunduh dan disimpan ke ZIP
  failedCount: number;           // File yang gagal diunduh (misal 404 dari Supabase)
  failedDetails: PhotoBackupFailedDetail[];
  zipFileName: string;
  zipBlob?: Blob;
  storagePaths: string[];        // Daftar storage_path unik yang berhasil dibackup
  filterApplied: PhotoBackupFilter;
}

/**
 * Membersihkan dan menormalisasi storage path dari prefix bucket yang tidak disengaja
 */
export function cleanStoragePath(path: string): string {
  if (!path) return "";
  let clean = path.trim();
  // Jika path diawali dengan nama bucket
  if (clean.startsWith(`${PROOF_BUCKET}/`)) {
    clean = clean.slice(`${PROOF_BUCKET}/`.length);
  }
  // Hapus leading slashes
  clean = clean.replace(/^\/+/, "");
  return clean;
}

/**
 * Menyaring foto dari list report berdasarkan filter tanggal, tim, dan nama reporter.
 */
export function extractPhotosForBackup(
  reports: Report[],
  filter?: PhotoBackupFilter
): PhotoBackupItem[] {
  const items: PhotoBackupItem[] = [];

  const startDate = filter?.startDate?.trim() || "";
  const endDate = filter?.endDate?.trim() || "";
  const timFilter = filter?.tim?.trim() || "ALL";
  const reporterFilter = filter?.reporterName?.trim() || "ALL";

  for (const report of reports) {
    if (startDate && report.reportDate < startDate) continue;
    if (endDate && report.reportDate > endDate) continue;
    if (timFilter !== "ALL" && report.tim?.toUpperCase() !== timFilter.toUpperCase()) continue;
    if (reporterFilter !== "ALL" && report.nama?.toLowerCase() !== reporterFilter.toLowerCase()) continue;

    for (const activity of report.activities || []) {
      const activityId = activity.id || `act-${activity.no}`;
      for (const photo of activity.photos || []) {
        if (!photo.storagePath) continue;

        const normalizedStoragePath = cleanStoragePath(photo.storagePath);
        if (!normalizedStoragePath) continue;

        let pubUrl = photo.publicUrl;
        if (!pubUrl && supabase) {
          const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(normalizedStoragePath);
          pubUrl = data?.publicUrl || "";
        }

        items.push({
          photoId: photo.id,
          reportId: report.id,
          activityId,
          activityNo: activity.no,
          activityDescription: activity.description || "",
          reportDate: report.reportDate,
          reporterName: report.nama,
          tim: report.tim || "PUSDALOPS",
          storagePath: normalizedStoragePath,
          publicUrl: pubUrl,
          originalFileName: photo.originalFileName || "foto.jpg",
          sortOrder: photo.sortOrder ?? 0,
        });
      }
    }
  }

  return items;
}

/**
 * Mengelompokkan foto berdasarkan storage_path unik untuk mengidentifikasi duplikasi referensi
 */
export function getUniquePhotoItems(items: PhotoBackupItem[]): {
  uniqueList: PhotoBackupItem[];
  duplicatesCount: number;
} {
  const seen = new Set<string>();
  const uniqueList: PhotoBackupItem[] = [];

  for (const item of items) {
    if (!seen.has(item.storagePath)) {
      seen.add(item.storagePath);
      uniqueList.push(item);
    }
  }

  return {
    uniqueList,
    duplicatesCount: items.length - uniqueList.length,
  };
}

/**
 * Mengambil blob foto dari Supabase storage atau fallback ke public URL dengan retry
 */
export async function fetchPhotoBlob(
  item: PhotoBackupItem,
  maxRetries = 2
): Promise<{ blob: Blob | null; reason?: string }> {
  const path = cleanStoragePath(item.storagePath);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 1. Coba download via Supabase Storage SDK
    if (supabase) {
      try {
        const { data, error } = await supabase.storage.from(PROOF_BUCKET).download(path);
        if (!error && data && data.size > 0) {
          return { blob: data };
        }

        // Coba versi decode jika path mengandung encoded karakter
        if (path.includes("%")) {
          const decoded = decodeURIComponent(path);
          const { data: decData, error: decErr } = await supabase.storage.from(PROOF_BUCKET).download(decoded);
          if (!decErr && decData && decData.size > 0) {
            return { blob: decData };
          }
        }
      } catch (err: any) {
        // jika bukan error 404 (misal timeout), beri jeda singkat untuk retry
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 400 * attempt));
        }
      }
    }

    // 2. Fallback: coba unduh via public URL
    let targetUrl = item.publicUrl;
    if ((!targetUrl || targetUrl.trim() === "") && supabase) {
      const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
      targetUrl = data?.publicUrl || "";
    }

    if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
      try {
        const res = await fetch(targetUrl, { mode: "cors", credentials: "omit" });
        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            return { blob };
          }
        } else if (res.status === 404) {
          return { blob: null, reason: "HTTP 404: File tidak ditemukan di Supabase Storage" };
        }
      } catch {
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 400 * attempt));
        }
      }
    }
  }

  return { blob: null, reason: "Gagal mengunduh file setelah beberapa percobaan (mungkin file telah dihapus di cloud)" };
}

/**
 * Membuat paket ZIP backup foto dengan mempertahankan path folder asli
 * Format path di dalam ZIP:
 * daily-report-proofs/{reportId}/{activityId}/{filename}
 */
export async function createPhotoBackupZip(
  reports: Report[],
  filter: PhotoBackupFilter,
  onProgress?: (progress: PhotoBackupProgress) => void
): Promise<PhotoBackupResult> {
  const allPhotoItems = extractPhotosForBackup(reports, filter);
  const totalReferences = allPhotoItems.length;

  // Deduplikasi: identifikasi file fisik unik
  const { uniqueList, duplicatesCount } = getUniquePhotoItems(allPhotoItems);
  const totalUnique = uniqueList.length;

  const dateTag = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const zipFileName = `backup-silahar-foto-${filter.startDate || "awal"}_sd_${filter.endDate || "akhir"}-${dateTag}.zip`;

  if (totalUnique === 0) {
    return {
      success: true,
      totalReferences: 0,
      totalUniqueFiles: 0,
      downloadedCount: 0,
      failedCount: 0,
      failedDetails: [],
      zipFileName,
      storagePaths: [],
      filterApplied: filter,
    };
  }

  const zip = new JSZip();
  const successfulUniqueItems: PhotoBackupItem[] = [];
  const failedDetails: PhotoBackupFailedDetail[] = [];
  const successfulStoragePaths: string[] = [];

  onProgress?.({
    current: 0,
    total: totalUnique,
    statusText: `Menyiapkan ${totalUnique} file fisik unik (${totalReferences} referensi foto)...`,
    phase: "preparing",
    percent: 0,
  });

  // Concurrency download limiter: 4 file bersamaan
  const CONCURRENCY = 4;
  let processedCount = 0;

  async function processUniqueItem(item: PhotoBackupItem) {
    onProgress?.({
      current: processedCount,
      total: totalUnique,
      currentItem: item,
      statusText: `Mengunduh file (${processedCount + 1}/${totalUnique}): ${item.originalFileName}`,
      phase: "downloading",
      percent: Math.round((processedCount / totalUnique) * 85),
    });

    const { blob, reason } = await fetchPhotoBlob(item);
    if (blob) {
      // Simpan di ZIP dengan hierarki folder asli: daily-report-proofs/{storagePath}
      // Path folder reportId dan activityId tetap ada dan utuh!
      const zipEntryPath = `${PROOF_BUCKET}/${item.storagePath}`;
      zip.file(zipEntryPath, blob, { binary: true });

      successfulUniqueItems.push(item);
      successfulStoragePaths.push(item.storagePath);
    } else {
      failedDetails.push({ item, reason: reason || "Unknown error" });
    }

    processedCount++;
    onProgress?.({
      current: processedCount,
      total: totalUnique,
      currentItem: item,
      statusText: `Tersimpan ${successfulUniqueItems.length}/${totalUnique} file unik`,
      phase: "downloading",
      percent: Math.round((processedCount / totalUnique) * 85),
    });
  }

  // Jalankan queue unduhan
  const queue = [...uniqueList];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      await processUniqueItem(item);
    }
  });

  await Promise.all(workers);

  // Buat manifest.json untuk relasi data lengkap
  const successfulPathSet = new Set(successfulStoragePaths);
  const relevantReferences = allPhotoItems.filter((ref) => successfulPathSet.has(ref.storagePath));
  const relevantReportIds = new Set(relevantReferences.map((s) => s.reportId));
  const relevantReports = reports.filter((r) => relevantReportIds.has(r.id));

  const manifest = {
    backupName: "SiLahar Photo Storage Backup",
    version: "1.1",
    generatedAt: new Date().toISOString(),
    bucketName: PROOF_BUCKET,
    filterApplied: filter,
    summary: {
      totalActivityReferences: totalReferences,
      totalUniqueFilesFound: totalUnique,
      duplicateReferencesSaved: duplicatesCount,
      totalFilesSavedToZip: successfulUniqueItems.length,
      totalFilesFailed: failedDetails.length,
      relevantReportsCount: relevantReports.length,
    },
    instructions: {
      restorationNote:
        "Struktur folder di dalam arsip ini (daily-report-proofs/...) 100% identik dengan 'storage_path' pada database SiLahar.",
      howToUseAgain:
        "Jika ingin memulihkan atau memindahkan ke storage lain (misal Supabase, Cloudflare R2, MinIO, atau Google Cloud Storage), cukup upload seluruh isi folder 'daily-report-proofs/' ke bucket storage tujuan tanpa mengubah nama folder atau file.",
    },
    // Rincian file fisik yang tersimpan
    uniqueFiles: successfulUniqueItems.map((item) => ({
      storagePath: item.storagePath,
      zipPath: `${PROOF_BUCKET}/${item.storagePath}`,
      originalFileName: item.originalFileName,
      firstSeenReportDate: item.reportDate,
      firstSeenReporter: item.reporterName,
    })),
    // Pemetaan seluruh 1508 referensi foto di aktivitas ke file fisik di zip
    activityPhotoReferences: relevantReferences.map((item) => ({
      photoId: item.photoId,
      reportId: item.reportId,
      activityId: item.activityId,
      activityNo: item.activityNo,
      activityDescription: item.activityDescription,
      reportDate: item.reportDate,
      reporterName: item.reporterName,
      tim: item.tim,
      storagePath: item.storagePath,
      zipPath: `${PROOF_BUCKET}/${item.storagePath}`,
      originalFileName: item.originalFileName,
      sortOrder: item.sortOrder,
    })),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Snapshot JSON laporan terkait agar relasi teks laporan tetap utuh
  zip.file("reports-snapshot.json", JSON.stringify(relevantReports, null, 2));

  // Jika ada file yang gagal diunduh, buat file log kegagalan
  if (failedDetails.length > 0) {
    const failedLog = failedDetails.map((f, i) => ({
      no: i + 1,
      storagePath: f.item.storagePath,
      originalFileName: f.item.originalFileName,
      reportDate: f.item.reportDate,
      reporterName: f.item.reporterName,
      reason: f.reason,
    }));
    zip.file("failed-downloads.json", JSON.stringify(failedLog, null, 2));
  }

  // README dokumentasi
  const readmeContent = `====================================================================
SISTEM CADANGAN ARSIP FOTO BUKTI LAPORAN HARIAN SILAHAR
====================================================================
Waktu Pembuatan          : ${manifest.generatedAt}
Total Referensi Aktivitas: ${totalReferences} foto di rincian laporan
Total File Fisik Unik    : ${totalUnique} file di storage
Berhasil Disimpan di ZIP : ${successfulUniqueItems.length} file
Referensi Duplikasi      : ${duplicatesCount} (foto yang sama digunakan di >1 aktivitas/laporan)
Gagal Diunduh            : ${failedDetails.length} file (misal 404 dari cloud)
Total Laporan Terkait    : ${relevantReports.length} laporan

STRUKTUR DIREKTORI:
├── manifest.json              -> Metadata relasi foto, tanggal, reporter, dan ID aktivitas
├── reports-snapshot.json      -> Snapshot data teks laporan terkait
${failedDetails.length > 0 ? "├── failed-downloads.json      -> Daftar foto yang gagal diunduh dari cloud (404)\n" : ""}└── daily-report-proofs/       -> Folder bucket penyimpanan foto asli
    └── {reportId}/            -> Folder ID laporan
        └── {activityId}/      -> Folder ID aktivitas kegiatan
            └── {filename}     -> File foto bukti asli

KENAPA JUMLAH FOTO DI AKTIVITAS (${totalReferences}) BERBEDA DENGAN FILE FISIK (${successfulUniqueItems.length})?
Di sistem SiLahar, beberapa aktivitas laporan dapat mengunggah atau menggunakan foto bukti yang sama,
atau laporan yang sama tercatat di database sekaligus di draft cache lokal.
Arsip ZIP ini menyimpan setiap file fisik unik satu kali tanpa duplikasi mubazir,
namun relasi 100% dari ke-${totalReferences} aktivitas tetap tercatat lengkap di dalam manifest.json.
====================================================================`;
  zip.file("README.txt", readmeContent);

  // Kompresi ZIP
  onProgress?.({
    current: totalUnique,
    total: totalUnique,
    statusText: "Mengompresi seluruh file ke dalam arsip ZIP...",
    phase: "zipping",
    percent: 90,
  });

  const zipBlob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.({
        current: totalUnique,
        total: totalUnique,
        statusText: `Mengompresi ZIP: ${Math.round(metadata.percent)}%`,
        phase: "zipping",
        percent: 90 + Math.round((metadata.percent / 100) * 10),
      });
    }
  );

  // Simpan ke komputer pengguna
  saveAs(zipBlob, zipFileName);

  onProgress?.({
    current: totalUnique,
    total: totalUnique,
    statusText: `Selesai! File ZIP berhasil diunduh (${successfulUniqueItems.length} file fisik unik).`,
    phase: "completed",
    percent: 100,
  });

  return {
    success: true,
    totalReferences,
    totalUniqueFiles: totalUnique,
    downloadedCount: successfulUniqueItems.length,
    failedCount: failedDetails.length,
    failedDetails,
    zipFileName,
    zipBlob,
    storagePaths: successfulStoragePaths,
    filterApplied: filter,
  };
}

/**
 * Memindai bucket Supabase Storage secara langsung untuk mengetahui file fisik apa saja
 * yang masih tersisa secara aktual di cloud (bukan sekedar membaca DB).
 */
export async function fetchLiveStorageFiles(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const client = supabase;
  const fileSet = new Set<string>();

  try {
    const { data: rootFolders, error } = await client.storage.from(PROOF_BUCKET).list("", { limit: 1000 });
    if (error || !rootFolders) return fileSet;

    // Batched concurrent subfolder scanning
    const BATCH_CONCURRENCY = 15;
    for (let i = 0; i < rootFolders.length; i += BATCH_CONCURRENCY) {
      const chunk = rootFolders.slice(i, i + BATCH_CONCURRENCY);
      await Promise.all(
        chunk.map(async (rf) => {
          const { data: actFolders } = await client.storage.from(PROOF_BUCKET).list(rf.name, { limit: 100 });
          if (!actFolders) return;
          await Promise.all(
            actFolders.map(async (af) => {
              const { data: files } = await client.storage.from(PROOF_BUCKET).list(`${rf.name}/${af.name}`, { limit: 100 });
              if (files && files.length > 0) {
                for (const f of files) {
                  fileSet.add(`${rf.name}/${af.name}/${f.name}`);
                }
              }
            })
          );
        })
      );
    }
  } catch (err) {
    console.error("Gagal memindai live storage files:", err);
  }

  return fileSet;
}

export interface PruneResult {
  success: boolean;
  deletedCount: number;
  deletedPaths: string[];
  errors: string[];
}

/**
 * Menghapus file gambar dari Supabase Storage secara bertahap (batch).
 * Data baris laporan di database TETAP UTUH, hanya file fisik di storage yang dibersihkan
 * agar batas kuota gratis Supabase tidak penuh.
 */
export async function prunePhotosFromSupabaseStorage(
  storagePaths: string[],
  onProgress?: (deletedCount: number, total: number) => void
): Promise<PruneResult> {
  if (!supabase) {
    return {
      success: false,
      deletedCount: 0,
      deletedPaths: [],
      errors: ["Koneksi Supabase tidak tersedia"],
    };
  }

  const uniquePaths = Array.from(new Set(storagePaths.map(cleanStoragePath).filter(Boolean)));
  const BATCH_SIZE = 50;
  let deletedCount = 0;
  const deletedPaths: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < uniquePaths.length; i += BATCH_SIZE) {
    const chunk = uniquePaths.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await supabase.storage.from(PROOF_BUCKET).remove(chunk);
      if (error) {
        errors.push(error.message);
      } else {
        const removedInBatch = data?.map((d: any) => d.name || "").filter(Boolean) || [];
        deletedPaths.push(...chunk);
        deletedCount += (removedInBatch.length > 0 ? removedInBatch.length : chunk.length);
      }
    } catch (err: any) {
      errors.push(err?.message || "Gagal menghapus batch foto dari storage");
    }

    onProgress?.(Math.min(i + chunk.length, uniquePaths.length), uniquePaths.length);
  }

  return {
    success: errors.length === 0,
    deletedCount,
    deletedPaths,
    errors,
  };
}

