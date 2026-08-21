import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function pdfApiDevPlugin(): Plugin {
  return {
    name: "pdf-api-dev-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/api/generate-pdf") && req.method === "POST") {
          let rawBody = "";
          req.on("data", (chunk) => {
            rawBody += chunk;
          });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody || "{}");
              const { generatePdfBuffer } = await server.ssrLoadModule(
                "./src/lib/server-pdf-generator.ts"
              );
              const pdfBuffer = await generatePdfBuffer(
                body.report,
                body.paperFormat
              );

              const safeFilename = `${(body.report?.nama || "Laporan")
                .trim()
                .replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

              res.setHeader("Content-Type", "application/pdf");
              res.setHeader(
                "Content-Disposition",
                `attachment; filename="${safeFilename}"`
              );
              res.statusCode = 200;
              res.end(pdfBuffer);
            } catch (error) {
              console.error("Local PDF Generation Dev Server Error:", error);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: "Gagal membuat PDF lokal",
                  details:
                    error instanceof Error ? error.message : String(error),
                })
              );
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pdfApiDevPlugin()],
});
