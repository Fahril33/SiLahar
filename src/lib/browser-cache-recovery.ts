import { saveAs } from "file-saver";
import type { Report, ReportActivity } from "../types/report";
import { supabase } from "./supabase";
import { loadCachedReports } from "./storage";
import {
  listLocalReportDrafts,
  loadLocalReportDraft,
} from "./local-report-drafts";
import { formatWitaDate, formatWitaDateTime, getWitaToday } from "./time";
import { logSafeError } from "./logger";
import {
  formatReporterNameForDatabase,
  isSameReporterName,
} from "./reporter-name";

const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Mengumpulkan semua data laporan yang tersimpan di perangkat (cadangan lokal / local cache / draft offline)
 */
export async function getAllDeviceBackupReports(
  currentReports: Report[] = [],
): Promise<Report[]> {
  const reportsMap = new Map<string, Report>();

  // 1. Ambil laporan dari props/state yang bertanda source: "local"
  for (const report of currentReports) {
    if (report.source === "local") {
      reportsMap.set(report.id, report);
    }
  }

  // 2. Ambil dari localStorage (silahar:reports-cache)
  try {
    const cachedReports = loadCachedReports();
    for (const report of cachedReports) {
      if (report.source === "local" && !reportsMap.has(report.id)) {
        reportsMap.set(report.id, report);
      }
    }
  } catch (err) {
    logSafeError(err, "DeviceBackup/LoadCachedReports");
  }

  // 3. Ambil dari IndexedDB (silahar-local-report-drafts)
  try {
    const draftSummaries = await listLocalReportDrafts();
    for (const summary of draftSummaries) {
      const fullRecord = await loadLocalReportDraft(summary.id);
      if (fullRecord && fullRecord.draft) {
        const draft = fullRecord.draft;
        const syntheticId = `draft-${fullRecord.id}`;
        if (!reportsMap.has(syntheticId) && !reportsMap.has(fullRecord.id)) {
          reportsMap.set(syntheticId, {
            id: syntheticId,
            source: "local",
            templateId: draft.templateId ?? null,
            tim: draft.tim || "TRC",
            nama: draft.nama || "Tanpa Nama",
            tanggal: draft.tanggal || draft.reportDate,
            reportDate: draft.reportDate,
            activities: draft.activities || [],
            approverCoordinatorTemplateId:
              draft.approverCoordinatorTemplateId ?? null,
            approverCoordinator: draft.approverCoordinator || "",
            approverCoordinatorNip: draft.approverCoordinatorNip || "",
            approverCoordinatorLabel: draft.approverCoordinatorLabel || "",
            approverDivisionHeadTemplateId:
              draft.approverDivisionHeadTemplateId ?? null,
            approverDivisionHead: draft.approverDivisionHead || "",
            approverDivisionHeadTitle: draft.approverDivisionHeadTitle || "",
            approverDivisionHeadNip: draft.approverDivisionHeadNip || "",
            notes: draft.notes || [],
            createdAt: fullRecord.createdAt,
            updatedAt: fullRecord.updatedAt,
            createdByRole: "anonymous",
            createdByLabel: "Draft Lokal Perangkat",
            updatedByRole: "anonymous",
            updatedByLabel: "Draft Lokal Perangkat",
          });
        }
      }
    }
  } catch (err) {
    logSafeError(err, "DeviceBackup/LoadIndexedDBDrafts");
  }

  // 4. Fallback: jika tidak ada data spesifik bertanda "local", tetapi ada laporan di cache perangkat,
  // sertakan semua laporan cache tersebut agar admin tetap dapat mencadangkan seluruh data di browser
  if (reportsMap.size === 0) {
    try {
      const cached = loadCachedReports();
      if (cached.length > 0) {
        for (const report of cached) {
          reportsMap.set(report.id, { ...report, source: "local" });
        }
      }
    } catch {
      // Abaikan jika kosong
    }
  }

  return Array.from(reportsMap.values());
}

/**
 * Sanitasi nama worksheet tab Excel:
 * - Panjang maks 31 karakter
 * - Karakter terlarang di Excel: \ / ? * : [ ]
 * - Tidak boleh diawali atau diakhiri tanda petik '
 * - Harus unik di dalam satu workbook
 */
