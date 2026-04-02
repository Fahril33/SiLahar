import type { Report } from "../types/report";

export function ReportPdfDocument(props: { report: Report }) {
  const { report } = props;

  return (
    <article className="pdf-report-page">
      <header className="pdf-report-header">
        <p>LAPORAN HARIAN KINERJA TIM REAKSI CEPAT</p>
        <p>BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH</p>
        <p>TAHUN ANGGARAN 2026</p>
      </header>

      <section className="pdf-report-identity">
        <table>
          <tbody>
            <tr>
              <td>NAMA</td>
              <td>:</td>
              <td>{report.nama || "-"}</td>
            </tr>
            <tr>
              <td>HARI/TANGGAL</td>
              <td>:</td>
              <td>{report.tanggal || "-"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pdf-report-main-table">
        <table>
          <thead>
            <tr>
              <th className="col-no">NO</th>
              <th className="col-detail">DETAIL AKTIVITAS YANG DILAKSANAKAN</th>
              <th className="col-time">WAKTU PELAKSANAAN</th>
              <th className="col-proof">BUKTI DOKUMENTASI</th>
            </tr>
          </thead>
          <tbody>
            {report.activities.map((activity) => (
              <tr key={activity.no}>
                <td className="no-cell">{activity.no}</td>
                <td className="detail-cell">{activity.description || "-"}</td>
                <td>
                  {activity.startTime} - {activity.endTime} WITA
                </td>
                <td className="proof-cell">
                  {activity.photos[0] ? (
                    <img
                      src={activity.photos[0].publicUrl}
                      alt={activity.photos[0].originalFileName}
                      className="proof-image"
                    />
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pdf-report-approval">
        <p className="approval-title">PERSETUJUAN</p>
        <div className="approval-grid">
          <section className="approval-column">
            <p className="approval-role">KOORDINATOR TIM</p>
            <div className="signature-space" />
            <br />
            <p className="approval-name">{report.approverCoordinator || "-"}</p>
            <p className="approval-meta">
              NIP: {report.approverCoordinatorNip || "-"}
            </p>
          </section>

          <section className="approval-column">
            <p className="approval-role">
              KEPALA BIDANG KEDARURATAN &amp; LOGISTIK
            </p>
            <div className="signature-space" />
            <p className="approval-name">
              {report.approverDivisionHead || "-"}
            </p>
            <p className="approval-meta">
              Pangkat: {report.approverDivisionHeadTitle || "-"}
            </p>
            <p className="approval-meta">
              NIP: {report.approverDivisionHeadNip || "-"}
            </p>
          </section>
        </div>
      </section>

      <section className="pdf-report-notes">
        <p className="notes-title">CAT.</p>
        <ol>
          {report.notes.map((note, index) => (
            <li key={`${note}-${index}`}>{note}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}
