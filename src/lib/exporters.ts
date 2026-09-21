import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pdfStyles from "../styles/report-pdf.css?inline";
import { ReportPdfDocument } from "../components/report-pdf-document";
import type { Report } from "../types/report";
import type { PendingPhotoMap } from "./report-draft";
import {
  fetchActiveReportTemplateConfig,
  fetchTeamTypes,
  getHeaderLinesForTeam,
} from "./report-template-service";
import {
  getCachedSignatureDataUrl,
  prefetchAndCacheSignatureImage,
} from "./storage";
import { supabase } from "./supabase";

const IMAGE_READY_TIMEOUT_MS = 12000;
const PDF_IMAGE_MAX_EDGE_PX = 1080;
const PDF_IMAGE_JPEG_QUALITY = 0.80;

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .replace(/[.,/\\]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_()-]/gi, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildDocumentTitle(report: Report) {
  const nameSegment = sanitizeFileSegment(report.nama || "LAPORAN");
  const dateSegment = sanitizeFileSegment(
    report.tanggal || report.reportDate || "TANGGAL",
  );
  return `${nameSegment}_${dateSegment}`;
}

function buildPdfFileName(report: Report) {
  return `${buildDocumentTitle(report)}.pdf`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca blob gambar."));
    reader.readAsDataURL(blob);
  });
}

async function compressImageBlobToDataUrl(blob: Blob): Promise<string> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(
      1,
      PDF_IMAGE_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height, 1),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return await blobToDataUrl(blob);
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", PDF_IMAGE_JPEG_QUALITY);
    });

    bitmap.close();

    if (jpegBlob) {
      return await blobToDataUrl(jpegBlob);
    }
    return await blobToDataUrl(blob);
  } catch {
    return await blobToDataUrl(blob);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return compressImageBlobToDataUrl(file);
}

async function resolveAndMaterializeSignature(url?: string): Promise<string> {
  if (!url || typeof url !== "string" || !url.trim()) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  const cached = getCachedSignatureDataUrl(trimmed);
  if (cached && cached.startsWith("data:image/")) {
    return cached;
  }
  try {
    const dataUrl = await prefetchAndCacheSignatureImage(trimmed);
    if (dataUrl && dataUrl.startsWith("data:image/")) {
      return dataUrl;
    }
  } catch (err) {
    console.warn("Gagal mematerialisasi tanda tangan:", err);
  }
  return trimmed;
}

function renderReportMarkup(report: Report) {
  return `<div class="pdf-report-shell">${renderToStaticMarkup(createElement(ReportPdfDocument, { report }))}</div>`;
}

function createPdfContainer(report: Report) {
  const container = document.createElement("div");
  container.style.width = "210mm";
  container.style.background = "#ffffff";
  container.innerHTML = `
    <style>${pdfStyles}</style>
    ${renderReportMarkup(report)}
  `;
  return container;
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitForImageDecode(image: HTMLImageElement) {
  if (!("decode" in image) || typeof image.decode !== "function") {
    return Promise.resolve();
  }

  return image.decode().catch(() => undefined);
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          const finish = () => {
            window.clearTimeout(timeoutId);
            void waitForImageDecode(image).finally(resolve);
          };

          const timeoutId = window.setTimeout(resolve, IMAGE_READY_TIMEOUT_MS);

          image.loading = "eager";
          image.decoding = "sync";

          if (image.complete) {
            finish();
            return;
          }

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        }),
    ),
  );
}

async function preloadReportImages(report: Report) {
  const sources = Array.from(
    new Set([
      ...report.activities.flatMap((activity) =>
        activity.photos.map((photo) => photo.publicUrl).filter(Boolean),
      ),
      report.approverCoordinatorSignatureUrl,
      report.approverDivisionHeadSignatureUrl,
    ].filter(Boolean) as string[]),
  );

  await Promise.all(
    sources.map(
      (source) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          const finish = () => {
            window.clearTimeout(timeoutId);
            void waitForImageDecode(image).finally(resolve);
          };

          const timeoutId = window.setTimeout(resolve, 3000);
          image.loading = "eager";
          image.decoding = "sync";
          image.referrerPolicy = "no-referrer";
          image.src = source;

          if (image.complete) {
            finish();
            return;
          }

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        }),
    ),
  );
}

