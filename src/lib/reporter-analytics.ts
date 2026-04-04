import type { Report, ReporterDirectoryProfile } from "../types/report";
import { getWitaToday } from "./time";

export type ReporterStatsPoint = {
  reportDate: string;
  activityCount: number;
};

export type ReporterAnalytics = {
  reporterName: string;
  joinedDateLabel: string;
  totalTrackedDays: number;
  attendanceDays: number;
  missedDays: number;
  attendanceRate: number;
  totalReports: number;
  totalActivities: number;
  avgActivitiesPerReport: number;
  latestReportDateLabel: string;
  chartPoints: ReporterStatsPoint[];
  allChartPoints: ReporterStatsPoint[];
};

const MAX_CHART_POINTS = 14;

function toDateOnly(value: string | null) {
  return value?.slice(0, 10) || getWitaToday();
}

function toReadableDateLabel(value: string | null) {
  const dateOnly = toDateOnly(value);
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
}

function countTrackedDays(fromDate: string, toDate: string) {
  const fromTime = new Date(`${fromDate}T00:00:00`).getTime();
  const toTime = new Date(`${toDate}T00:00:00`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime) {
    return 1;
  }

  return Math.max(1, Math.floor((toTime - fromTime) / dayMs) + 1);
}

export function buildReporterAnalytics(
  reporter: ReporterDirectoryProfile,
  reports: Report[],
): ReporterAnalytics {
  const normalizedReporterName = reporter.fullName.trim().toLowerCase();
  const reporterReports = reports
    .filter(
      (report) =>
        report.nama.trim().toLowerCase() === normalizedReporterName,
    )
    .slice()
    .sort((left, right) => left.reportDate.localeCompare(right.reportDate));

  const uniqueReportDates = new Set(
    reporterReports.map((report) => report.reportDate),
  );
  const joinedDate = toDateOnly(
    reporter.firstReportedAt ?? reporterReports[0]?.reportDate ?? null,
  );
  const trackedDays = countTrackedDays(joinedDate, getWitaToday());
  const attendanceDays = uniqueReportDates.size;
  const missedDays = Math.max(0, trackedDays - attendanceDays);
  const totalActivities = reporterReports.reduce(
    (sum, report) => sum + report.activities.length,
    0,
  );

  return {
    reporterName: reporter.fullName,
    joinedDateLabel: toReadableDateLabel(joinedDate),
    totalTrackedDays: trackedDays,
    attendanceDays,
    missedDays,
    attendanceRate: Math.round((attendanceDays / trackedDays) * 100),
    totalReports: reporterReports.length,
    totalActivities,
    avgActivitiesPerReport:
      reporterReports.length === 0
        ? 0
        : Number((totalActivities / reporterReports.length).toFixed(1)),
    latestReportDateLabel: reporterReports[reporterReports.length - 1]?.tanggal ?? "-",
    chartPoints: reporterReports
      .slice(-MAX_CHART_POINTS)
      .map((report) => ({
        reportDate: report.reportDate,
        activityCount: report.activities.length,
      })),
    allChartPoints: reporterReports.map((report) => ({
      reportDate: report.reportDate,
      activityCount: report.activities.length,
    })),
  };
}
