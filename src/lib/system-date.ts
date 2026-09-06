import { formatWitaDate } from "./time";

/**
 * Menentukan tanggal acuan mulai operasional sistem murni dari database:
 * - Mengambil setting systemStartDate yang telah dikonfigurasi admin di database (app_settings).
 * - Jika tidak diatur di database, mengembalikan string kosong (tidak ada pembatasan tanggal).
 * - Tidak melakukan hardcode atau override dari data laporan sembarangan.
 */
export function resolveEffectiveSystemStartDate(
  configuredStartDate?: string | null,
): string {
  if (configuredStartDate && typeof configuredStartDate === "string" && configuredStartDate.trim()) {
    return configuredStartDate.trim();
  }
  return "";
}

/**
 * Menghasilkan teks label/info tanggal operasional yang sudah diformat ke bahasa Indonesia.
 */
export function getSystemStartDateLabel(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  return formatWitaDate(dateStr.trim());
}