async function materializeReportImages(
  report: Report,
  pendingPhotos?: PendingPhotoMap,
): Promise<Report> {
  const cache = new Map<string, string>();

  const activities = await Promise.all(
    report.activities.map(async (activity) => {
      let pendingPhotoIndex = -1;

      return {
        ...activity,
        photos: await Promise.all(
          activity.photos.map(async (photo) => {
            const isPendingLocalPhoto =
              !photo.storagePath && photo.publicUrl && photo.publicUrl.startsWith("blob:");
            if (isPendingLocalPhoto) {
              pendingPhotoIndex += 1;
              const localPendingFile =
                pendingPhotos?.[activity.no]?.[pendingPhotoIndex] ?? null;

              if (localPendingFile) {
                const cacheKey = `${activity.no}:${pendingPhotoIndex}:${localPendingFile.name}:${localPendingFile.size}`;
                const cachedLocal = cache.get(cacheKey);
                if (cachedLocal) {
                  return { ...photo, publicUrl: cachedLocal };
                }

                try {
                  const dataUrl = await fileToDataUrl(localPendingFile);
                  cache.set(cacheKey, dataUrl);
                  return { ...photo, publicUrl: dataUrl };
                } catch {
                  // fallback ke publicUrl blob yang sudah ada
                }
              }
            }

            let source = photo.publicUrl;
            // Resolve from Supabase storage if publicUrl is missing or invalid
            if (
              (!source || source.trim() === "" || source.includes("undefined")) &&
              photo.storagePath &&
              supabase
            ) {
              try {
                const { data } = supabase.storage
                  .from("daily-report-proofs")
                  .getPublicUrl(photo.storagePath);
                if (data?.publicUrl) {
                  source = data.publicUrl;
                }
              } catch {}
            }

            if (!source) {
              return photo;
            }

            if (source.startsWith("data:image/")) {
              return { ...photo, publicUrl: source };
            }

            const cached = cache.get(source);
            if (cached) {
              return { ...photo, publicUrl: cached };
            }

            try {
              const response = await fetch(source, { mode: "cors", credentials: "omit" });
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              const dataUrl = await compressImageBlobToDataUrl(await response.blob());
              cache.set(source, dataUrl);
              return { ...photo, publicUrl: dataUrl };
            } catch {
              // Always retain valid resolved source URL so the browser can load it in the iframe
              cache.set(source, source);
              return { ...photo, publicUrl: source };
            }
          }),
        ),
      };
    }),
  );

  let headerLines = report.headerLines;
  let coordinatorSig = report.approverCoordinatorSignatureUrl;
  let divisionHeadSig = report.approverDivisionHeadSignatureUrl;
  let coordinatorName = report.approverCoordinator;
  let coordinatorNip = report.approverCoordinatorNip;
  let coordinatorLabel = report.approverCoordinatorLabel;
  let divisionHeadName = report.approverDivisionHead;
  let divisionHeadNip = report.approverDivisionHeadNip;
  let divisionHeadTitle = report.approverDivisionHeadTitle;

  // Resolve team headers and coordinator signatures if missing
  try {
    const teamTypes = await fetchTeamTypes();
    if (!headerLines || headerLines.length === 0) {
      headerLines = getHeaderLinesForTeam(report.tim, teamTypes);
    }
    const matchedTeam = teamTypes.find(
      (t) =>
        t.code.toLowerCase() === (report.tim || "trc").toLowerCase() ||
        t.name.toLowerCase() === (report.tim || "trc").toLowerCase(),
    );
    if (matchedTeam) {
      if (!coordinatorSig && matchedTeam.signatureUrl) {
        coordinatorSig = matchedTeam.signatureUrl;
      }
      if (!coordinatorName && matchedTeam.coordinatorName) {
        coordinatorName = matchedTeam.coordinatorName;
      }
      if (!coordinatorNip && matchedTeam.coordinatorNip) {
        coordinatorNip = matchedTeam.coordinatorNip;
      }
      if (!coordinatorLabel && matchedTeam.coordinatorLabel) {
        coordinatorLabel = matchedTeam.coordinatorLabel;
      }
    }
  } catch {
    if (!headerLines || headerLines.length === 0) {
      headerLines = getHeaderLinesForTeam(report.tim, []);
    }
  }

  // Resolve active template approver config for division head if missing
  try {
    const activeConfig = await fetchActiveReportTemplateConfig();
    const divApprover = activeConfig.approvers?.find(
      (a) => a.approverRole === "division_head",
    );
    if (divApprover) {
      if (!divisionHeadSig && divApprover.signatureUrl) {
        divisionHeadSig = divApprover.signatureUrl;
      }
      if (!divisionHeadName && divApprover.officialName) {
        divisionHeadName = divApprover.officialName;
      }
      if (!divisionHeadNip && divApprover.officialNip) {
        divisionHeadNip = divApprover.officialNip;
      }
      if (!divisionHeadTitle && divApprover.officialTitle) {
        divisionHeadTitle = divApprover.officialTitle;
      }
    }
  } catch {}

  // Materialize signatures to base64 Data URLs so they render 100% reliably in print
  const [materializedCoordSig, materializedDivSig] = await Promise.all([
    resolveAndMaterializeSignature(coordinatorSig),
    resolveAndMaterializeSignature(divisionHeadSig),
  ]);

  return {
    ...report,
    headerLines,
    activities,
    approverCoordinator: coordinatorName || report.approverCoordinator,
    approverCoordinatorNip: coordinatorNip || report.approverCoordinatorNip,
    approverCoordinatorLabel: coordinatorLabel || report.approverCoordinatorLabel,
    approverCoordinatorSignatureUrl: materializedCoordSig,
    approverDivisionHead: divisionHeadName || report.approverDivisionHead,
    approverDivisionHeadNip: divisionHeadNip || report.approverDivisionHeadNip,
    approverDivisionHeadTitle: divisionHeadTitle || report.approverDivisionHeadTitle,
    approverDivisionHeadSignatureUrl: materializedDivSig,
  };
}

