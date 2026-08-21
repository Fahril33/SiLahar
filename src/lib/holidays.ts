/**
 * Kalender Hari Libur Nasional & Logika Hari Kerja Efektif Indonesia
 * Digunakan untuk validasi laporan harian dan perhitungan statistik konsistensi BPBD.
 */

export const SYSTEM_START_DATE = "2026-08-19";

/**
 * Daftar Hari Libur Nasional Resmi & Cuti Bersama Indonesia (2024–2027)
 * Format: "YYYY-MM-DD": "Nama Hari Libur"
 */
export const INDONESIAN_HOLIDAYS: Record<string, string> = {
  // ── 2024 ──
  "2024-01-01": "Tahun Baru 2024 Masehi",
  "2024-02-08": "Isra Mi'raj Nabi Muhammad SAW",
  "2024-02-09": "Cuti Bersama Tahun Baru Imlek",
  "2024-02-10": "Tahun Baru Imlek 2575 Kongzili",
  "2024-02-14": "Hari Pemungutan Suara Pemilu 2024",
  "2024-03-11": "Hari Suci Nyepi Tahun Baru Saka 1946",
  "2024-03-12": "Cuti Bersama Hari Suci Nyepi",
  "2024-03-29": "Wafat Isa Almasih",
  "2024-03-31": "Hari Paskah",
  "2024-04-08": "Cuti Bersama Hari Raya Idul Fitri 1445 H",
  "2024-04-09": "Cuti Bersama Hari Raya Idul Fitri 1445 H",
  "2024-04-10": "Hari Raya Idul Fitri 1445 H",
  "2024-04-11": "Hari Raya Idul Fitri 1445 H",
  "2024-04-12": "Cuti Bersama Hari Raya Idul Fitri 1445 H",
  "2024-04-15": "Cuti Bersama Hari Raya Idul Fitri 1445 H",
  "2024-05-01": "Hari Buruh Internasional",
  "2024-05-09": "Kenaikan Isa Almasih",
  "2024-05-10": "Cuti Bersama Kenaikan Isa Almasih",
  "2024-05-23": "Hari Raya Waisak 2568 BE",
  "2024-05-24": "Cuti Bersama Hari Raya Waisak",
  "2024-06-01": "Hari Lahir Pancasila",
  "2024-06-17": "Hari Raya Idul Adha 1445 H",
  "2024-06-18": "Cuti Bersama Hari Raya Idul Adha",
  "2024-07-07": "Tahun Baru Islam 1446 H",
  "2024-08-17": "Hari Kemerdekaan RI ke-79",
  "2024-09-16": "Maulid Nabi Muhammad SAW",
  "2024-11-27": "Hari Pemungutan Suara Pilkada 2024",
  "2024-12-25": "Hari Raya Natal",
  "2024-12-26": "Cuti Bersama Hari Raya Natal",

  // ── 2025 ──
  "2025-01-01": "Tahun Baru 2025 Masehi",
  "2025-01-27": "Isra Mi'raj Nabi Muhammad SAW",
  "2025-01-28": "Cuti Bersama Tahun Baru Imlek",
  "2025-01-29": "Tahun Baru Imlek 2576 Kongzili",
  "2025-03-28": "Cuti Bersama Hari Suci Nyepi",
  "2025-03-29": "Hari Suci Nyepi Tahun Baru Saka 1947",
  "2025-03-31": "Hari Raya Idul Fitri 1446 H",
  "2025-04-01": "Hari Raya Idul Fitri 1446 H",
  "2025-04-02": "Cuti Bersama Hari Raya Idul Fitri 1446 H",
  "2025-04-03": "Cuti Bersama Hari Raya Idul Fitri 1446 H",
  "2025-04-04": "Cuti Bersama Hari Raya Idul Fitri 1446 H",
  "2025-04-07": "Cuti Bersama Hari Raya Idul Fitri 1446 H",
  "2025-04-18": "Wafat Isa Almasih",
  "2025-04-20": "Hari Paskah",
  "2025-05-01": "Hari Buruh Internasional",
  "2025-05-12": "Hari Raya Waisak 2569 BE",
  "2025-05-13": "Cuti Bersama Hari Raya Waisak",
  "2025-05-29": "Kenaikan Isa Almasih",
  "2025-05-30": "Cuti Bersama Kenaikan Isa Almasih",
  "2025-06-01": "Hari Lahir Pancasila",
  "2025-06-06": "Hari Raya Idul Adha 1446 H",
  "2025-06-09": "Cuti Bersama Hari Raya Idul Adha",
  "2025-06-27": "Tahun Baru Islam 1447 H",
  "2025-08-17": "Hari Kemerdekaan RI ke-80",
  "2025-09-05": "Maulid Nabi Muhammad SAW",
  "2025-12-25": "Hari Raya Natal",
  "2025-12-26": "Cuti Bersama Hari Raya Natal",

  // ── 2026 ──
  "2026-01-01": "Tahun Baru 2026 Masehi",
  "2026-01-16": "Isra Mi'raj Nabi Muhammad SAW",
  "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
  "2026-02-18": "Cuti Bersama Tahun Baru Imlek",
  "2026-03-20": "Hari Raya Idul Fitri 1447 H",
  "2026-03-21": "Hari Raya Idul Fitri 1447 H",
  "2026-03-22": "Hari Suci Nyepi Tahun Baru Saka 1948",
  "2026-03-23": "Cuti Bersama Hari Raya Idul Fitri 1447 H",
  "2026-03-24": "Cuti Bersama Hari Raya Idul Fitri 1447 H",
  "2026-04-03": "Wafat Isa Almasih",
  "2026-04-05": "Hari Paskah",
  "2026-05-01": "Hari Buruh Internasional",
  "2026-05-14": "Kenaikan Isa Almasih",
  "2026-05-27": "Hari Raya Idul Adha 1447 H",
  "2026-05-31": "Hari Raya Waisak 2570 BE",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "Tahun Baru Islam 1448 H",
  "2026-08-17": "Hari Kemerdekaan RI ke-81",
  "2026-08-25": "Maulid Nabi Muhammad SAW",
  "2026-12-25": "Hari Raya Natal",
  "2026-12-26": "Cuti Bersama Hari Raya Natal",

  // ── 2027 ──
  "2027-01-01": "Tahun Baru 2027 Masehi",
  "2027-01-05": "Isra Mi'raj Nabi Muhammad SAW",
  "2027-02-06": "Tahun Baru Imlek 2578 Kongzili",
  "2027-03-10": "Hari Raya Idul Fitri 1448 H",
  "2027-03-11": "Hari Raya Idul Fitri 1448 H",
  "2027-03-12": "Cuti Bersama Hari Raya Idul Fitri",
  "2027-03-26": "Wafat Isa Almasih",
  "2027-03-28": "Hari Paskah",
  "2027-04-08": "Hari Suci Nyepi Tahun Baru Saka 1949",
  "2027-05-01": "Hari Buruh Internasional",
  "2027-05-06": "Kenaikan Isa Almasih",
  "2027-05-16": "Hari Raya Idul Adha 1448 H",
  "2027-05-20": "Hari Raya Waisak 2571 BE",
  "2027-06-01": "Hari Lahir Pancasila",
  "2027-06-06": "Tahun Baru Islam 1449 H",
  "2027-08-15": "Maulid Nabi Muhammad SAW",
  "2027-08-17": "Hari Kemerdekaan RI ke-82",
  "2027-12-25": "Hari Raya Natal",
  "2027-12-27": "Cuti Bersama Hari Raya Natal",
};

