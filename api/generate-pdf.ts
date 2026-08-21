import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generatePdfBuffer } from "../src/lib/server-pdf-generator";
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
    const { report, paperFormat } = (body || {}) as {
      report: Report;
      paperFormat?: string;
    };

    if (!report || !report.nama) {
      return res.status(400).json({ error: "Data laporan tidak valid" });
    }

    const pdfBuffer = await generatePdfBuffer(report, paperFormat);

    const safeFilename = `${(report.nama || "Laporan").trim().replace(/[^a-zA-Z0-9_-]/g, "_")}_${(report.tanggal || report.reportDate || "Laporan").trim().replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

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
