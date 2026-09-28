import type { Report } from "../types/report";
import { supabase } from "../lib/supabase";
import { getCachedSignatureDataUrl } from "../lib/storage";
import {
  JAN_MAR_PUSDALOPS_COORDINATOR,
  isJanToMarPeriod,
  isPusdalopsTeam,
} from "../lib/report-template-defaults";

export function ReportPdfDocument(props: { report: Report; headerLines?: string[] }) {
  const { report } = props;
  const isPusdalops = isPusdalopsTeam(report.tim);
  const isJanMar = isJanToMarPeriod(report.reportDate || report.tanggal);
  const useJanMarPusdalops = isPusdalops && isJanMar;

  const coordinatorName = useJanMarPusdalops
    ? JAN_MAR_PUSDALOPS_COORDINATOR.officialName
    : (report.approverCoordinator || "-");
  const coordinatorNip = useJanMarPusdalops
    ? JAN_MAR_PUSDALOPS_COORDINATOR.officialNip
    : (report.approverCoordinatorNip || "-");
  const coordinatorLabel = useJanMarPusdalops
    ? JAN_MAR_PUSDALOPS_COORDINATOR.scopeLabel
    : (report.approverCoordinatorLabel || "KOORDINATOR TIM");

  const coordinatorSignature =
    getCachedSignatureDataUrl(report.approverCoordinatorSignatureUrl) ||
    report.approverCoordinatorSignatureUrl;
  const divisionHeadSignature =
    getCachedSignatureDataUrl(report.approverDivisionHeadSignatureUrl) ||
    report.approverDivisionHeadSignatureUrl;

  const activeHeaders =
    props.headerLines && props.headerLines.length > 0
      ? props.headerLines
      : report.headerLines && report.headerLines.length > 0
      ? report.headerLines
      : [
          "LAPORAN HARIAN KINERJA TIM REAKSI CEPAT",
          "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
          "TAHUN ANGGARAN 2026",
        ];

  return (
    <article className="pdf-report-page">
      <header className="pdf-report-header">
        {activeHeaders.map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
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
            {report.activities.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-table-cell" style={{ textAlign: "center", padding: "14px" }}>
                  Tidak ada data aktivitas.
                </td>
              </tr>
            ) : (
              report.activities.map((activity) => (
              <tr key={activity.id || activity.no}>
                <td className="no-cell">{activity.no}</td>
                <td className="detail-cell">{activity.description?.trim() || "-"}</td>
                <td className="time-cell">
                  {activity.startTime} - {activity.endTime} WITA
                </td>
                <td className="proof-cell">
                  {activity.photos.length > 0 ? (
                    <div className="proof-images-container">
                      {activity.photos.map((photo) => {
                        let photoUrl = photo.publicUrl;
                        if (
                          (!photoUrl ||
                            photoUrl.trim() === "" ||
                            photoUrl.includes("undefined")) &&
                          photo.storagePath &&
                          supabase
                        ) {
                          const { data } = supabase.storage
                            .from("daily-report-proofs")
                            .getPublicUrl(photo.storagePath);
                          photoUrl = data?.publicUrl || "";
                        }
                        return (
                          <img
                            key={photo.id || photo.storagePath || photoUrl}
                            src={photoUrl}
                            alt={photo.originalFileName || "Bukti aktivitas"}
                            className="proof-image"
                            loading="eager"
                            decoding="sync"
                            {...{ fetchpriority: "high" }}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (photo.storagePath && supabase) {
                                const { data } = supabase.storage
                                  .from("daily-report-proofs")
                                  .getPublicUrl(photo.storagePath);
                                if (data?.publicUrl && e.currentTarget.src !== data.publicUrl) {
                                  e.currentTarget.src = data.publicUrl;
                                }
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </section>

      <section className="pdf-report-approval">
        <p className="approval-title">PERSETUJUAN</p>
        <div className="approval-grid">
          <section className="approval-column">
            <p className="approval-role">{coordinatorLabel}</p>
            <div className="signature-space">
              {coordinatorSignature ? (
                <img
                  src={coordinatorSignature}
                  alt={`TTD ${coordinatorName}`}
                  className="approval-signature-img"
                  loading="eager"
                />
              ) : null}
            </div>
            <p className="approval-name">{coordinatorName}</p>
            <p className="approval-meta">
              NIP: {coordinatorNip}
            </p>
          </section>

          <section className="approval-column">
            <p className="approval-role">
              KEPALA BIDANG KEDARURATAN &amp; LOGISTIK
            </p>
            <div className="signature-space">
              {divisionHeadSignature ? (
                <img
                  src={divisionHeadSignature}
                  alt={`TTD ${report.approverDivisionHead}`}
                  className="approval-signature-img"
                  loading="eager"
                />
              ) : null}
            </div>
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
