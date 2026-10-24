import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { saveAs } from "file-saver";
import type { Report } from "../types/report";
import { BULAN_NAMES_FULL } from "./calendar-week-utils";
import { materializeReportImages } from "./exporters";
import { ReportConsolidatedPdfDocument } from "../components/report-consolidated-pdf-document";
import pdfStyles from "../styles/report-pdf.css?inline";

export interface BulkMonthlyPdfItem {
  id: string; // e.g. "User_2026-10"
  userName: string;
  teamName: string;
  monthKey: string; // "YYYY-MM"
  year: number;
  month: number;
  periodLabel: string; // e.g. "Bulan Oktober 2026"
  monthUpperLabel: string; // e.g. "BULAN OKTOBER 2026"
  reports: Report[];
  totalActivitiesCount: number;
  status: "pending" | "rendering" | "success" | "error";
  errorMessage?: string;
  pdfFileName: string;
}

export interface BulkMonthlyUserGroup {
  userName: string;
  teamName: string;
  totalMonths: number;
  completedMonths: number;
  status: "pending" | "rendering" | "success" | "error";
  months: BulkMonthlyPdfItem[];
}

export interface BulkMonthlyPdfProgressState {
  totalUsers: number;
  totalMonthlyDocs: number;
  totalReports: number;
  completedDocsCount: number;
  currentUserName: string;
  currentMessage: string;
  overallStatus: "running" | "completed" | "error";
  users: BulkMonthlyUserGroup[];
  errors: string[];
}

