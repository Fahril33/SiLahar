import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { saveAs } from "file-saver";
import type { Report } from "../types/report";
import {
  getMonthCalendarWeeks,
  BULAN_NAMES_FULL,
} from "./calendar-week-utils";
import { formatWitaDate } from "./time";

import { materializeReportImages } from "./exporters";
import { ReportConsolidatedPdfDocument } from "../components/report-consolidated-pdf-document";
import pdfStyles from "../styles/report-pdf.css?inline";

export interface BulkWeeklySectionItem {
  id: string; // e.g. "User_2026-09_week_1"
  weekKey: string;
  mondayDate: string;
  sundayDate: string;
  startDate?: string;
  endDate?: string;
  periodLabel: string;
  weekLabel: string;
  monthUpperLabel: string;
  weekNumber: number;
  reports: Report[];
  totalActivitiesCount: number;
  showDivisionHead: boolean; // Aturan TTD Kabid: hanya sekali di akhir minggu (minggu terakhir dalam bulan)
}

export interface BulkWeeklyPdfItem {
  id: string; // e.g. "User_2026-09"
  userName: string;
  teamName: string;
  monthKey: string; // "YYYY-MM"
  year: number;
  month: number;
  periodLabel: string;
  monthUpperLabel: string;
  weekLabel: string;
  weeks: BulkWeeklySectionItem[];
  totalWeeksCount: number;
  totalActivitiesCount: number;
  showDivisionHead: boolean;
  status: "pending" | "rendering" | "success" | "error";
  errorMessage?: string;
  pdfFileName: string;
}

export interface BulkWeeklyUserGroup {
  userName: string;
  teamName: string;
  totalWeeks: number;
  completedWeeks: number;
  status: "pending" | "rendering" | "success" | "error";
  weeks: BulkWeeklyPdfItem[];
}

export interface BulkWeeklyPdfProgressState {
  totalUsers: number;
  totalWeeklyDocs: number;
  totalReports: number;
  completedDocsCount: number;
  currentUserName: string;
  currentMessage: string;
  overallStatus: "running" | "completed" | "error";
  users: BulkWeeklyUserGroup[];
  errors: string[];
}