function sanitizeSheetName(rawName: string, usedNames: Set<string>): string {
  let clean = (rawName || "Petugas")
    .trim()
    .replace(/[\\/?*:[\]]/g, "_")
    .replace(/^'+|'+$/g, "");

  if (!clean) {
    clean = "Petugas";
  }

  // Potong maks 28 karakter agar ada ruang jika perlu suffix nomor (1), (2)
  if (clean.length > 28) {
    clean = clean.substring(0, 28).trim();
  }

  let candidate = clean;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    const base = clean.substring(0, 31 - suffix.length);
    candidate = `${base}${suffix}`;
    counter++;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export type GenerateDeviceBackupExcelOptions = {
  reports: Report[];
  onProgress?: (stage: string, message?: string) => void;
};

/**
 * Menghasilkan file Excel cadangan perangkat yang dikelompokkan per tab worksheet per user
 * dengan data per tanggal dan detail lengkap aktivitas.
 */
export async function generateDeviceBackupExcel(
  options: GenerateDeviceBackupExcelOptions,
): Promise<void> {
  const { reports, onProgress } = options;

  if (!reports || reports.length === 0) {
    throw new Error("Tidak ada data cadangan perangkat untuk diunduh.");
  }

  onProgress?.("init", "Memuat pustaka Excel...");
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "SiLahar - Sistem Informasi Laporan Harian";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Kelompokkan laporan berdasarkan nama petugas
  const groupedByUser = new Map<string, Report[]>();
  for (const report of reports) {
    const userName =
      formatReporterNameForDatabase(report.nama) || "Petugas Tanpa Nama";
    const currentList = groupedByUser.get(userName) ?? [];
    currentList.push(report);
    groupedByUser.set(userName, currentList);
  }

  // Urutkan nama user secara alfabetis
  const sortedUserNames = Array.from(groupedByUser.keys()).sort((a, b) =>
    a.localeCompare(b, "id-ID"),
  );

  const usedSheetNames = new Set<string>();

  // ==========================================
  // TAB 1: RINGKASAN CADANGAN (OVERVIEW TAB)
  // ==========================================
  onProgress?.("summary", "Menyusun lembar ringkasan petugas...");
  const summarySheet = workbook.addWorksheet("Ringkasan Petugas", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 8 }],
  });

  // Judul Utama Ringkasan
  summarySheet.mergeCells("A1:H1");
  const mainTitleCell = summarySheet.getCell("A1");
  mainTitleCell.value = "RINGKASAN CADANGAN PERANGKAT - SEMUA PETUGAS";
  mainTitleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  mainTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Slate 900
  };
  mainTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  summarySheet.getRow(1).height = 36;

  summarySheet.mergeCells("A2:H2");
  const subTitleCell = summarySheet.getCell("A2");
  subTitleCell.value =
    "Sistem Informasi Laporan Harian (SiLahar) - BPBD Provinsi Sulawesi Tengah";
  subTitleCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FFE2E8F0" } };
  subTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Slate 800
  };
  subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  summarySheet.getRow(2).height = 22;

  summarySheet.getRow(3).height = 10; // Spasi kosong

  // Metadata Ringkasan
  const witaExportTime = formatWitaDateTime(new Date().toISOString());
  const totalReportsCount = reports.length;
  const totalActivitiesCount = reports.reduce(
    (sum, r) => sum + (r.activities?.length || 0),
    0,
  );

  summarySheet.getCell("B4").value = "Total Petugas Tercatat:";
  summarySheet.getCell("B4").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  summarySheet.getCell("C4").value = `${sortedUserNames.length} Orang`;
  summarySheet.getCell("C4").font = { name: "Arial", size: 10, bold: true };

  summarySheet.getCell("E4").value = "Total Hari Laporan:";
  summarySheet.getCell("E4").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  summarySheet.getCell("F4").value = `${totalReportsCount} Hari`;
  summarySheet.getCell("F4").font = { name: "Arial", size: 10, bold: true };

  summarySheet.getCell("B5").value = "Waktu Ekspor:";
  summarySheet.getCell("B5").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  summarySheet.getCell("C5").value = witaExportTime;
  summarySheet.getCell("C5").font = { name: "Arial", size: 10 };

  summarySheet.getCell("E5").value = "Total Rincian Kegiatan:";
  summarySheet.getCell("E5").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  summarySheet.getCell("F5").value = `${totalActivitiesCount} Aktivitas`;
  summarySheet.getCell("F5").font = { name: "Arial", size: 10, bold: true };

  summarySheet.getCell("B6").value = "Catatan Sistem:";
  summarySheet.getCell("B6").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  summarySheet.getCell("C6").value =
    "Data cadangan lokal perangkat dikelompokkan pada setiap tab lembar kerja per petugas.";
  summarySheet.getCell("C6").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };

  summarySheet.getRow(7).height = 12; // Spasi kosong

  // Header Kolom Ringkasan
  const summaryHeaders = [
    { label: "No", width: 8 },
    { label: "Nama Petugas", width: 32 },
    { label: "Tab Lembar Kerja", width: 28 },
    { label: "Tim Operasional", width: 18 },
    { label: "Jumlah Hari Laporan", width: 20 },
    { label: "Periode Tanggal", width: 28 },
    { label: "Total Kegiatan", width: 16 },
    { label: "Status Cadangan", width: 22 },
  ];

  const summaryHeaderRow = summarySheet.getRow(8);
  summaryHeaderRow.height = 28;

  summaryHeaders.forEach((col, idx) => {
    const cell = summaryHeaderRow.getCell(idx + 1);
    cell.value = col.label;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Blue 900
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF94A3B8" } },
      right: { style: "thin", color: { argb: "FF94A3B8" } },
    };
    summarySheet.getColumn(idx + 1).width = col.width;
  });

  // Simpan relasi nama user ke tab sheet untuk link
  const userTabNameMap = new Map<string, string>();
  for (const userName of sortedUserNames) {
    const tabName = sanitizeSheetName(userName, usedSheetNames);
    userTabNameMap.set(userName, tabName);
  }

  // Isi baris Ringkasan
  let summaryRowIndex = 9;
  sortedUserNames.forEach((userName, index) => {
    const userReports = groupedByUser.get(userName) || [];
    const tabName = userTabNameMap.get(userName) || userName;

    // Hitung statistik user
    const userTim = userReports[0]?.tim || "TRC";
    const dates = userReports
      .map((r) => r.reportDate)
      .filter(Boolean)
      .sort();
    const minDate = dates[0] || "-";
    const maxDate = dates[dates.length - 1] || "-";
    const dateRange =
      minDate === maxDate ? minDate : `${minDate} s/d ${maxDate}`;
    const userActivitiesCount = userReports.reduce(
      (sum, r) => sum + (r.activities?.length || 0),
      0,
    );

    const row = summarySheet.getRow(summaryRowIndex);
    row.height = 24;

    const isEven = index % 2 === 1;
    const bgArgb = isEven ? "FFF8FAFC" : "FFFFFFFF";

    const values = [
      index + 1,
      userName,
      tabName,
      userTim,
      `${userReports.length} Hari`,
      dateRange,
      `${userActivitiesCount} Kegiatan`,
      "Cadangan Perangkat",
    ];

    values.forEach((val, valIdx) => {
      const cell = row.getCell(valIdx + 1);
      cell.value = val;
      cell.font = { name: "Arial", size: 9.5 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgArgb },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (valIdx === 0 || valIdx === 3 || valIdx === 4 || valIdx === 6 || valIdx === 7) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      if (valIdx === 1) {
        cell.font = { name: "Arial", size: 9.5, bold: true };
      }
    });

    summaryRowIndex++;
  });

  // ==========================================
  // TAB PER USER (WORKSHEET TAB PER USER)
  // ==========================================
  for (let uIdx = 0; uIdx < sortedUserNames.length; uIdx++) {
    const userName = sortedUserNames[uIdx];
    const tabName = userTabNameMap.get(userName) || `Petugas_${uIdx + 1}`;
    const userReports = groupedByUser.get(userName) || [];

    onProgress?.(
      "user",
      `Menyusun tab [${tabName}] (${uIdx + 1}/${sortedUserNames.length})...`,
    );

    // Buat worksheet baru untuk petugas ini
    const sheet = workbook.addWorksheet(tabName, {
      views: [{ state: "frozen", xSplit: 0, ySplit: 8 }],
    });

    // Urutkan laporan petugas secara kronologis dari tanggal terawal ke terbaru
    userReports.sort((a, b) => (a.reportDate || "").localeCompare(b.reportDate || ""));

    const userTim = userReports[0]?.tim || "TRC";
    const userTotalActivities = userReports.reduce(
      (sum, r) => sum + (r.activities?.length || 0),
      0,
    );
    const userDates = userReports.map((r) => r.reportDate).filter(Boolean);
    const minDate = userDates[0] || "-";
    const maxDate = userDates[userDates.length - 1] || "-";
    const dateRange =
      minDate === maxDate ? minDate : `${minDate} s/d ${maxDate}`;

    // 1. Header Banner Tab Petugas
    sheet.mergeCells("A1:M1");
    const userTitleCell = sheet.getCell("A1");
    userTitleCell.value = `CADANGAN LAPORAN HARIAN - ${userName.toUpperCase()}`;
    userTitleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    userTitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate 900
    };
    userTitleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 34;

    sheet.mergeCells("A2:M2");
    const userSubCell = sheet.getCell("A2");
    userSubCell.value =
      "Data Cadangan Lokal Perangkat | SiLahar - BPBD Provinsi Sulawesi Tengah";
    userSubCell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FFE2E8F0" } };
    userSubCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Blue 900
    };
    userSubCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 20;

    sheet.getRow(3).height = 8; // Spasi kosong

    // 2. Info Card Petugas
    sheet.getCell("B4").value = "Nama Petugas:";
    sheet.getCell("B4").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    sheet.getCell("C4").value = userName;
    sheet.getCell("C4").font = { name: "Arial", size: 10, bold: true };

    sheet.getCell("E4").value = "Tim Operasional:";
    sheet.getCell("E4").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    sheet.getCell("F4").value = userTim;
    sheet.getCell("F4").font = { name: "Arial", size: 10, bold: true };

    sheet.getCell("B5").value = "Total Hari Laporan:";
    sheet.getCell("B5").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    sheet.getCell("C5").value = `${userReports.length} Hari`;
    sheet.getCell("C5").font = { name: "Arial", size: 10, bold: true };

    sheet.getCell("E5").value = "Total Kegiatan:";
    sheet.getCell("E5").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    sheet.getCell("F5").value = `${userTotalActivities} Aktivitas`;
    sheet.getCell("F5").font = { name: "Arial", size: 10, bold: true };

    sheet.getCell("B6").value = "Rentang Periode:";
    sheet.getCell("B6").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    sheet.getCell("C6").value = dateRange;
    sheet.getCell("C6").font = { name: "Arial", size: 10 };

    sheet.getCell("E6").value = "Waktu Unduh Cadangan:";
    sheet.getCell("E6").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    sheet.getCell("F6").value = witaExportTime;
    sheet.getCell("F6").font = { name: "Arial", size: 9.5, italic: true };

    sheet.getRow(7).height = 10; // Spasi kosong

    // 3. Header Tabel Detail Laporan Petugas
    const detailHeaders = [
      { label: "No", width: 6 },
      { label: "Tanggal", width: 14 },
      { label: "Hari & Format Tanggal", width: 26 },
      { label: "Tim", width: 14 },
      { label: "No Kegiatan", width: 12 },
      { label: "Jam Mulai", width: 12 },
      { label: "Jam Selesai", width: 12 },
      { label: "Durasi Kerja", width: 18 },
      { label: "Uraian Kegiatan / Detail Aktivitas", width: 48 },
      { label: "Dokumentasi", width: 16 },
      { label: "Catatan Tambahan", width: 30 },
      { label: "Status Data", width: 20 },
      { label: "Waktu Simpan Perangkat", width: 22 },
    ];

    const detailHeaderRow = sheet.getRow(8);
    detailHeaderRow.height = 28;

    detailHeaders.forEach((col, idx) => {
      const cell = detailHeaderRow.getCell(idx + 1);
      cell.value = col.label;
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" }, // Blue 600
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "medium", color: { argb: "FF1E3A8A" } },
        bottom: { style: "medium", color: { argb: "FF1E3A8A" } },
        left: { style: "thin", color: { argb: "FF93C5FD" } },
        right: { style: "thin", color: { argb: "FF93C5FD" } },
      };
      sheet.getColumn(idx + 1).width = col.width;
    });

    // 4. Baris Data Detail Per Tanggal & Per Aktivitas
    let detailRowIndex = 9;
    let globalActivityNumber = 1;

    userReports.forEach((report, rIdx) => {
      const displayDate =
        report.tanggal || formatWitaDate(report.reportDate) || report.reportDate;
      const notesText = (report.notes || []).filter(Boolean).join(" | ") || "-";
      const updatedTime = formatWitaDateTime(
        report.updatedAt || report.createdAt || "",
      );
      const isDateEven = rIdx % 2 === 1;
      const rowBg = isDateEven ? "FFF8FAFC" : "FFFFFFFF";

      const activities =
        report.activities && report.activities.length > 0
          ? report.activities
          : [
              {
                no: 1,
                startTime: "-",
                endTime: "-",
                description: "(Belum ada rincian kegiatan tercatat)",
                photos: [],
              } as ReportActivity,
            ];

      activities.forEach((act) => {
        const row = sheet.getRow(detailRowIndex);
        row.height = 24;

        const photoCount = act.photos?.length || 0;
        const photoLabel = photoCount > 0 ? `${photoCount} Foto` : "Tidak ada foto";
        const timeRange =
          act.startTime && act.endTime && act.startTime !== "-"
            ? `${act.startTime} - ${act.endTime} WITA`
            : "-";

        const cellsData = [
          globalActivityNumber,
          report.reportDate,
          displayDate,
          report.tim || userTim,
          act.no,
          act.startTime || "-",
          act.endTime || "-",
          timeRange,
          act.description || "-",
          photoLabel,
          notesText,
          "Cadangan Perangkat",
          updatedTime || "-",
        ];

        cellsData.forEach((val, valIdx) => {
          const cell = row.getCell(valIdx + 1);
          cell.value = val;
          cell.font = { name: "Arial", size: 9.5 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          // Alignment & wrap text
          if (valIdx === 8 || valIdx === 10) {
            // Uraian Kegiatan & Catatan
            cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          } else if (valIdx === 1 || valIdx === 2) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        });

        globalActivityNumber++;
        detailRowIndex++;
      });
    });
  }

  // Simpan file Excel ke browser
  onProgress?.("export", "Mengemas file Excel cadangan...");
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });

  const nowString = getWitaToday().replace(/-/g, "");
  const timeString = new Date().toTimeString().slice(0, 5).replace(":", "");
  const fileName = `Cadangan_Perangkat_SiLahar_${nowString}_${timeString}.xlsx`;

  saveAs(blob, fileName);
  onProgress?.("done", "File berhasil diunduh.");
}

