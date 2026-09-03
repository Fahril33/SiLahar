import { formatWitaDate, getWitaToday } from "./time";

/**
 * Menentukan tanggal acuan mulai operasional sistem secara modular dan efisien:
 * - Tidak membuat query DB tambahan (menggunakan in-memory data yang sudah dimuat di state).
 * - Mengutamakan setting yang telah dikonfigurasi admin di app_settings jika ada.
 * - Jika belum diatur, secara otomatis mengambil tanggal laporan terlama dari koleksi data real.
 * - Fallback aman ke tanggal hari ini (WITA) jika belum ada data laporan sama sekali.
 */
export function resolveEffectiveSystemStartDate(
  configuredStartDate?: string | null,
  reports?: Array<{ reportDate?: string }> | null,
  fallbackToday?: string,
): string {
  if (configuredStartDate && configuredStartDate.trim()) {
    return configuredStartDate.trim();
  }

  if (reports && reports.length > 0) {
    let earliest = "";
    for (const r of reports) {
      if (r?.reportDate && (!earliest || r.reportDate < earliest)) {
        earliest = r.reportDate;
      }
    }
    if (earliest) return earliest;
  }

  return fallbackToday || getWitaToday();
}

/**
 * Menghasilkan teks label/info tanggal operasional yang sudah diformat ke bahasa Indonesia.
 */
export function getSystemStartDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  return formatWitaDate(dateStr);
}
