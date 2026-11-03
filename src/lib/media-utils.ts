import type { MediaImage, MediaReference, StorageImage } from "../types/media";

const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;

export function isStorageImage(name: string, mimeType = "") {
  return mimeType.toLowerCase().startsWith("image/") || IMAGE_EXTENSION.test(name);
}

/**
 * Normalizes a storage object path relative to the bucket root:
 * 1. Replaces backslashes with forward slashes
 * 2. Strips URL schemes and query parameters / fragments
 * 3. Strips accidental bucketId prefix (e.g. "daily-report-proofs/foo.jpg" -> "foo.jpg")
 * 4. Strips leading slashes (e.g. "/foo.jpg" -> "foo.jpg")
 */
export function normalizeStoragePath(raw: string, bucketId?: string): string {
  let path = (raw || "").trim().replace(/\\/g, "/");
  if (!path || path.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      /* Keep path as-is */
    }
  }
  const match = path.match(
    /\/?storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/?#]+)\/(.+)$/,
  );
  if (match) {
    let urlBucket = match[1];
    try {
      urlBucket = decodeURIComponent(urlBucket);
    } catch {
      /* Keep literal */
    }
    if (!bucketId || urlBucket === bucketId) {
      path = match[2];
    }
  }
  path = path.split(/[?#]/)[0].replace(/^\/+/, "");
  if (bucketId && path.startsWith(`${bucketId}/`)) {
    path = path.slice(bucketId.length + 1).replace(/^\/+/, "");
  }
  return path;
}

function decodedVariants(value: string) {
  const variants = new Set([value]);
  let next = value;
  for (let i = 0;i < 2;i++) {
    try {
      const decoded = decodeURIComponent(next);
      if (decoded === next) break;
      variants.add(decoded);
      next = decoded;
    } catch { break; }
  }
  return [...variants];
}

/** Keep full, case-sensitive object paths; a basename alone is matched conservatively. */
export function mediaPathVariants(value: string, bucketId: string): string[] {
  let path = value.trim().replace(/\\/g, "/");
  if (!path || path.startsWith("data:")) return [];
  if (/^https?:\/\//i.test(path)) {
    let url: URL;
    try { url = new URL(path); } catch { return []; }
    path = url.pathname;
  }
  const storageUrlMatch = path.match(/\/?storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/?#]+)\/(.+)$/);
  if (storageUrlMatch) {
    let urlBucket = storageUrlMatch[1];
    try { urlBucket = decodeURIComponent(urlBucket); } catch { /* Keep malformed values literal. */ }
    if (urlBucket !== bucketId) return [];
    path = storageUrlMatch[2].split(/[?#]/)[0];
  } else {
    path = path.split(/[?#]/)[0];
  }
  return [...new Set(decodedVariants(path).map((variant) => {
    const relative = variant.replace(/^\/+/, "");
    return relative.startsWith(`${bucketId}/`) ? relative.slice(bucketId.length + 1) : relative;
  }).filter(Boolean))];
}

export function correlateMedia(
  files: StorageImage[], references: MediaReference[], bucketId: string, auditable: boolean,
): MediaImage[] {
  const byPath = new Map<string, Map<string, MediaReference>>();
  for (const reference of references) {
    if (reference.bucketId !== bucketId) continue;
    for (const raw of reference.paths) {
      for (const path of mediaPathVariants(raw, bucketId)) {
        const matches = byPath.get(path) ?? new Map<string, MediaReference>();
        matches.set(reference.id, reference);
        byPath.set(path, matches);
      }
    }
  }
  return files.map((file) => {
    const matches = new Map<string, MediaReference>();
    // Include the literal filename to avoid double-decoding real percent characters.
    const candidates = new Set([...mediaPathVariants(file.path, bucketId), ...mediaPathVariants(file.name, bucketId), file.path, file.name]);
    for (const path of candidates) {
      for (const [id, reference] of byPath.get(path) ?? []) matches.set(id, reference);
    }
    return { ...file, references: [...matches.values()], status: !auditable ? "unknown" : matches.size ? "linked" : "orphan" };
  });
}

export function formatMediaBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: index ? 1 : 0 }).format(value / 1024 ** index)} ${units[index]}`;
}

export function mediaStatusLabel(status: MediaImage["status"]) {
  return status === "linked" ? "Terkait data" : status === "orphan" ? "Orphan" : "Belum diaudit";
}

export function getImageMonthKey(createdAt: string): string | null {
  if (!createdAt) return null;
  const time = Date.parse(createdAt);
  if (!Number.isNaN(time)) {
    const d = new Date(time);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  const match = /^\d{4}-\d{2}/.exec(createdAt);
  return match ? match[0] : null;
}

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatMediaMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month || month < 1 || month > 12) return monthKey;
  return `${INDONESIAN_MONTHS[month - 1]} ${year}`;
}

export function getImageReportMonthKeys(image: {
  status?: string;
  references: Array<{ date: string | null; kind?: string }>;
}): string[] {
  const keys: string[] = [];
  let hasReportDate = false;
  let hasMasterRef = false;

  for (const ref of image.references) {
    if (ref.date) {
      const match = /^\d{4}-\d{2}/.exec(ref.date);
      if (match) {
        keys.push(match[0]);
        hasReportDate = true;
      }
    } else {
      hasMasterRef = true;
    }
  }

  if (!image.references.length || image.status === "orphan") {
    keys.push("unlinked");
  } else if (!hasReportDate && hasMasterRef) {
    keys.push("master");
  }

  return [...new Set(keys)];
}