export type GenerateDeviceBackupJsonOptions = {
  reports: Report[];
  userFilter?: string;
  onProgress?: (stage: string, message?: string) => void;
};

/**
 * Menghasilkan file JSON cadangan perangkat dengan struktur data lengkap & metadata
 */
export async function generateDeviceBackupJson(
  options: GenerateDeviceBackupJsonOptions,
): Promise<void> {
  const { reports, userFilter, onProgress } = options;

  if (!reports || reports.length === 0) {
    throw new Error("Tidak ada data cadangan untuk diekspor ke JSON.");
  }

  onProgress?.("init", "Menyiapkan data JSON...");

  const filteredReports = userFilter
    ? reports.filter((r) => isSameReporterName(r.nama, userFilter))
    : reports;

  if (filteredReports.length === 0) {
    throw new Error("Tidak ada data laporan yang cocok untuk diekspor ke JSON.");
  }

  // Urutkan laporan secara kronologis
  const sortedReports = [...filteredReports].sort((a, b) =>
    (a.reportDate || "").localeCompare(b.reportDate || ""),
  );

  const uniqueUsers = Array.from(new Set(sortedReports.map((r) => r.nama)));
  const totalActivities = sortedReports.reduce(
    (sum, r) => sum + (r.activities?.length || 0),
    0,
  );

  const exportPayload = {
    metadata: {
      title: "Cadangan Data Laporan Perangkat SiLahar",
      application: "SiLahar (Sistem Informasi Laporan Harian)",
      organization:
        "Badan Penanggulangan Bencana Daerah Provinsi Sulawesi Tengah",
      formatVersion: "1.0",
      exportedAtIso: new Date().toISOString(),
      exportedAtWita: formatWitaDateTime(new Date().toISOString()),
      totalReports: sortedReports.length,
      totalPetugas: uniqueUsers.length,
      daftarPetugas: uniqueUsers,
      totalActivities,
    },
    reports: sortedReports.map((report) => ({
      id: report.id,
      source: report.source || "local",
      nama: report.nama,
      tim: report.tim,
      reportDate: report.reportDate,
      tanggal: report.tanggal,
      activities: (report.activities || []).map((act) => ({
        no: act.no,
        startTime: act.startTime,
        endTime: act.endTime,
        description: act.description,
        photosCount: act.photos?.length || 0,
        photos: (act.photos || []).map((p) => ({
          originalFileName: p.originalFileName,
          storagePath: p.storagePath,
          publicUrl: p.publicUrl,
        })),
      })),
      approvers: {
        coordinatorName: report.approverCoordinator,
        coordinatorNip: report.approverCoordinatorNip,
        coordinatorRoleLabel: report.approverCoordinatorLabel,
        divisionHeadName: report.approverDivisionHead,
        divisionHeadTitle: report.approverDivisionHeadTitle,
        divisionHeadNip: report.approverDivisionHeadNip,
      },
      notes: report.notes || [],
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      createdByRole: report.createdByRole,
      createdByLabel: report.createdByLabel,
    })),
  };

  onProgress?.("export", "Mengemas file JSON...");
  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], {
    type: "application/json;charset=utf-8",
  });

  const nowString = getWitaToday().replace(/-/g, "");
  const timeString = new Date().toTimeString().slice(0, 5).replace(":", "");
  const userSlug = userFilter
    ? `_${userFilter.trim().replace(/[\\/:*?"<>|\s]+/g, "_")}`
    : "";
  const fileName = `Cadangan_Perangkat_SiLahar${userSlug}_${nowString}_${timeString}.json`;

  saveAs(blob, fileName);
  onProgress?.("done", "File JSON berhasil diunduh.");
}

function generateLocalUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parsing file JSON hasil ekspor cadangan perangkat
 */
export async function parseDeviceBackupJsonFile(file: File): Promise<Report[]> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  let rawReports: any[] = [];
  if (Array.isArray(parsed)) {
    rawReports = parsed;
  } else if (parsed && Array.isArray(parsed.reports)) {
    rawReports = parsed.reports;
  } else if (parsed && typeof parsed === "object" && parsed.nama) {
    rawReports = [parsed];
  } else {
    throw new Error("Format file JSON cadangan tidak valid atau tidak memuat daftar laporan.");
  }

  return rawReports.map((item, index) => {
    const reportDate = item.reportDate || item.tanggal || getWitaToday();
    const id = item.id || `imported-backup-${Date.now()}-${index}`;

    const activities: ReportActivity[] = (item.activities || []).map(
      (act: any, actIdx: number) => ({
        no: act.no ?? actIdx + 1,
        startTime: act.startTime || "08:00",
        endTime: act.endTime || "16:00",
        description: act.description || `Aktivitas ${actIdx + 1}`,
        photos: (act.photos || []).map((p: any) => ({
          storagePath: p.storagePath || "",
          publicUrl: p.publicUrl || "",
          originalFileName: p.originalFileName || "dokumentasi.jpg",
        })),
      }),
    );

    return {
      id,
      source: "local" as const,
      templateId: item.templateId || null,
      tim: item.tim || "PUSDALOPS",
      nama: item.nama || "Petugas SiLahar",
      tanggal: item.tanggal || reportDate,
      reportDate,
      activities,
      approverCoordinatorTemplateId:
        item.approverCoordinatorTemplateId || null,
      approverCoordinator:
        item.approverCoordinator ||
        item.approvers?.coordinatorName ||
        "",
      approverCoordinatorNip:
        item.approverCoordinatorNip ||
        item.approvers?.coordinatorNip ||
        "",
      approverCoordinatorLabel:
        item.approverCoordinatorLabel ||
        item.approvers?.coordinatorRoleLabel ||
        "",
      approverDivisionHeadTemplateId:
        item.approverDivisionHeadTemplateId || null,
      approverDivisionHead:
        item.approverDivisionHead ||
        item.approvers?.divisionHeadName ||
        "",
      approverDivisionHeadTitle:
        item.approverDivisionHeadTitle ||
        item.approvers?.divisionHeadTitle ||
        "",
      approverDivisionHeadNip:
        item.approverDivisionHeadNip ||
        item.approvers?.divisionHeadNip ||
        "",
      notes: item.notes || [],
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      createdByRole: item.createdByRole || "anonymous",
      createdByLabel: item.createdByLabel || "Cadangan Perangkat JSON",
      updatedByRole: item.updatedByRole || "anonymous",
      updatedByLabel: item.updatedByLabel || "Cadangan Perangkat JSON",
    } as Report;
  });
}

