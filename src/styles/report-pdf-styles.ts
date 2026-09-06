export const PDF_REPORT_CSS = `
@page {
  size: A4 portrait;
  margin: 20mm 18mm 20mm 20mm;
}

.pdf-report-shell {
  width: 210mm;
  background: #ffffff;
}

.pdf-report-page {
  box-sizing: border-box;
  width: 210mm;
  min-height: 297mm;
  padding: 20mm 18mm 20mm 20mm;
  background: #ffffff;
  color: #000000;
  font-family: Calibri, Arial, Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.35;
}

.pdf-report-header {
  margin-bottom: 25px;
  text-align: center;
  font-weight: 700;
  font-size: 12pt;
}

.pdf-report-header p {
  margin: 0 0 4px;
}

.pdf-report-identity {
  margin-bottom: 10px;
}

.pdf-report-identity table {
  width: 100%;
  border-collapse: collapse;
}

.pdf-report-identity td {
  padding: 0 0 4px;
  font-weight: 600;
  vertical-align: top;
}

.pdf-report-identity td:nth-child(1) {
  width: 115px;
}

.pdf-report-identity td:nth-child(2) {
  width: 12px;
}

.pdf-report-main-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  border-top: 1px solid #000000;
  border-left: 1px solid #000000;
}

.pdf-report-main-table th,
.pdf-report-main-table td {
  border-right: 1px solid #000000;
  border-bottom: 1px solid #000000;
  border-top: none;
  border-left: none;
  padding: 8px 7px;
  vertical-align: middle;
  box-sizing: border-box;
  page-break-inside: avoid;
  break-inside: avoid;
}

.pdf-report-main-table tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

.pdf-report-main-table th {
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}

.pdf-report-main-table td {
  line-height: 1.25;
}

.pdf-report-main-table .col-no {
  width: 8%;
}

.pdf-report-main-table .col-detail {
  width: 50%;
}

.pdf-report-main-table .col-time {
  width: 22%;
}

.pdf-report-main-table .col-proof {
  width: 20%;
}

.pdf-report-main-table .no-cell {
  text-align: center;
}

.pdf-report-main-table .time-cell {
  text-align: center;
}

.pdf-report-main-table .detail-cell {
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-align: left;
}

.pdf-report-main-table .proof-cell {
  padding: 6px;
  text-align: center;
}

.pdf-report-main-table .proof-images-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.pdf-report-main-table .proof-image {
  display: block;
  height: auto;
  max-width: 100%;
  object-fit: contain;
  margin: 0 auto;
}

.pdf-report-approval {
  margin-top: 22px;
  page-break-inside: avoid;
  break-inside: avoid;
}

.pdf-report-approval .approval-title {
  margin: 0 0 10px;
  text-align: center;
  font-weight: 700;
}

.pdf-report-approval .approval-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
}

.pdf-report-approval .approval-column {
  text-align: center;
}

.pdf-report-approval .approval-role {
  margin: 0;
  font-weight: 700;
}

.pdf-report-approval .signature-space {
  min-height: 90px;
}

.pdf-report-approval .approval-name {
  margin: 0 0 4px;
  font-weight: 700;
  text-decoration: underline;
}

.pdf-report-approval .approval-meta {
  margin: 0 0 2px;
}

.pdf-report-notes {
  margin-top: 30px;
  font-size: 8pt;
  page-break-inside: avoid;
  break-inside: avoid;
}

.pdf-report-notes .notes-title {
  margin: 0 0 6px;
  font-weight: 700;
}

.pdf-report-notes ol {
  margin: 0;
  padding-left: 20px;
}

.pdf-report-notes li {
  margin-bottom: 4px;
}
`;
