import type { Report, ReportActivity } from "../types/report";
import { formatWitaDate } from "./time";

export interface CalendarWeekRange {
  monday: string; // YYYY-MM-DD
  sunday: string; // YYYY-MM-DD
}

export interface CalendarWeekGroup {
  weekKey: string;
  mondayDate: string;
  sundayDate: string;
  earliestReportDate: string;
  latestReportDate: string;
  reports: Report[];
  periodLabel: string;
}

export interface ConsolidatedActivityRow {
  globalIndex: number;
  reportId: string;
  reportDate: string;
  dayDateLabel: string;
  activity: ReportActivity;
}

export interface ConsolidatedDateEntry {
  dateIndex: number;
  reportDate: string;
  dayDateLabel: string;
  activities: {
    reportId: string;
    activity: ReportActivity;
  }[];
}

/**
 * Groups reports by calendar date (YYYY-MM-DD) so that NO and HARI/TANGGAL
 * cells can be merged across multiple activities on the same day.
 */
export function groupReportsToConsolidatedDateEntries(
  reports: Report[],
): ConsolidatedDateEntry[] {
  if (!reports || reports.length === 0) return [];

  const sortedReports = [...reports].sort((a, b) =>
    (a.reportDate || "").localeCompare(b.reportDate || ""),
  );

  const dateMap = new Map<
    string,
    {
      reportDate: string;
      dayDateLabel: string;
      activities: { reportId: string; activity: ReportActivity }[];
    }
  >();

  for (const report of sortedReports) {
    const rDate = report.reportDate || "";
    if (!rDate) continue;

    let entry = dateMap.get(rDate);
    if (!entry) {
      entry = {
        reportDate: rDate,
        dayDateLabel: formatWitaDate(rDate),
        activities: [],
      };
      dateMap.set(rDate, entry);
    }

    const acts = report.activities || [];
    for (const act of acts) {
      entry.activities.push({
        reportId: report.id,
        activity: act,
      });
    }
  }

  let indexCounter = 1;
  return Array.from(dateMap.values())
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
    .map((entry) => ({
      dateIndex: indexCounter++,
      reportDate: entry.reportDate,
      dayDateLabel: entry.dayDateLabel,
      activities: entry.activities,
    }));
}

/**
 * Returns Monday and Sunday (YYYY-MM-DD) for any calendar date.
 * Assumes Monday-Sunday civil calendar week.
 */