/**
 * Mengecek apakah tanggal tertentu jatuh pada akhir pekan (Sabtu / Minggu).
 */
export function isWeekend(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return false;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = date.getDay(); // 0 = Minggu, 6 = Sabtu
  return day === 0 || day === 6;
}

/**
 * Mengambil informasi libur dari tanggal yang diberikan.
 */
export function getHolidayInfo(dateStr: string): {
  isHoliday: boolean;
  isWeekend: boolean;
  name?: string;
} {
  const cleanDate = dateStr.slice(0, 10);
  const weekend = isWeekend(cleanDate);
  const holidayName = INDONESIAN_HOLIDAYS[cleanDate];

  if (holidayName) {
    return {
      isHoliday: true,
      isWeekend: weekend,
      name: holidayName,
    };
  }

  if (weekend) {
    const parts = cleanDate.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return {
      isHoliday: true,
      isWeekend: true,
      name: date.getDay() === 0 ? "Hari Minggu (Akhir Pekan)" : "Hari Sabtu (Akhir Pekan)",
    };
  }

  return {
    isHoliday: false,
    isWeekend: false,
  };
}

/**
 * Mengecek apakah tanggal adalah hari kerja kalender efektif (Senin s/d Jumat & bukan tanggal merah).
 */
export function isWorkDay(dateStr: string): boolean {
  const info = getHolidayInfo(dateStr);
  return !info.isHoliday;
}

/**
 * Menghitung hari kerja kalender efektif dalam rentang waktu tertentu.
 * Otomatis membatasi tanggal awal perhitungan minimal SYSTEM_START_DATE (2026-08-19).
 */
export function getEffectiveWorkingDaysInRange(
  startStr: string,
  endStr: string,
  options?: { enforceSystemStartDate?: boolean }
): {
  effectiveStart: string;
  effectiveEnd: string;
  totalWorkingDays: number;
  totalCalendarDays: number;
  workingDates: string[];
  holidayDates: Array<{ date: string; name: string }>;
} {
  const enforceStart = options?.enforceSystemStartDate !== false;
  
  let actualStart = startStr;
  if (enforceStart && actualStart < SYSTEM_START_DATE) {
    actualStart = SYSTEM_START_DATE;
  }
  const actualEnd = endStr;

  if (actualStart > actualEnd) {
    return {
      effectiveStart: actualStart,
      effectiveEnd: actualEnd,
      totalWorkingDays: 0,
      totalCalendarDays: 0,
      workingDates: [],
      holidayDates: [],
    };
  }

  const workingDates: string[] = [];
  const holidayDates: Array<{ date: string; name: string }> = [];

  const [sY, sM, sD] = actualStart.split("-").map(Number);
  const [eY, eM, eD] = actualEnd.split("-").map(Number);

  const cur = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);

  let totalCalendarDays = 0;

  while (cur <= end) {
    totalCalendarDays++;
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const holidayInfo = getHolidayInfo(dateKey);
    if (!holidayInfo.isHoliday) {
      workingDates.push(dateKey);
    } else {
      holidayDates.push({ date: dateKey, name: holidayInfo.name || "Hari Libur" });
    }

    cur.setDate(cur.getDate() + 1);
  }

  return {
    effectiveStart: actualStart,
    effectiveEnd: actualEnd,
    totalWorkingDays: workingDates.length,
    totalCalendarDays,
    workingDates,
    holidayDates,
  };
}