type Html2PdfInstance = {
  set: (options: Record<string, unknown>) => Html2PdfInstance;
  from: (element: HTMLElement | string) => Html2PdfInstance;
  toPdf: () => Html2PdfInstance;
  outputPdf: (type: "blob") => Promise<Blob>;
};

type Html2PdfFactory = {
  (): Html2PdfInstance;
};

function getPdfOptions(
  report: Report,
  paperFormat: "a4" | "f4" | "legal" | "letter",
) {
  const formatArray = paperFormat === "f4" ? [210, 330] : paperFormat;

  return {
    margin: [20, 0, 20, 0], // Hanya top dan bottom yang ditangani library agar lebar canvas asli 210mm tidak terdistorsi
    filename: buildPdfFileName(report),
    image: { type: "jpeg", quality: 0.85 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
    },
    jsPDF: {
      unit: "mm",
      format: formatArray,
      orientation: "portrait",
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: ["tr", "img", ".pdf-report-footer", ".pdf-report-identity"],
    },
  };
}

async function buildPdfBlob(
  report: Report,
  paperFormat: "a4" | "f4" | "legal" | "letter",
) {
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default as unknown as Html2PdfFactory;
  const container = createPdfContainer(report);

  container.innerHTML += `
    <style>
      .pdf-report-shell, .pdf-report-page {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        min-height: auto !important;
      }
    </style>
  `;

  // Pre-load images in the background so they enter the browser's cache instantly
  const preloader = document.createElement("div");
  preloader.style.position = "fixed";
  preloader.style.width = "1px";
  preloader.style.height = "1px";
  preloader.style.overflow = "hidden";
  preloader.style.opacity = "0";
  preloader.innerHTML = container.innerHTML;
  document.body.appendChild(preloader);

  try {
    await waitForImages(preloader);
    await waitForPaint();
    // Gunakan murni string container.innerHTML agar html2pdf membangun ulang canvas tanpa terkontaminasi CSS tersembunyi
    return await html2pdf()
      .set(getPdfOptions(report, paperFormat))
      .from(container.innerHTML)
      .toPdf()
      .outputPdf("blob");
  } finally {
    document.body.removeChild(preloader);
  }
}