export type BulkUploadItemStatus = "pending" | "uploading" | "success" | "error";

export type BulkUploadReportProgressItem = {
  reportId: string;
  reportDate: string;
  userName: string;
  tim?: string;
  totalActivities: number;
  selectedActivitiesCount: number;
  status: BulkUploadItemStatus;
  errorMessage?: string;
};

export type BulkUploadUserProgressItem = {
  userName: string;
  status: BulkUploadItemStatus;
  totalReports: number;
  completedReports: number;
  reports: BulkUploadReportProgressItem[];
};

export type BulkUploadProgressState = {
  overallStatus: "idle" | "uploading" | "completed" | "error";
  currentUserIndex: number;
  totalUsers: number;
  currentReportIndex: number;
  totalReports: number;
  currentActivityIndex: number;
  totalActivities: number;
  currentUserName: string;
  currentReportDate: string;
  users: BulkUploadUserProgressItem[];
  uploadedReportsCount: number;
  uploadedActivitiesCount: number;
  errors: string[];
  currentMessage: string;
};

export type BulkUploadItemProgress = {
  current: number;
  total: number;
  stage: string;
  reportName?: string;
  reportDate?: string;
};

export type BulkUploadResult = {
  success: boolean;
  uploadedReportsCount: number;
  uploadedActivitiesCount: number;
  errors: string[];
  progressState?: BulkUploadProgressState;
};