function sanitizeFileNamePart(str: string): string {
  return (str || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
}

/**
 * Mengelompokkan laporan terpilih untuk export PDF mingguan per user dan dirender dalam 1 file per bulannya.
 * Laporan dikelompokkan ke bulan kalender masing-masing, lalu dibagi ke dalam minggu resmi kalender bulan tersebut
 * (Minggu 1 mulai tanggal 1 s/d akhir minggu pertama, dst.) sehingga Minggu ke-1 tidak pernah terlewat atau tertukar.
 * TTD tetap per minggu, dengan Kabid di minggu terakhir bulan, dan disimpan file per bulan.
 */
export function groupReportsForBulkWeeklyPdf(
  reports: Report[],
  selectedActivitiesByReportId: Record<string, number[]>,
): BulkWeeklyUserGroup[] {
  // 1. Saring laporan yang memiliki setidaknya satu aktivitas terpilih
  const selectedReports = reports.filter((r) => {
    const sel = selectedActivitiesByReportId[r.id] || [];
    return sel.length > 0;
  });

  // 2. Kelompokkan per user
  const userMap = new Map<string, Report[]>();
  for (const report of selectedReports) {
    const userName = report.nama || "Tanpa Nama";
    if (!userMap.has(userName)) {
      userMap.set(userName, []);
    }
    userMap.get(userName)!.push(report);
  }

  // 3. Untuk setiap user, kelompokkan laporan per bulan kalender, lalu per minggu kalender dalam bulan tersebut
  const userGroups: BulkWeeklyUserGroup[] = [];

  const sortedUserNames = Array.from(userMap.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const userName of sortedUserNames) {
    const userReports = userMap.get(userName) || [];
    const teamName = userReports[0]?.tim || "PUSDALOPS";

    // Kelompokkan laporan user per bulan kalender (YYYY-MM) berdasarkan tanggal laporan
    const reportsByMonth = new Map<string, Report[]>();
    for (const report of userReports) {
      const refDate =
        report.reportDate || (report.tanggal && report.tanggal.slice(0, 10)) || "";
      if (!refDate || refDate.length < 7) continue;
      const ym = refDate.slice(0, 7);
      if (!reportsByMonth.has(ym)) {
        reportsByMonth.set(ym, []);
      }
      reportsByMonth.get(ym)!.push(report);
    }

    const sortedMonthKeys = Array.from(reportsByMonth.keys()).sort();

    const monthlyWeeklyItems: BulkWeeklyPdfItem[] = [];

    for (const yearMonth of sortedMonthKeys) {
      const monthReports = reportsByMonth.get(yearMonth)!;
      const [yearStr, monthStr] = yearMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const monthName = BULAN_NAMES_FULL[month - 1] || "Bulan";
      const monthPeriodLabel = `${monthName} ${year}`;
      const monthNameUpper = `${monthName.toUpperCase()} ${year}`;
      const monthUpperLabel = `BULAN ${monthNameUpper}`;

      // Ambil seluruh minggu kalender resmi untuk bulan ini (Minggu 1, Minggu 2, ...)
      const monthCalendarWeeks = getMonthCalendarWeeks(yearMonth);

      const candidateSectionItems: BulkWeeklySectionItem[] = [];

      for (const mw of monthCalendarWeeks) {
        // Ambil laporan yang berada di dalam rentang minggu bulan ini (startDate s/d endDate)
        const weekReports = monthReports
          .filter((r) => {
            const rDate =
              r.reportDate || (r.tanggal && r.tanggal.slice(0, 10)) || "";
            return rDate >= mw.startDate && rDate <= mw.endDate;
          })
          .map((r) => {
            const selectedNos = new Set(
              selectedActivitiesByReportId[r.id] || [],
            );
            return {
              ...r,
              activities: (r.activities || []).filter((act) =>
                selectedNos.has(act.no),
              ),
            };
          })
          .filter((r) => r.activities.length > 0)
          .sort((a, b) => (a.reportDate || "").localeCompare(b.reportDate || ""));

        if (weekReports.length === 0) continue;

        const totalActivities = weekReports.reduce(
          (sum, r) => sum + r.activities.length,
          0,
        );

        const startFormatted = formatWitaDate(mw.startDate);
        const endFormatted = formatWitaDate(mw.endDate);
        const periodLabel = `${startFormatted} s/d ${endFormatted}`;

        candidateSectionItems.push({
          id: `${userName}_${yearMonth}_week_${mw.weekNumber}`,
          weekKey: mw.weekKey,
          mondayDate: mw.monday,
          sundayDate: mw.sunday,
          startDate: mw.startDate,
          endDate: mw.endDate,
          periodLabel,
          weekLabel: `Minggu ke-${mw.weekNumber}`,
          monthUpperLabel: monthNameUpper,
          weekNumber: mw.weekNumber,
          reports: weekReports,
          totalActivitiesCount: totalActivities,
          showDivisionHead: false, // Akan disetel di bawah untuk minggu terakhir
        });
      }

      if (candidateSectionItems.length === 0) continue;

      // Aturan: TTD Kabid harus berada di minggu terakhir dalam bulan
      candidateSectionItems.forEach((section, index) => {
        section.showDivisionHead = index === candidateSectionItems.length - 1;
      });

      const totalMonthActivities = candidateSectionItems.reduce(
        (sum, s) => sum + s.totalActivitiesCount,
        0,
      );

      const safeUser = sanitizeFileNamePart(userName);
      const safeTeam = sanitizeFileNamePart(teamName);
      const safeMonthName = sanitizeFileNamePart(monthName);

      // Disimpan 1 file per bulan berisi seluruh minggu dalam bulan tersebut
      const pdfFileName = `Laporan_Mingguan_${safeTeam}_${safeUser}_${safeMonthName}_${year}.pdf`;

      monthlyWeeklyItems.push({
        id: `${userName}_${yearMonth}`,
        userName,
        teamName,
        monthKey: yearMonth,
        year,
        month,
        periodLabel: monthPeriodLabel,
        monthUpperLabel,
        weekLabel: `${candidateSectionItems.length} Minggu (${monthPeriodLabel})`,
        weeks: candidateSectionItems,
        totalWeeksCount: candidateSectionItems.length,
        totalActivitiesCount: totalMonthActivities,
        showDivisionHead: true,
        status: "pending" as const,
        pdfFileName,
      });
    }

    if (monthlyWeeklyItems.length > 0) {
      userGroups.push({
        userName,
        teamName,
        totalWeeks: monthlyWeeklyItems.length,
        completedWeeks: 0,
        status: "pending",
        weeks: monthlyWeeklyItems,
      });
    }
  }

  return userGroups;
}

/**
 * Membangun initial progress state untuk bulk weekly PDF
 */
export function buildInitialBulkWeeklyPdfProgressState(
  userGroups: BulkWeeklyUserGroup[],
  totalReportsCount: number,
): BulkWeeklyPdfProgressState {
  const totalWeeklyDocs = userGroups.reduce(
    (sum, u) => sum + u.weeks.length,
    0,
  );

  return {
    totalUsers: userGroups.length,
    totalWeeklyDocs,
    totalReports: totalReportsCount,
    completedDocsCount: 0,
    currentUserName: "",
    currentMessage: "Menyiapkan antrean pembuatan dokumen PDF mingguan...",
    overallStatus: "running",
    users: JSON.parse(JSON.stringify(userGroups)),
    errors: [],
  };
}

/**
 * Menghasilkan PDF Blob untuk 1 dokumen bulanan yang berisi rekap laporan per minggu.
 * TTD tetap per minggu, dengan TTD Kabid berada di minggu terakhir bulan.
 */
export async function renderWeeklyConsolidatedPdfBlob(
  item: BulkWeeklyPdfItem,
  paperFormat: "a4" | "f4" | "legal" | "letter" = "a4",
  preferredEngine: "puppeteer" | "html2pdf" = "puppeteer",
): Promise<Blob> {
  if (!item.weeks || item.weeks.length === 0) {
    throw new Error("Tidak ada data minggu untuk bulan ini");
  }

  // Render setiap minggu sebagai dokumen konsolidasi mingguan lengkap dengan TTD mingguannya masing-masing
  const weekHtmlList: string[] = [];

  for (const weekItem of item.weeks) {
    const materializedReports = await Promise.all(
      weekItem.reports.map((report) => materializeReportImages(report)),
    );

    const firstReport = materializedReports[0];
    if (!firstReport) continue;

    const weekStaticHtml = renderToStaticMarkup(
      createElement(ReportConsolidatedPdfDocument, {
        titlePeriod: weekItem.periodLabel,
        reporterName: firstReport.nama,
        teamName: firstReport.tim,
        headerLines: firstReport.headerLines,
        reports: materializedReports,
        approverCoordinator: firstReport.approverCoordinator,
        approverCoordinatorNip: firstReport.approverCoordinatorNip,
        approverCoordinatorLabel: firstReport.approverCoordinatorLabel,
        approverCoordinatorSignatureUrl: firstReport.approverCoordinatorSignatureUrl,
        approverDivisionHead: firstReport.approverDivisionHead,
        approverDivisionHeadTitle: firstReport.approverDivisionHeadTitle,
        approverDivisionHeadNip: firstReport.approverDivisionHeadNip,
        approverDivisionHeadSignatureUrl: firstReport.approverDivisionHeadSignatureUrl,
        showDivisionHead: weekItem.showDivisionHead,
        monthLabel: weekItem.monthUpperLabel,
        weekLabel: String(weekItem.weekNumber),
      }),
    );

    weekHtmlList.push(weekStaticHtml);
  }

  // Gabungkan semua halaman minggu dengan pemisah page-break yang didukung Puppeteer dan html2pdf
  const combinedWeeksHtml = weekHtmlList.join(
    '\n<div class="html2pdf__page-break" style="page-break-after: always; break-after: page;"></div>\n',
  );

  const fullMarkup = `
    <div class="pdf-report-shell">
      <style>
        ${pdfStyles}
        .pdf-report-shell, .pdf-report-page {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          min-height: auto !important;
        }
        .pdf-report-page + .pdf-report-page {
          page-break-before: always;
          break-before: page;
          margin-top: 0;
        }
        @media print {
          .html2pdf__page-break {
            page-break-after: always;
            break-after: page;
          }
        }
      </style>
      ${combinedWeeksHtml}
    </div>
  `;

  // 1. Coba gunakan engine lokal (Puppeteer Chrome) kualitas tinggi sebagaimana tombol di halaman history (default & prioritas)
  if (preferredEngine === "puppeteer") {
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: fullMarkup,
          paperFormat,
          filename: item.pdfFileName,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          return blob;
        }
      }
    } catch (err) {
      console.warn(
        "Puppeteer PDF generation error, fallback ke client html2pdf:",
        err,
      );
    }
  }

  // 2. Fallback ke engine html2pdf.js browser
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default as any;

  // Hidden preloader container di DOM agar html2pdf dapat membaca dimensi visual dengan benar
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width =
    paperFormat === "legal" || paperFormat === "letter" ? "816px" : "794px";
  container.style.background = "#ffffff";
  container.innerHTML = fullMarkup;
  document.body.appendChild(container);

  try {
    // Tunggu render & gambar termuat
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const formatArray = paperFormat === "f4" ? [210, 330] : paperFormat;
    const isWider = paperFormat === "legal" || paperFormat === "letter";

    const opt = {
      margin: [20, 20, 20, 18],
      filename: item.pdfFileName,
      image: { type: "jpeg", quality: 0.85 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: isWider ? 816 : 794,
      },
      jsPDF: {
        unit: "mm",
        format: formatArray,
        orientation: "portrait",
      },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: ["tr", "img", ".pdf-report-footer", ".pdf-report-identity", ".date-group-tbody"],
      },
    };

    const pdfBlob: Blob = await html2pdf()
      .set(opt)
      .from(container.innerHTML)
      .toPdf()
      .outputPdf("blob");

    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Menjalankan proses eksekusi unduh bulk PDF mingguan untuk banyak user sekaligus.
 * Setiap bulan dirender ke dalam 1 file PDF yang memuat laporan mingguan dengan TTD per minggu.
 */
