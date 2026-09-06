import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "node:fs";
import { ReportPdfDocument } from "../components/report-pdf-document";
import type { Report } from "../types/report";
import { PDF_REPORT_CSS } from "../styles/report-pdf-styles";

function getLocalChromePath(): string | null {
  const platform = process.platform;
  if (platform === "darwin") {
    const paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "linux") {
    const paths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function getBrowserInstance(): Promise<Browser> {
  // Check if running in AWS Lambda / Vercel Serverless environment
  const isServerless =
    Boolean(process.env.AWS_REGION) ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_EXECUTION_ENV);

  if (isServerless) {
    return await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local development: try local Chrome executable
  const localPath = getLocalChromePath();
  if (localPath) {
    return await puppeteer.launch({
      executablePath: localPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

  // Fallback to sparticuz chromium executable path
  return await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

function getPdfPaperDimensions(paperFormat?: string) {
  const format = (paperFormat || "a4").toLowerCase();
  if (format === "f4") {
    return {
      width: "210mm",
      height: "330mm",
    };
  }
  if (format === "legal") {
    return {
      format: "Legal" as const,
    };
  }
  if (format === "letter") {
    return {
      format: "Letter" as const,
    };
  }
  return {
    format: "A4" as const,
  };
}

export function renderReportToHtml(report: Report): string {
  const bodyMarkup = renderToStaticMarkup(
    createElement(ReportPdfDocument, { report })
  );

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${report.nama || "Laporan"}</title>
  <style>
    ${PDF_REPORT_CSS}
    
    /* Strict print & page layout optimizations for Chromium */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .pdf-report-shell, .pdf-report-page {
      width: 100% !important;
      min-height: auto !important;
      padding: 0 !important;
    }

    .pdf-report-main-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .pdf-report-approval {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .pdf-report-notes {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  <div class="pdf-report-shell">
    ${bodyMarkup}
  </div>
</body>
</html>`;
}

export async function generatePdfBuffer(
  report: Report,
  paperFormat?: string
): Promise<Buffer> {
  const html = renderReportToHtml(report);
  const browser = await getBrowserInstance();

  try {
    const page = await browser.newPage();
    
    // Set content and wait for images to load
    await page.setContent(html, {
      waitUntil: ["load", "domcontentloaded"],
      timeout: 30000,
    });

    const dimensions = getPdfPaperDimensions(paperFormat);

    const pdfUint8Array = await page.pdf({
      ...dimensions,
      printBackground: true,
      margin: {
        top: "20mm",
        right: "18mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}
