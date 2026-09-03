/**
 * Konfigurasi Mode Operasional Aplikasi SiLahar
 * 
 * Pengaturan darurat saat database sedang offline / maintenance:
 * - disableLoginRequirement: true -> Membuka akses penuh ke aplikasi tanpa mewajibkan login.
 * - forceAllowAnyReportDate: true -> Mengaktifkan datepicker form untuk tanggal bebas.
 * 
 * KETIKA DATABASE SUDAH PULIH / KEMBALI ONLINE:
 * Cukup ubah kedua nilai di bawah ini menjadi `false` untuk mengembalikan sistem ke mode normal:
 *   disableLoginRequirement: false,
 *   forceAllowAnyReportDate: false,
 */
export const OFFLINE_EMERGENCY_MODE = {
  disableLoginRequirement: true,
  forceAllowAnyReportDate: true,
};
