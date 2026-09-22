import type { Report } from "../types/report";
import { supabase } from "../lib/supabase";
import { getCachedSignatureDataUrl } from "../lib/storage";
import { groupReportsToConsolidatedDateEntries } from "../lib/calendar-week-utils";

export interface ReportConsolidatedPdfDocumentProps {
  titlePeriod?: string;
  reporterName: string;
  teamName?: string;
  headerLines?: string[];
  reports: Report[];
  approverCoordinator?: string;
  approverCoordinatorNip?: string;
  approverCoordinatorLabel?: string;
  approverCoordinatorSignatureUrl?: string;
  approverDivisionHead?: string;
  approverDivisionHeadTitle?: string;
  approverDivisionHeadNip?: string;
  approverDivisionHeadSignatureUrl?: string;
  notes?: string[];
}

export function ReportConsolidatedPdfDocument(
  props: ReportConsolidatedPdfDocumentProps,
) {
  const {
    reporterName,
    headerLines,
    reports,
    approverCoordinator,
    approverCoordinatorNip,
    approverCoordinatorLabel,
    approverCoordinatorSignatureUrl,
    approverDivisionHead,
    approverDivisionHeadTitle,
    approverDivisionHeadNip,
    approverDivisionHeadSignatureUrl,
  } = props;

  const coordinatorSignature =
    getCachedSignatureDataUrl(approverCoordinatorSignatureUrl) ||
    approverCoordinatorSignatureUrl;

  const divisionHeadSignature =
    getCachedSignatureDataUrl(approverDivisionHeadSignatureUrl) ||
    approverDivisionHeadSignatureUrl;

  const activeHeaders =
    headerLines && headerLines.length > 0
      ? headerLines
      : [
          "LAPORAN KINERJA TIM REAKSI CEPAT",
          "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
          "TAHUN ANGGARAN 2026",
        ];

  const dateEntries = groupReportsToConsolidatedDateEntries(reports);

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
              <td>{reporterName || "-"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pdf-report-main-table">
        <table>
          <thead>
            <tr>
              <th className="col-consolidated-no">NO</th>
              <th className="col-consolidated-date">HARI/TANGGAL</th>
              <th className="col-consolidated-detail">DETAIL AKTIVITAS YANG DILAKSANAKAN</th>
              <th className="col-consolidated-time">WAKTU PELAKSANAAN</th>
              <th className="col-consolidated-proof">BUKTI DOKUMENTASI</th>
            </tr>
          </thead>
          {dateEntries.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={5} className="empty-table-cell" style={{ textAlign: "center", padding: "14px" }}>
                  Tidak ada data aktivitas untuk periode ini.
                </td>
              </tr>
            </tbody>
          ) : (
            dateEntries.map((dateEntry) => {
              const totalActs = dateEntry.activities.length;
              if (totalActs === 0) {
                return (
                  <tbody key={dateEntry.reportDate} className="date-group-tbody">
                    <tr>
                      <td className="no-cell">{dateEntry.dateIndex}</td>
                      <td className="date-cell">{dateEntry.dayDateLabel}</td>
                      <td className="detail-cell">-</td>
                      <td className="time-cell">-</td>
                      <td className="proof-cell">-</td>
                    </tr>
                  </tbody>
                );
              }

              return (
                <tbody key={dateEntry.reportDate} className="date-group-tbody">
                  {dateEntry.activities.map((item, actIdx) => {
                    const isFirst = actIdx === 0;
                    const { reportId, activity } = item;

                    return (
                      <tr key={`${reportId}_${activity.id || activity.no}_${dateEntry.reportDate}_${actIdx}`}>
                        {isFirst && (
                          <>
                            <td rowSpan={totalActs} className="no-cell">
                              {dateEntry.dateIndex}
                            </td>
                            <td rowSpan={totalActs} className="date-cell">
                              {dateEntry.dayDateLabel}
                            </td>
                          </>
                        )}
                        <td className="detail-cell">{activity.description?.trim() || "-"}</td>
                        <td className="time-cell">
                          {activity.startTime} - {activity.endTime} WITA
                        </td>
                        <td className="proof-cell">
                          {activity.photos && activity.photos.length > 0 ? (
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
                                  try {
                                    const { data } = supabase.storage
                                      .from("daily-report-proofs")
                                      .getPublicUrl(photo.storagePath);
                                    if (data?.publicUrl) {
                                      photoUrl = data.publicUrl;
                                    }
                                  } catch {}
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
                                        try {
                                          const { data } = supabase.storage
                                            .from("daily-report-proofs")
                                            .getPublicUrl(photo.storagePath);
                                          if (data?.publicUrl && e.currentTarget.src !== data.publicUrl) {
                                            e.currentTarget.src = data.publicUrl;
                                          }
                                        } catch {}
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
                    );
                  })}
                </tbody>
              );
            })
          )}
        </table>
      </section>

      {/* Tanda Tangan di bagian paling bawah tabel */}
      <section className="pdf-report-approval">
        <p className="approval-title">PERSETUJUAN</p>
        <div className="approval-grid">
          <section className="approval-column">
            <p className="approval-role">
              {approverCoordinatorLabel || "KOORDINATOR TIM"}
            </p>
            <div className="signature-space">
              {coordinatorSignature ? (
                <img
                  src={coordinatorSignature}
                  alt={`TTD ${approverCoordinator || "Koordinator"}`}
                  className="approval-signature-img"
                  loading="eager"
                />
              ) : null}
            </div>
            <p className="approval-name">{approverCoordinator || "-"}</p>
            <p className="approval-meta">
              NIP: {approverCoordinatorNip || "-"}
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
                  alt={`TTD ${approverDivisionHead || "Kabid"}`}
                  className="approval-signature-img"
                  loading="eager"
                />
              ) : null}
            </div>
            <p className="approval-name">
              {approverDivisionHead || "-"}
            </p>
            <p className="approval-meta">
              Pangkat: {approverDivisionHeadTitle || "-"}
            </p>
            <p className="approval-meta">
              NIP: {approverDivisionHeadNip || "-"}
            </p>
          </section>
        </div>
      </section>
    </article>
  );
}