export function getCalendarWeekRange(dateInput: string): CalendarWeekRange {
  // Parse date safely without timezone skew
  const parts = dateInput.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);

  // In JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const diffToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const mondayDate = new Date(d);
  mondayDate.setDate(d.getDate() + diffToMonday);

  const sundayDate = new Date(d);
  sundayDate.setDate(d.getDate() + diffToSunday);

  const formatToYmd = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayStr}`;
  };

  return {
    monday: formatToYmd(mondayDate),
    sunday: formatToYmd(sundayDate),
  };
}

/**
 * Groups reports by their calendar week (Monday - Sunday).
 * Groups are returned in chronological order.
 */
export function groupReportsByCalendarWeek(reports: Report[]): CalendarWeekGroup[] {
  if (!reports || reports.length === 0) return [];

  // Sort reports chronologically
  const sortedReports = [...reports].sort((a, b) =>
    (a.reportDate || "").localeCompare(b.reportDate || ""),
  );

  const map = new Map<string, CalendarWeekGroup>();

  for (const report of sortedReports) {
    const dateStr = report.reportDate || "";
    if (!dateStr) continue;

    const { monday, sunday } = getCalendarWeekRange(dateStr);
    const weekKey = `${monday}_${sunday}`;

    let group = map.get(weekKey);
    if (!group) {
      group = {
        weekKey,
        mondayDate: monday,
        sundayDate: sunday,
        earliestReportDate: dateStr,
        latestReportDate: dateStr,
        reports: [],
        periodLabel: "",
      };
      map.set(weekKey, group);
    }

    group.reports.push(report);
    if (dateStr < group.earliestReportDate) {
      group.earliestReportDate = dateStr;
    }
    if (dateStr > group.latestReportDate) {
      group.latestReportDate = dateStr;
    }
  }

  // Finalize labels
  return Array.from(map.values())
    .sort((a, b) => a.mondayDate.localeCompare(b.mondayDate))
    .map((g) => {
      const startFormatted = formatWitaDate(g.mondayDate);
      const endFormatted = formatWitaDate(g.sundayDate);
      return {
        ...g,
        periodLabel: `${startFormatted} s/d ${endFormatted}`,
      };
    });
}

/**
 * Flattens reports and all their activities into unified rows with sequential numbering (1, 2, 3...)
 * and formatted date labels.
 */
export function flattenReportsToConsolidatedRows(
  reports: Report[],
): ConsolidatedActivityRow[] {
  const rows: ConsolidatedActivityRow[] = [];
  let counter = 1;

  const sortedReports = [...reports].sort((a, b) =>
    (a.reportDate || "").localeCompare(b.reportDate || ""),
  );

  for (const report of sortedReports) {
    const formattedDate = formatWitaDate(report.reportDate);
    const activities = report.activities || [];

    for (const act of activities) {
      rows.push({
        globalIndex: counter++,
        reportId: report.id,
        reportDate: report.reportDate,
        dayDateLabel: formattedDate,
        activity: act,
      });
    }
  }

  return rows;
}

export interface MonthCalendarWeek {
  weekNumber: number;
  weekKey: string;
  monday: string;
  sunday: string;
  startDate: string;
  endDate: string;
  label: string;
  rangeLabel: string;
  isCurrentWeek: boolean;
  count?: number;
}

const MONTH_SHORT_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export function getTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns calendar weeks for a specified year-month (YYYY-MM).
 * Identifies the current active calendar week.
 */
export function getMonthCalendarWeeks(
  yearMonth: string,
  todayDateInput?: string,
): MonthCalendarWeek[] {
  const parts = yearMonth.split("-");
  if (parts.length < 2) return [];
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return [];

  const today = todayDateInput || getTodayDateStr();
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  const weeks: MonthCalendarWeek[] = [];
  const seenKeys = new Set<string>();

  for (let day = 1; day <= lastDayOfMonth; day++) {
    const dayStr = String(day).padStart(2, "0");
    const mStr = String(month).padStart(2, "0");
    const dateStr = `${year}-${mStr}-${dayStr}`;

    const { monday, sunday } = getCalendarWeekRange(dateStr);
    const weekKey = `${monday}_${sunday}`;

    if (!seenKeys.has(weekKey)) {
      seenKeys.add(weekKey);

      const mStartStr = `${year}-${mStr}-01`;
      const mEndStr = `${year}-${mStr}-${String(lastDayOfMonth).padStart(2, "0")}`;

      const startDay = monday < mStartStr ? "01" : monday.split("-")[2];
      const endDay = sunday > mEndStr ? String(lastDayOfMonth).padStart(2, "0") : sunday.split("-")[2];

      const isCurrentWeek = today >= monday && today <= sunday;
      const mName = MONTH_SHORT_NAMES[month - 1];
      const rangeLabel = `${parseInt(startDay, 10)} - ${parseInt(endDay, 10)} ${mName}`;

      weeks.push({
        weekNumber: weeks.length + 1,
        weekKey,
        monday,
        sunday,
        startDate: `${year}-${mStr}-${startDay}`,
        endDate: `${year}-${mStr}-${endDay}`,
        label: `Minggu ${weeks.length + 1}`,
        rangeLabel,
        isCurrentWeek,
      });
    }
  }

  return weeks;
}

/**
 * Extracts distinct calendar weeks from an arbitrary set of reports.
 */
export function getCalendarWeeksFromReports(
  reports: Report[],
  todayDateInput?: string,
): MonthCalendarWeek[] {
  const groups = groupReportsByCalendarWeek(reports);
  const today = todayDateInput || getTodayDateStr();

  return groups.map((g, idx) => {
    const isCurrentWeek = today >= g.mondayDate && today <= g.sundayDate;
    return {
      weekNumber: idx + 1,
      weekKey: g.weekKey,
      monday: g.mondayDate,
      sunday: g.sundayDate,
      startDate: g.mondayDate,
      endDate: g.sundayDate,
      label: `Minggu ${idx + 1}`,
      rangeLabel: g.periodLabel,
      isCurrentWeek,
    };
  });
}