function sanitizeFileNamePart(str: string): string {
  return (str || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
}

/**
 * Mengelompokkan laporan terpilih untuk export PDF bulanan per user dan per bulan kalender (YYYY-MM)
 */
export function groupReportsForBulkMonthlyPdf(
  reports: Report[],
  selectedActivitiesByReportId: Record<string, number[]>,
): BulkMonthlyUserGroup[] {
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

  // 3. Untuk setiap user, kelompokkan per bulan kalender (YYYY-MM)
  const userGroups: BulkMonthlyUserGroup[] = [];
  const sortedUserNames = Array.from(userMap.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const userName of sortedUserNames) {
    const userReports = userMap.get(userName) || [];
    const teamName = userReports[0]?.tim || "PUSDALOPS";

    // Kelompokkan berdasarkan YYYY-MM
    const monthMap = new Map<string, Report[]>();
    for (const report of userReports) {
      const dateStr = report.reportDate || "";
      const parts = dateStr.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const monthKey =
        !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12
          ? `${year}-${String(month).padStart(2, "0")}`
          : "Lainnya";

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey)!.push(report);
    }

    const sortedMonthKeys = Array.from(monthMap.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    const monthlyItems: BulkMonthlyPdfItem[] = sortedMonthKeys
      .map((monthKey) => {
        const rawReports = monthMap.get(monthKey) || [];

        // Saring aktivitas per laporan sesuai seleksi pengguna
        const filteredReports: Report[] = rawReports
          .map((r) => {
            const selectedNos = new Set(selectedActivitiesByReportId[r.id] || []);
            return {
              ...r,
              activities: (r.activities || []).filter((act) =>
                selectedNos.has(act.no),
              ),
            };
          })
          .filter((r) => r.activities.length > 0)
          .sort((a, b) => (a.reportDate || "").localeCompare(b.reportDate || ""));

        const totalActivities = filteredReports.reduce(
          (sum, r) => sum + r.activities.length,
          0,
        );

        const parts = monthKey.split("-");
        const year = parseInt(parts[0], 10) || new Date().getFullYear();
        const month = parseInt(parts[1], 10) || new Date().getMonth() + 1;
        const monthName = BULAN_NAMES_FULL[month - 1] || `Bulan ${month}`;

        const periodLabel = `Bulan ${monthName} ${year}`;
        const monthUpperLabel = `BULAN ${monthName.toUpperCase()} ${year}`;

        const safeUser = sanitizeFileNamePart(userName);
        const safeTeam = sanitizeFileNamePart(teamName);
        const safeMonthName = sanitizeFileNamePart(monthName);

        const pdfFileName = `Laporan_Bulanan_${safeTeam}_${safeUser}_${safeMonthName}_${year}.pdf`;

        return {
          id: `${userName}_${monthKey}`,
          userName,
          teamName,
          monthKey,
          year,
          month,
          periodLabel,
          monthUpperLabel,
          reports: filteredReports,
          totalActivitiesCount: totalActivities,
          status: "pending" as const,
          pdfFileName,
        };
      })
      .filter((m) => m.reports.length > 0);

    if (monthlyItems.length > 0) {
      userGroups.push({
        userName,
        teamName,
        totalMonths: monthlyItems.length,
        completedMonths: 0,
        status: "pending",
        months: monthlyItems,
      });
    }
  }

  return userGroups;
}

/**
 * Membangun initial progress state untuk bulk monthly PDF
 */
export function buildInitialBulkMonthlyPdfProgressState(
  userGroups: BulkMonthlyUserGroup[],
  totalReportsCount: number,
): BulkMonthlyPdfProgressState {
  const totalMonthlyDocs = userGroups.reduce(
    (sum, u) => sum + u.months.length,
    0,
  );

  return {
    totalUsers: userGroups.length,
    totalMonthlyDocs,
    totalReports: totalReportsCount,
    completedDocsCount: 0,
    currentUserName: "",
    currentMessage: "Menyiapkan antrean pembuatan dokumen PDF bulanan...",
    overallStatus: "running",
    users: JSON.parse(JSON.stringify(userGroups)),
    errors: [],
  };
}

/**
 * Menghasilkan PDF Blob untuk 1 dokumen konsolidasi bulanan
 */
export async function renderMonthlyConsolidatedPdfBlob(
  item: BulkMonthlyPdfItem,
  paperFormat: "a4" | "f4" | "legal" | "letter" = "a4",
  preferredEngine: "puppeteer" | "html2pdf" = "puppeteer",
): Promise<Blob> {
  // Materialisasi foto dokumentasi ke data URLs
  const materializedReports = await Promise.all(
    item.reports.map((report) => materializeReportImages(report)),
  );

  const firstReport = materializedReports[0];
  if (!firstReport) {
    throw new Error("Tidak ada data laporan untuk bulan ini");
  }

  // Render komponen ReportConsolidatedPdfDocument ke markup string
  const staticHtml = renderToStaticMarkup(
    createElement(ReportConsolidatedPdfDocument, {
      titlePeriod: item.monthUpperLabel,
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
      showDivisionHead: true,
      monthLabel: item.monthUpperLabel,
      weekLabel: "-", // Menggunakan "-" agar tidak memunculkan kata "Minggu Ke-X"
    }),
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
      </style>
      ${staticHtml}
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

  // Hidden preloader container di DOM
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
        avoid: [
          "tr",
          "img",
          ".pdf-report-footer",
          ".pdf-report-identity",
          ".date-group-tbody",
        ],
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
 * Menjalankan proses eksekusi unduh bulk PDF bulanan untuk banyak user sekaligus
 */
export async function executeBulkMonthlyPdfDownload(
  reports: Report[],
  selectedActivitiesByReportId: Record<string, number[]>,
  paperFormat: "a4" | "f4" | "legal" | "letter" = "a4",
  onProgressStateChange?: (state: BulkMonthlyPdfProgressState) => void,
  preferredEngine: "puppeteer" | "html2pdf" = "puppeteer",
): Promise<{ success: boolean; downloadedCount: number; errors: string[] }> {
  const userGroups = groupReportsForBulkMonthlyPdf(
    reports,
    selectedActivitiesByReportId,
  );

  const selectedReports = reports.filter((r) => {
    const sel = selectedActivitiesByReportId[r.id] || [];
    return sel.length > 0;
  });

  const progressState = buildInitialBulkMonthlyPdfProgressState(
    userGroups,
    selectedReports.length,
  );
  onProgressStateChange?.({ ...progressState });

  let downloadedCount = 0;

  for (const userGroup of progressState.users) {
    userGroup.status = "rendering";
    progressState.currentUserName = userGroup.userName;
    let hasUserError = false;

    for (const monthItem of userGroup.months) {
      monthItem.status = "rendering";
      progressState.currentMessage = `Merender PDF Bulanan: ${userGroup.userName} • ${monthItem.periodLabel} (${monthItem.totalActivitiesCount} aktivitas)...`;
      onProgressStateChange?.({ ...progressState });

      try {
        const pdfBlob = await renderMonthlyConsolidatedPdfBlob(
          monthItem,
          paperFormat,
          preferredEngine,
        );

        // Download langsung file PDF ke browser
        saveAs(pdfBlob, monthItem.pdfFileName);

        // Jeda kecil agar browser tidak memblokir antrean multiple download
        await new Promise((res) => setTimeout(res, 450));

        monthItem.status = "success";
        userGroup.completedMonths++;
        progressState.completedDocsCount++;
        downloadedCount++;
      } catch (err: any) {
        console.error("Gagal membuat PDF bulanan:", err);
        monthItem.status = "error";
        monthItem.errorMessage = err?.message || "Gagal membuat PDF bulanan";
        hasUserError = true;
        progressState.errors.push(
          `Gagal PDF ${userGroup.userName} (${monthItem.periodLabel}): ${err?.message || "Error render"}`,
        );
      }

      onProgressStateChange?.({ ...progressState });
    }

    userGroup.status = hasUserError
      ? userGroup.completedMonths > 0
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
      ? `Selesai! ${downloadedCount} dokumen PDF bulanan berhasil diunduh.`
      : "Gagal mengunduh dokumen PDF bulanan.";

  onProgressStateChange?.({ ...progressState });

  return {
    success: downloadedCount > 0,
    downloadedCount,
    errors: progressState.errors,
  };
}