export async function exportReportAsPdf(
  report: Report,
  paperFormat: "a4" | "f4" | "legal" | "letter",
  pendingPhotos?: PendingPhotoMap,
  onStage?: (stageId: string, detail?: string) => void,
) {
  onStage?.("images", "Mengompresi dan memproses foto dokumentasi...");
  const pdfReadyReport = await materializeReportImages(report, pendingPhotos);

  onStage?.("render", "Merender dokumen PDF kualitas tinggi...");
  try {
    const response = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        report: pdfReadyReport,
        paperFormat,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Server returned status ${response.status}: ${errText}`);
    }

    onStage?.("download", "Menyiapkan file unduhan...");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildPdfFileName(report);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    console.warn("Puppeteer PDF generation error, trying client-side fallback:", error);
    onStage?.("render", "Membuat PDF via browser...");
    const blob = await buildPdfBlob(pdfReadyReport, paperFormat);
    onStage?.("download", "Menyiapkan file unduhan...");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildPdfFileName(report);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export async function printReportDocument(
  report: Report,
  paperFormat: "a4" | "f4" | "legal" | "letter",
  pendingPhotos?: PendingPhotoMap,
) {
  const originalTitle = document.title;
  const printReadyReport = await materializeReportImages(report, pendingPhotos);
  const container = createPdfContainer(printReadyReport);
  await preloadReportImages(printReadyReport);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;

  if (!frameWindow || !frameDoc) {
    document.body.removeChild(iframe);
    return;
  }

  frameDoc.open();
  frameDoc.write(`<!DOCTYPE html><html><head><title>${buildDocumentTitle(report)}</title>
  <style>
    @page {
      size: ${paperFormat === "f4" ? "210mm 330mm" : paperFormat} portrait !important;
      margin: 20mm 18mm 20mm 20mm !important;
    }
    body {
      margin: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .pdf-report-shell, .pdf-report-page {
      width: 100% !important;
      min-height: auto !important;
      padding: 0 !important;
    }
  </style>
  </head><body>`);
  frameDoc.write(container.innerHTML);
  frameDoc.write("</body></html>");
  frameDoc.close();

  try {
    await waitForImages(frameDoc.body);
    await waitForPaint();
    await new Promise<void>((resolve) => {
      document.title = buildDocumentTitle(report);
      const cleanupAndResolve = () => resolve();

      frameWindow.onafterprint = cleanupAndResolve;
      // timeout just in case onafterprint doesn't fire or print dialog is closed implicitly in some browsers
      window.setTimeout(cleanupAndResolve, 15000);
      frameWindow.focus();
      frameWindow.print();
    });
  } finally {
    document.title = originalTitle;
    document.body.removeChild(iframe);
  }
}

export async function printMultipleReportsDocument(
  reports: Report[],
  paperFormat: "a4" | "f4" | "legal" | "letter",
  onProgress?: (step: string, pct: number) => void,
) {
  if (!reports || reports.length === 0) return;

  onProgress?.(`Menyiapkan data & tanda tangan (${reports.length} laporan)...`, 25);

  const originalTitle = document.title;
  const printReadyReports = await Promise.all(
    reports.map((report) => materializeReportImages(report)),
  );

  onProgress?.("Memuat aset visual & tata letak...", 55);

  await Promise.all(
    printReadyReports.map((report) => preloadReportImages(report)),
  );

  onProgress?.("Menyusun lembar halaman cetak...", 80);

  const combinedMarkup = printReadyReports
    .map(
      (report) => `
      <div class="print-report-page-block" style="page-break-after: always; break-after: page;">
        ${renderReportMarkup(report)}
      </div>
    `,
    )
    .join("\n");

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;

  if (!frameWindow || !frameDoc) {
    document.body.removeChild(iframe);
    return;
  }

  const firstReport = reports[0];
  const userSegment = firstReport?.nama ? sanitizeFileSegment(firstReport.nama) : "LAPORAN";
  const docTitle = `SEMUA_LAPORAN_${userSegment}_${reports.length}_DOKUMEN`;

  frameDoc.open();
  frameDoc.write(`<!DOCTYPE html><html><head><title>${docTitle}</title>
  <style>
    ${pdfStyles}
    @page {
      size: ${paperFormat === "f4" ? "210mm 330mm" : paperFormat} portrait !important;
      margin: 20mm 18mm 20mm 20mm !important;
    }
    body {
      margin: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-report-page-block {
      page-break-after: always !important;
      break-after: page !important;
    }
    .print-report-page-block:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .pdf-report-shell, .pdf-report-page {
      width: 100% !important;
      min-height: auto !important;
      padding: 0 !important;
    }
  </style>
  </head><body>`);
  frameDoc.write(combinedMarkup);
  frameDoc.write("</body></html>");
  frameDoc.close();

  try {
    await waitForImages(frameDoc.body);
    await waitForPaint();
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.("Membuka dialog cetak dokumen...", 95);
    await new Promise<void>((resolve) => {
      document.title = docTitle;
      const cleanupAndResolve = () => resolve();

      frameWindow.onafterprint = cleanupAndResolve;
      window.setTimeout(cleanupAndResolve, 20000);
      frameWindow.focus();
      frameWindow.print();
    });
  } finally {
    document.title = originalTitle;
    document.body.removeChild(iframe);
  }
}
