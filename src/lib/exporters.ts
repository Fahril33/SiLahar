import type { Report } from "../types/report";

function downloadBlob(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function renderPhotoCell(report: Report, activityNo: number) {
  const activity = report.activities.find((item) => item.no === activityNo);
  const photo = activity?.photos[0];

  if (!photo) {
    return "-";
  }

  return `<img src="${photo.publicUrl}" alt="${photo.originalFileName}" style="display:block;width:100%;height:auto;object-fit:cover;border-radius:8px;" />`;
}

export function exportReportAsExcel(report: Report) {
  const rows = [
    ["NAMA", report.nama],
    ["HARI/TANGGAL", report.tanggal],
    [],
    ["NO", "DETAIL AKTIVITAS YANG DILAKSANAKAN", "MULAI", "SELESAI", "BUKTI DOKUMENTASI"],
    ...report.activities.map((activity) => [
      activity.no,
      activity.description,
      activity.startTime,
      `${activity.endTime} WITA`,
      activity.photos[0]?.publicUrl ?? "-",
    ]),
  ];
  const csv = rows.map((row) => row.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(`laporan-${report.nama}-${report.reportDate}.csv`, csv, "text/csv;charset=utf-8");
}

export function exportReportAsWord(report: Report) {
  const content = `
    <html>
      <body>
        <h1>LAPORAN HARIAN KINERJA TIM REAKSI CEPAT</h1>
        <p><strong>NAMA:</strong> ${report.nama}</p>
        <p><strong>HARI/TANGGAL:</strong> ${report.tanggal}</p>
        <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <thead>
            <tr>
              <th style="width:8%;">NO</th>
              <th style="width:46%;word-break:break-word;">DETAIL AKTIVITAS YANG DILAKSANAKAN</th>
              <th style="width:18%;">WAKTU PELAKSANAAN</th>
              <th style="width:28%;">BUKTI DOKUMENTASI</th>
            </tr>
          </thead>
          <tbody>
            ${report.activities
              .map(
                (activity) => `
                  <tr>
                    <td style="vertical-align:top;">${activity.no}</td>
                    <td style="vertical-align:top;white-space:pre-wrap;word-break:break-word;">${activity.description}</td>
                    <td style="vertical-align:top;">${activity.startTime} - ${activity.endTime} WITA</td>
                    <td style="vertical-align:top;">${renderPhotoCell(report, activity.no)}</td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  downloadBlob(`laporan-${report.nama}-${report.reportDate}.doc`, content, "application/msword");
}