/**
 * Membangun initial state progress per user & per laporan untuk preview/eksekusi upload
 */
export function buildInitialBulkUploadProgressState(
  reports: Report[],
  selectedActivitiesByReportId: Record<string, number[]>,
): BulkUploadProgressState {
  const reportsToUpload = reports.filter((report) => {
    const selectedNos = selectedActivitiesByReportId[report.id];
    return selectedNos && selectedNos.length > 0;
  });

  const userMap = new Map<string, Report[]>();
  reportsToUpload.forEach((report) => {
    const userName = (report.nama || "Petugas SiLahar").trim();
    if (!userMap.has(userName)) {
      userMap.set(userName, []);
    }
    userMap.get(userName)!.push(report);
  });

  const sortedUserNames = Array.from(userMap.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  let totalActivities = 0;
  let totalReports = 0;

  const users: BulkUploadUserProgressItem[] = sortedUserNames.map((userName) => {
    const userReports = userMap.get(userName) || [];
    // Sort reports chronologically
    const sortedReports = [...userReports].sort((a, b) =>
      (a.reportDate || "").localeCompare(b.reportDate || ""),
    );

    totalReports += sortedReports.length;

    const reportItems: BulkUploadReportProgressItem[] = sortedReports.map(
      (rep) => {
        const selectedNos = selectedActivitiesByReportId[rep.id] || [];
        totalActivities += selectedNos.length;

        return {
          reportId: rep.id,
          reportDate: rep.reportDate || rep.tanggal || getWitaToday(),
          userName,
          tim: rep.tim || "PUSDALOPS",
          totalActivities: rep.activities?.length || 0,
          selectedActivitiesCount: selectedNos.length,
          status: "pending",
        };
      },
    );

    return {
      userName,
      status: "pending",
      totalReports: sortedReports.length,
      completedReports: 0,
      reports: reportItems,
    };
  });

  return {
    overallStatus: "idle",
    currentUserIndex: 0,
    totalUsers: users.length,
    currentReportIndex: 0,
    totalReports,
    currentActivityIndex: 0,
    totalActivities,
    currentUserName: "",
    currentReportDate: "",
    users,
    uploadedReportsCount: 0,
    uploadedActivitiesCount: 0,
    errors: [],
    currentMessage: "Menyiapkan antrean upload...",
  };
}

/**
 * Bulk upload data cadangan lokal perangkat ke Supabase database secara BERTAHAP per user dan per laporan.
 * Memastikan cache lokal, draft IndexedDB, dan localStorage TIDAK dihapus atau diubah identitasnya.
 */
export async function bulkUploadDeviceBackupReportsToDatabase(params: {
  reports: Report[];
  selectedActivitiesByReportId: Record<string, number[]>; // reportId -> selected activity numbers
  onProgress?: (progress: BulkUploadItemProgress) => void;
  onProgressStateChange?: (state: BulkUploadProgressState) => void;
}): Promise<BulkUploadResult> {
  if (!supabase) {
    throw new Error(
      "Koneksi Supabase belum terkonfigurasi. Pastikan koneksi internet dan kredensial database aktif.",
    );
  }

  const { reports, selectedActivitiesByReportId, onProgress, onProgressStateChange } = params;

  // Inisialisasi progress state pohon hierarkis
  const progressState = buildInitialBulkUploadProgressState(
    reports,
    selectedActivitiesByReportId,
  );

  if (progressState.totalReports === 0) {
    return {
      success: true,
      uploadedReportsCount: 0,
      uploadedActivitiesCount: 0,
      errors: ["Tidak ada laporan atau aktivitas yang dipilih untuk diunggah."],
      progressState,
    };
  }

  progressState.overallStatus = "uploading";
  progressState.currentMessage = "Memulai sinkronisasi bertahap per user...";
  onProgressStateChange?.({ ...progressState });

  // 1. Ambil daftar ID template yang valid di DB agar tidak melanggar foreign key constraint
  let validTemplateIds = new Set<string>();
  try {
    const { data: templatesData } = await supabase
      .from("excel_templates")
      .select("id");
    if (templatesData) {
      templatesData.forEach((t) => validTemplateIds.add(t.id));
    }
  } catch (err) {
    logSafeError(err, "BulkUpload/FetchValidTemplates");
  }

  // Buat index pencarian report object berdasarkan ID
  const reportMap = new Map<string, Report>();
  reports.forEach((r) => reportMap.set(r.id, r));

  let globalReportCounter = 0;
  let globalActivityCounter = 0;

  // 2. Iterasi bertahap per USER
  for (let uIdx = 0; uIdx < progressState.users.length; uIdx++) {
    const userGroup = progressState.users[uIdx];
    progressState.currentUserIndex = uIdx + 1;
    progressState.currentUserName = userGroup.userName;
    userGroup.status = "uploading";
    progressState.currentMessage = `Memproses Petugas (${uIdx + 1}/${progressState.totalUsers}): ${userGroup.userName}...`;
    onProgressStateChange?.({ ...progressState });

    let hasUserError = false;

    // 3. Iterasi bertahap per LAPORAN dalam user tersebut
    for (let rIdx = 0; rIdx < userGroup.reports.length; rIdx++) {
      const reportItem = userGroup.reports[rIdx];
      const report = reportMap.get(reportItem.reportId);

      if (!report) {
        reportItem.status = "error";
        reportItem.errorMessage = "Data laporan tidak ditemukan dalam memori.";
        hasUserError = true;
        progressState.errors.push(`Data laporan ${reportItem.reportDate} hilang.`);
        onProgressStateChange?.({ ...progressState });
        continue;
      }

      globalReportCounter++;
      progressState.currentReportIndex = globalReportCounter;
      progressState.currentReportDate = reportItem.reportDate;
      reportItem.status = "uploading";
      progressState.currentMessage = `Mengunggah: ${userGroup.userName} • ${reportItem.reportDate} (${reportItem.selectedActivitiesCount} aktivitas)...`;
      
      onProgress?.({
        current: globalReportCounter,
        total: progressState.totalReports,
        stage: `Memproses ${userGroup.userName} (${reportItem.reportDate})...`,
        reportName: userGroup.userName,
        reportDate: reportItem.reportDate,
      });
      onProgressStateChange?.({ ...progressState });

      // Memberikan jeda mikro agar UI dapat me-render loader 'o' secara visual dan mulus
      await new Promise((resolve) => setTimeout(resolve, 80));

      const selectedNos = new Set(
        selectedActivitiesByReportId[report.id] || [],
      );
      const activitiesToUpload = (report.activities || []).filter((act) =>
        selectedNos.has(act.no),
      );

      if (activitiesToUpload.length === 0) {
        reportItem.status = "success";
        userGroup.completedReports++;
        onProgressStateChange?.({ ...progressState });
        continue;
      }

      try {
        // A. Dapatkan atau buat reporter directory ID di database
        let reporterDirectoryId: string | null = null;
        try {
          const { data: repData, error: repError } = await supabase.rpc(
            "upsert_reporter_directory_for_report",
            {
              reporter_name_input: formatReporterNameForDatabase(
                userGroup.userName,
              ),
            },
          );
          if (!repError && repData) {
            reporterDirectoryId = repData as string;
          }
        } catch (repErr) {
          logSafeError(repErr, "BulkUpload/UpsertReporterDirectory");
        }

        // B. Cek apakah laporan serupa sudah ada di database (berdasarkan reporter_name dan report_date)
        let targetReportId = generateLocalUUID();
        try {
          const { data: existingDbReport } = await supabase
            .from("daily_reports")
            .select("id")
            .eq(
              "reporter_name",
              formatReporterNameForDatabase(userGroup.userName),
            )
            .eq("report_date", reportItem.reportDate)
            .maybeSingle();

          if (existingDbReport?.id) {
            targetReportId = existingDbReport.id;
          } else if (
            report.id &&
            !report.id.startsWith("draft-") &&
            !report.id.startsWith("imported-")
          ) {
            targetReportId = report.id;
          }
        } catch {
          // Fallback targetReportId baru
        }

        // Validasi Template IDs
        const safeTemplateId =
          report.templateId && validTemplateIds.has(report.templateId)
            ? report.templateId
            : null;

        const safeCoordinatorId =
          report.approverCoordinatorTemplateId &&
          validTemplateIds.has(report.approverCoordinatorTemplateId)
            ? report.approverCoordinatorTemplateId
            : null;

        const safeDivisionHeadId =
          report.approverDivisionHeadTemplateId &&
          validTemplateIds.has(report.approverDivisionHeadTemplateId)
            ? report.approverDivisionHeadTemplateId
            : null;

        // C. Upsert baris daily_reports
        const reportPayload: any = {
          id: targetReportId,
          template_id: safeTemplateId,
          reporter_directory_id: reporterDirectoryId,
          reporter_name: formatReporterNameForDatabase(userGroup.userName),
          tim: report.tim || "PUSDALOPS",
          report_date: reportItem.reportDate,
          template_approver_coordinator_id: safeCoordinatorId,
          approver_coordinator_name: report.approverCoordinator || "",
          approver_coordinator_nip: report.approverCoordinatorNip || "",
          template_approver_division_head_id: safeDivisionHeadId,
          approver_division_head_name: report.approverDivisionHead || "",
          approver_division_head_title: report.approverDivisionHeadTitle || "",
          approver_division_head_nip: report.approverDivisionHeadNip || "",
          created_by_role: "admin",
          created_by_label: "Admin SiLahar (Bulk Upload Cadangan)",
          updated_by_role: "admin",
          updated_by_label: "Admin SiLahar (Bulk Upload Cadangan)",
        };

        const { error: upsertError } = await supabase
          .from("daily_reports")
          .upsert(reportPayload, { onConflict: "id" });

        if (upsertError) {
          throw upsertError;
        }

        // D. Refresh aktivitas lama pada laporan target
        await supabase
          .from("daily_report_activities")
          .delete()
          .eq("report_id", targetReportId);

        // E. Masukkan aktivitas yang dipilih
        const activityIds = activitiesToUpload.map(() => generateLocalUUID());
        const activityPayload = activitiesToUpload.map((act, actIndex) => ({
          id: activityIds[actIndex],
          report_id: targetReportId,
          activity_order: act.no || actIndex + 1,
          activity_description:
            act.description || `Aktivitas ${actIndex + 1}`,
          start_time_text: act.startTime || "08:00",
          end_time_text: act.endTime || "16:00",
        }));

        const { error: actError } = await supabase
          .from("daily_report_activities")
          .insert(activityPayload);

        if (actError) {
          throw actError;
        }

        // F. Masukkan foto aktivitas yang tersedia
        const photoRows: Array<{
          activity_id: string;
          storage_path: string;
          public_url: string;
          original_file_name: string;
          sort_order: number;
        }> = [];

        for (let actIdx = 0; actIdx < activitiesToUpload.length; actIdx++) {
          const act = activitiesToUpload[actIdx];
          const activityId = activityIds[actIdx];
          const photos = act.photos || [];

          for (let pIdx = 0; pIdx < photos.length; pIdx++) {
            const photo = photos[pIdx];
            if (photo.storagePath || photo.publicUrl) {
              photoRows.push({
                activity_id: activityId,
                storage_path: photo.storagePath || "",
                public_url: photo.publicUrl || "",
                original_file_name:
                  photo.originalFileName || `foto-${pIdx + 1}.jpg`,
                sort_order: pIdx + 1,
              });
            }
          }
        }

        if (photoRows.length > 0) {
          try {
            await supabase
              .from("daily_report_activity_photos")
              .insert(photoRows);
          } catch (photoErr) {
            logSafeError(photoErr, "BulkUpload/InsertPhotos");
          }
        }

        // Update status sukses laporan
        reportItem.status = "success";
        userGroup.completedReports++;
        progressState.uploadedReportsCount++;
        progressState.uploadedActivitiesCount += activitiesToUpload.length;
        globalActivityCounter += activitiesToUpload.length;
        progressState.currentActivityIndex = globalActivityCounter;
      } catch (err: any) {
        logSafeError(
          err,
          `BulkUpload/Report_${userGroup.userName}_${reportItem.reportDate}`,
        );
        reportItem.status = "error";
        reportItem.errorMessage = err?.message || "Kesalahan database";
        hasUserError = true;
        const errDesc = `Gagal ${userGroup.userName} (${reportItem.reportDate}): ${err?.message || "Kesalahan database"}`;
        progressState.errors.push(errDesc);
      }

      onProgressStateChange?.({ ...progressState });
    }

    userGroup.status = hasUserError
      ? userGroup.completedReports > 0
        ? "success"
        : "error"
      : "success";
    onProgressStateChange?.({ ...progressState });
  }

  progressState.overallStatus =
    progressState.errors.length === 0
      ? "completed"
      : progressState.uploadedReportsCount > 0
        ? "completed"
        : "error";
  progressState.currentMessage =
    progressState.uploadedReportsCount > 0
      ? `Sinkronisasi selesai! ${progressState.uploadedReportsCount} laporan berhasil diunggah.`
      : "Gagal mengunggah laporan.";

  onProgressStateChange?.({ ...progressState });

  return {
    success: progressState.uploadedReportsCount > 0,
    uploadedReportsCount: progressState.uploadedReportsCount,
    uploadedActivitiesCount: progressState.uploadedActivitiesCount,
    errors: progressState.errors,
    progressState,
  };
}