export async function executeBulkWeeklyPdfDownload(
  reports: Report[],
  selectedActivitiesByReportId: Record<string, number[]>,
  paperFormat: "a4" | "f4" | "legal" | "letter" = "a4",
  onProgressStateChange?: (state: BulkWeeklyPdfProgressState) => void,
  preferredEngine: "puppeteer" | "html2pdf" = "puppeteer",
): Promise<{ success: boolean; downloadedCount: number; errors: string[] }> {
  const userGroups = groupReportsForBulkWeeklyPdf(
    reports,
    selectedActivitiesByReportId,
  );

  const selectedReports = reports.filter((r) => {
    const sel = selectedActivitiesByReportId[r.id] || [];
    return sel.length > 0;
  });

  const progressState = buildInitialBulkWeeklyPdfProgressState(
    userGroups,
    selectedReports.length,
  );
  onProgressStateChange?.({ ...progressState });

  let downloadedCount = 0;

  for (const userGroup of progressState.users) {
    userGroup.status = "rendering";
    progressState.currentUserName = userGroup.userName;
    let hasUserError = false;

    for (const monthDoc of userGroup.weeks) {
      monthDoc.status = "rendering";
      progressState.currentMessage = `Merender PDF Mingguan: ${userGroup.userName} • ${monthDoc.periodLabel} (${monthDoc.totalWeeksCount} minggu, ${monthDoc.totalActivitiesCount} aktivitas)...`;
      onProgressStateChange?.({ ...progressState });

      try {
        const pdfBlob = await renderWeeklyConsolidatedPdfBlob(
          monthDoc,
          paperFormat,
          preferredEngine,
        );

        // Download langsung file PDF ke browser
        saveAs(pdfBlob, monthDoc.pdfFileName);

        // Jeda kecil agar browser tidak memblokir antrean multiple download
        await new Promise((res) => setTimeout(res, 450));

        monthDoc.status = "success";
        userGroup.completedWeeks++;
        progressState.completedDocsCount++;
        downloadedCount++;
      } catch (err: any) {
        console.error("Gagal membuat PDF mingguan bulanan:", err);
        monthDoc.status = "error";
        monthDoc.errorMessage = err?.message || "Gagal membuat PDF mingguan bulanan";
        hasUserError = true;
        progressState.errors.push(
          `Gagal PDF ${userGroup.userName} (${monthDoc.periodLabel}): ${err?.message || "Error render"}`,
        );
      }

      onProgressStateChange?.({ ...progressState });
    }

    userGroup.status = hasUserError
      ? userGroup.completedWeeks > 0
        ? "success"
        : "error"
      : "success";
    onProgressStateChange?.({ ...progressState });
  }

  progressState.overallStatus =
    progressState.errors.length === 0
      ? "completed"
      : downloadedCount > 0
        ? "completed"
        : "error";

  progressState.currentMessage =
    downloadedCount > 0
      ? `Selesai! ${downloadedCount} dokumen PDF mingguan (per bulan) berhasil diunduh.`
      : "Gagal mengunduh dokumen PDF mingguan.";

  onProgressStateChange?.({ ...progressState });

  return {
    success: downloadedCount > 0,
    downloadedCount,
    errors: progressState.errors,
  };
}
