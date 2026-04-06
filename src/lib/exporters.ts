import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pdfStyles from "../styles/report-pdf.css?inline";
import { ReportPdfDocument } from "../components/report-pdf-document";
import type { Report } from "../types/report";
import type { PendingPhotoMap } from "./report-draft";

const IMAGE_READY_TIMEOUT_MS = 12000;

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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca blob gambar."));
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File) {
  return blobToDataUrl(file);
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

          if (image.complete && image.currentSrc) {
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
    new Set(
      report.activities.flatMap((activity) =>
        activity.photos.map((photo) => photo.publicUrl).filter(Boolean),
      ),
    ),
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

          const timeoutId = window.setTimeout(resolve, IMAGE_READY_TIMEOUT_MS);
          image.loading = "eager";
          image.decoding = "sync";
          image.fetchPriority = "high";
          image.crossOrigin = "anonymous";
          image.referrerPolicy = "no-referrer";
          image.src = source;

          if (image.complete && image.currentSrc) {
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
) {
  const cache = new Map<string, string>();

  const activities = await Promise.all(
    report.activities.map(async (activity) => {
      let pendingPhotoIndex = -1;

      return {
        ...activity,
        photos: await Promise.all(
          activity.photos.map(async (photo) => {
            const isPendingLocalPhoto =
              !photo.storagePath && photo.publicUrl.startsWith("blob:");
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

          const source = photo.publicUrl;
          if (!source) {
            return photo;
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

            const dataUrl = await blobToDataUrl(await response.blob());
            cache.set(source, dataUrl);
            return { ...photo, publicUrl: dataUrl };
          } catch {
            cache.set(source, source);
            return photo;
          }
          }),
        ),
      };
    }),
  );

  return {
    ...report,
    activities,
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
    image: { type: "jpeg", quality: 0.98 },
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
) {
  const blob = await buildPdfBlob(report, paperFormat);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildPdfFileName(report);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
/*  */    document.body.removeChild(iframe);
  }
}
