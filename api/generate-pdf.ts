import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Report } from "../src/types/report";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { report, html, paperFormat, filename } = (body || {}) as {
      report?: Report;
      html?: string;
      paperFormat?: string;
      filename?: string;
    };

    if (!html && (!report || !report.nama)) {
      return res.status(400).json({ error: "Data laporan tidak valid" });
    }

    const { generatePdfBuffer, generatePdfBufferFromHtml } = await import(
      "../src/lib/server-pdf-generator"
    );

    let pdfBuffer: Buffer;
    if (html) {
      pdfBuffer = await generatePdfBufferFromHtml(html, paperFormat, filename);
    } else if (report) {
      pdfBuffer = await generatePdfBuffer(report, paperFormat);
    } else {
      return res.status(400).json({ error: "Data laporan tidak valid" });
    }

    const rawName = (filename || report?.nama || "Laporan")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeFilename = rawName.endsWith(".pdf") ? rawName : `${rawName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation failed:", error);
    return res.status(500).json({
      error: "Gagal membuat dokumen PDF di server",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
