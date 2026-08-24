import { useState, useMemo, useCallback } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Report } from "../types/report";
import { getWitaToday, formatWitaDate } from "../lib/time";
import { isSameReporterName, includesReporterName } from "../lib/reporter-name";
import {
  SYSTEM_START_DATE,
  getEffectiveWorkingDaysInRange,
  getHolidayInfo,
  isWorkDay,
} from "../lib/holidays";

type RekapViewProps = {
  reports: Report[];
  reporterNames: string[];
  loading: boolean;
  onReload: () => Promise<void>;
};

type FilterMode = "harian" | "bulanan" | "tahunan";

/* ── SVG Icon Helpers ── */

function ClockIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[var(--text-muted)] opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SearchIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function InfoIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/* ── Helper: Get calendar weeks for a month ── */

const BULAN_LABELS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function getWeeksInMonth(year: number, month: number): { start: string; end: string; label: string }[] {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: { start: string; end: string; label: string }[] = [];

  let weekStart = new Date(firstDay);
  let weekNum = 1;

  while (weekStart <= lastDay) {
    // End of the week = next Sunday, or end of month (whichever is first)
    const weekEnd = new Date(weekStart);
    const dayOfWeek = weekStart.getDay(); // 0=Sun
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    weekEnd.setDate(weekStart.getDate() + daysUntilSunday);

    const actualEnd = weekEnd > lastDay ? lastDay : weekEnd;

    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    weeks.push({
      start: fmt(weekStart),
      end: fmt(actualEnd),
      label: `Minggu ${weekNum}`,
    });

    weekNum++;
    const nextDay = new Date(actualEnd);
    nextDay.setDate(nextDay.getDate() + 1);
    weekStart = nextDay;
  }

  return weeks;
}

function fmtDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ── Main Component ── */

export function RekapView({ reports, reporterNames }: RekapViewProps) {
  // ── Filter state: Always anchor to official WITA today ──
  const todayWita = getWitaToday();
  const [currentYear, currentMonthNum] = todayWita.split("-").map(Number);
  const currentMonth = currentMonthNum - 1;

  const [filterMode, setFilterMode] = useState<FilterMode>("harian");
  const [searchTerm, setSearchTerm] = useState("");
  const [dailyDate, setDailyDate] = useState(todayWita);
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonth);
  const [monthlyYear, setMonthlyYear] = useState(currentYear);
  const [monthlyWeek, setMonthlyWeek] = useState<number>(-1); // -1 = all weeks
  const [yearlyYear, setYearlyYear] = useState(currentYear);

  const handleAdjustDay = useCallback((amount: number) => {
    const parts = dailyDate.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + amount);
      setDailyDate(fmtDate(d));
    }
  }, [dailyDate]);

  // ── Compute date range from filter ──
  const dateRange = useMemo(() => {
    if (filterMode === "harian") {
      const isToday = dailyDate === todayWita;
      const isBeforeStart = dailyDate < SYSTEM_START_DATE;
      const holidayInfo = getHolidayInfo(dailyDate);
      const isEffectiveWorkDay = !isBeforeStart && isWorkDay(dailyDate);
      return { 
        start: dailyDate, 
        end: dailyDate, 
        totalDays: 1, 
        totalWorkingDays: isEffectiveWorkDay ? 1 : 0,
        label: isToday ? `Hari Ini (${formatWitaDate(dailyDate)})` : formatWitaDate(dailyDate),
        isHoliday: isBeforeStart || holidayInfo.isHoliday,
        holidayName: isBeforeStart ? "Sebelum Operasional Sistem" : holidayInfo.name,
      };
    }
    if (filterMode === "bulanan") {
      const weeks = getWeeksInMonth(monthlyYear, monthlyMonth);
      if (monthlyWeek >= 0 && monthlyWeek < weeks.length) {
        const w = weeks[monthlyWeek];
        const workingStats = getEffectiveWorkingDaysInRange(w.start, w.end);
        return { 
          start: workingStats.effectiveStart, 
          end: workingStats.effectiveEnd, 
          totalDays: workingStats.totalCalendarDays, 
          totalWorkingDays: workingStats.totalWorkingDays,
          label: `${w.label} ${BULAN_LABELS[monthlyMonth]} ${monthlyYear} (${workingStats.totalWorkingDays} hari kerja)` 
        };
      }
      // All weeks = entire month
      const first = new Date(monthlyYear, monthlyMonth, 1);
      const last = new Date(monthlyYear, monthlyMonth + 1, 0);
      const startStr = fmtDate(first);
      const endStr = fmtDate(last);
      const workingStats = getEffectiveWorkingDaysInRange(startStr, endStr);
      return { 
        start: workingStats.effectiveStart, 
        end: workingStats.effectiveEnd, 
        totalDays: workingStats.totalCalendarDays, 
        totalWorkingDays: workingStats.totalWorkingDays,
        label: `${BULAN_LABELS[monthlyMonth]} ${monthlyYear} (${workingStats.totalWorkingDays} hari kerja)` 
      };
    }
    // tahunan = entire year
    const first = new Date(yearlyYear, 0, 1);
    const last = new Date(yearlyYear, 11, 31);
    const startStr = fmtDate(first);
    const endStr = fmtDate(last);
    const workingStats = getEffectiveWorkingDaysInRange(startStr, endStr);
    return { 
      start: workingStats.effectiveStart, 
      end: workingStats.effectiveEnd, 
      totalDays: workingStats.totalCalendarDays, 
      totalWorkingDays: workingStats.totalWorkingDays,
      label: `Tahun ${yearlyYear} (${workingStats.totalWorkingDays} hari kerja)` 
    };
  }, [filterMode, dailyDate, monthlyMonth, monthlyYear, monthlyWeek, yearlyYear, todayWita]);

  const weeksForMonth = useMemo(() => getWeeksInMonth(monthlyYear, monthlyMonth), [monthlyYear, monthlyMonth]);

  // ── Stats computation ──
  const stats = useMemo(() => {
    // 1. Filter reports by dateRange & SYSTEM_START_DATE
    let filteredReports = reports.filter(
      (r) =>
        r.reportDate >= dateRange.start &&
        r.reportDate <= dateRange.end &&
        r.reportDate >= SYSTEM_START_DATE,
    );

    // If bulanan or tahunan, filter out weekends and holidays
    if (filterMode !== "harian") {
      filteredReports = filteredReports.filter((r) => isWorkDay(r.reportDate));
    }

    // 2. Filter reports by searchTerm
    if (searchTerm.trim() !== "") {
      filteredReports = filteredReports.filter((r) =>
        includesReporterName(r.nama, searchTerm),
      );
    }

    const totalReports = filteredReports.length;

    // Filter reporterNames by searchTerm
    const filteredReporterNames = reporterNames.filter((name) =>
      searchTerm.trim() === "" ? true : includesReporterName(name, searchTerm),
    );
    const totalReporters = filteredReporterNames.length;

    // targetDateStr: in Harian mode use dailyDate, in Bulanan/Tahunan mode use todayWita
    const targetDateStr = filterMode === "harian" ? dailyDate : todayWita;
    const isTargetToday = targetDateStr === todayWita;

    // Submitted reports on target date for active reporters
    const submittedOnTargetDate = reports.filter(
      (r) =>
        r.reportDate === targetDateStr &&
        (searchTerm.trim() === "" || includesReporterName(r.nama, searchTerm)) &&
        filteredReporterNames.some((name) => isSameReporterName(r.nama, name)),
    );

    // Unique count of submitting reporters
    const uniqueSubmittingNames = new Set(
      submittedOnTargetDate.map((r) => {
        const match = filteredReporterNames.find((name) =>
          isSameReporterName(r.nama, name),
        );
        return match || r.nama;
      }),
    );

    const submittedCount = uniqueSubmittingNames.size;
    const notSubmittedCount = Math.max(0, totalReporters - submittedCount);

    const complianceRate =
      totalReporters > 0 ? Math.round((submittedCount / totalReporters) * 100) : 0;

    const totalActivities = filteredReports.reduce(
      (acc, curr) => acc + (curr.activities?.length || 0),
      0,
    );
    const trcCount = filteredReports.filter((r) => r.tim === "TRC").length;
    const pusdalopsCount = filteredReports.filter((r) => r.tim === "PUSDALOPS").length;

    const sortedReports = [...reports].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const latestActivities = sortedReports
      .flatMap((r) =>
        (r.activities || []).map((act) => ({
          reporterName: r.nama,
          tim: r.tim,
          tanggal: r.tanggal,
          updatedAt: r.updatedAt,
          activityNo: act.no,
          description: act.description,
          startTime: act.startTime,
          endTime: act.endTime,
        })),
      )
      .slice(0, 5);

    // Member stats filtered by dateRange & searchTerm
    const memberStats = filteredReporterNames
      .map((name) => {
        const memberReports = filteredReports.filter((r) =>
          isSameReporterName(r.nama, name),
        );
        // Only count unique working days submitted starting from system epoch (2026-08-19)
        const uniqueWorkingDays = new Set(
          memberReports
            .map((r) => r.reportDate)
            .filter((d) => isWorkDay(d) && d >= SYSTEM_START_DATE),
        ).size;
        const memberActivities = memberReports.reduce(
          (acc, r) => acc + (r.activities?.length || 0),
          0,
        );
        const effectiveEnd = dateRange.end < todayWita ? dateRange.end : todayWita;
        const expectedStats = getEffectiveWorkingDaysInRange(dateRange.start, effectiveEnd);
        const targetDays = expectedStats.totalWorkingDays;
        const pct =
          targetDays > 0
            ? Math.min(100, Math.round((uniqueWorkingDays / targetDays) * 100))
            : 0;

        return {
          name,
          totalReports: memberReports.length,
          percentage: pct,
          totalActivities: memberActivities,
        };
      })
      .sort((a, b) => {
        if (b.totalReports !== a.totalReports) {
          return b.totalReports - a.totalReports;
        }
        return a.name.localeCompare(b.name);
      });

    return {
      totalReports,
      totalReporters,
      submittedTodayCount: submittedCount,
      notSubmittedCount,
      complianceRate,
      totalActivities,
      trcCount,
      pusdalopsCount,
      latestActivities,
      memberStats,
      targetDateStr,
      isTargetToday,
    };
  }, [reports, reporterNames, dateRange, searchTerm, filterMode, dailyDate, todayWita]);

  const totalCount = stats.trcCount + stats.pusdalopsCount;
  const hasData = totalCount > 0;
  const trcPercent = hasData ? Math.round((stats.trcCount / totalCount) * 100) : 0;
  const pusdalopsPercent = hasData ? 100 - trcPercent : 0;

  const complianceData = [
    { name: "Sudah Mengisi", value: stats.submittedTodayCount, color: "var(--success)" },
    { name: "Belum Mengisi", value: stats.notSubmittedCount, color: "var(--danger)" }
  ];

  const distributionData = hasData
    ? [
        { name: "TRC", value: stats.trcCount, color: "var(--info)" },
        { name: "PUSDALOPS", value: stats.pusdalopsCount, color: "var(--success)" }
      ]
    : [
        { name: "Belum Ada", value: 1, color: "var(--border-soft)" }
      ];

  const metricItems = [
    {
      label: "Petugas",
      value: stats.totalReporters,
      icon: <UsersIcon />,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      label: "Total Laporan",
      value: stats.totalReports,
      icon: <FileTextIcon />,
      color: "text-[var(--info)]",
      bg: "bg-[var(--info-soft)]",
    },
    {
      label: "Terisi",
      value: `${stats.complianceRate}%`,
      sub: `${stats.submittedTodayCount}/${stats.totalReporters} ${
        filterMode === "harian"
          ? stats.isTargetToday
            ? "petugas hari ini"
            : "petugas terisi"
          : "petugas hari ini"
      }`,
      icon: <ShieldCheckIcon />,
      color: "text-[var(--success)]",
      bg: "bg-[var(--success-soft)]",
    },
    {
      label: "Aktivitas",
      value: stats.totalActivities,
      icon: <ZapIcon />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  const filterModes: { key: FilterMode; label: string }[] = [
    { key: "harian", label: "Harian" },
    { key: "bulanan", label: "Bulanan" },
    { key: "tahunan", label: "Tahunan" },
  ];

  // Year range for selectors - Only 2026 onwards
  const years = Array.from(
    { length: Math.max(3, currentYear - 2026 + 2) },
    (_, i) => 2026 + i,
  );

  return (
    <section className="space-y-5 animate-fadeIn">

      {/* ── Stat Strip ── */}
      <div className="panel-glass rounded-2xl p-1">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metricItems.map((m, i) => (
            <div
              key={m.label}
              className={`flex items-center gap-3 px-4 py-3 ${
                i < metricItems.length - 1 ? "lg:border-r border-[var(--border-soft)]/50" : ""
              } ${i < 2 ? "border-b lg:border-b-0 border-[var(--border-soft)]/50" : ""}`}
            >
              <div className={`h-9 w-9 rounded-xl ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
                {m.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-none">{m.label}</p>
                <p className="text-xl font-extrabold text-[var(--text-primary)] leading-tight mt-0.5">{m.value}</p>
                {m.sub && <p className="text-[10px] text-[var(--text-muted)] leading-none mt-0.5">{m.sub} petugas hari ini</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content Grid: Charts + Member Table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Charts Card */}
        <div className="lg:col-span-2 panel-glass rounded-2xl p-4 flex flex-col shadow-sm min-h-[420px]">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {filterMode === "harian" ? "Status & Distribusi" : "Distribusi Laporan"}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {filterMode === "harian"
                ? "Rasio kepatuhan pengisian dan pembagian tim."
                : "Pembagian laporan berdasarkan tim."}
            </p>
          </div>

          <div className="flex flex-row items-center flex-1 min-h-0 my-2 w-full gap-2">
            {/* Chart Distribusi Tim (selalu tampil) */}
            <div
              className="h-full relative transition-all duration-500 ease-in-out"
              style={{ flex: filterMode === "harian" ? "1 1 0%" : "1 1 100%", maxWidth: filterMode === "harian" ? "50%" : "200px", margin: filterMode === "harian" ? "0" : "0 auto" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie data={distributionData} cx="50%" cy="50%" innerRadius="65%" outerRadius="98%" paddingAngle={hasData ? 5 : 0} dataKey="value" isAnimationActive={true} strokeWidth={0}>
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {hasData && (
                    <Tooltip
                      wrapperStyle={{ zIndex: 50 }}
                      contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-soft)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "11px", fontWeight: 600, boxShadow: "0 8px 20px -4px rgba(0,0,0,0.1)", padding: "6px 10px" }}
                      itemStyle={{ color: "var(--text-primary)" }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] leading-none">{totalCount}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Laporan</span>
              </div>
            </div>

            {/* Chart Kepatuhan (animasi masuk/keluar) */}
            <div
              className="h-full relative overflow-hidden transition-all duration-500 ease-in-out border-l border-[var(--border-soft)]/20"
              style={{
                flex: filterMode === "harian" ? "1 1 0%" : "0 0 0%",
                maxWidth: filterMode === "harian" ? "50%" : "0px",
                opacity: filterMode === "harian" ? 1 : 0,
                paddingLeft: filterMode === "harian" ? "8px" : "0px",
                borderColor: filterMode === "harian" ? undefined : "transparent",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie data={complianceData} cx="50%" cy="50%" innerRadius="65%" outerRadius="98%" paddingAngle={5} dataKey="value" isAnimationActive={true} strokeWidth={0}>
                    {complianceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 50 }}
                    contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-soft)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "11px", fontWeight: 600, boxShadow: "0 8px 20px -4px rgba(0,0,0,0.1)", padding: "6px 10px" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] leading-none">{stats.complianceRate}%</span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Terisi</span>
              </div>
            </div>
          </div>

          {/* Legends - stacked by category */}
          <div className="pt-2.5 border-t border-[var(--border-soft)]/20 mt-auto space-y-2">
            {/* Distribusi legends (selalu tampil) */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Distribusi Tim</span>
              {[
                { label: "TRC", count: stats.trcCount, pct: trcPercent, color: "bg-[var(--info)]" },
                { label: "PUSDALOPS", count: stats.pusdalopsCount, pct: pusdalopsPercent, color: "bg-[var(--success)]" },
              ].map(leg => (
                <div key={leg.label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${leg.color} shrink-0`} />
                  <span className="text-[10px] font-semibold text-[var(--text-primary)] flex-1 truncate">{leg.label}</span>
                  <span className="text-[10px] tabular-nums font-bold text-[var(--text-muted)] shrink-0">{leg.count}</span>
                  <span className="text-[9px] tabular-nums font-semibold text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-md px-1 py-0.5 min-w-[32px] text-center shrink-0">{leg.pct}%</span>
                </div>
              ))}
            </div>

            {/* Kepatuhan legends (animasi masuk/keluar) */}
            <div
              className="space-y-1 overflow-hidden transition-all duration-500 ease-in-out"
              style={{
                maxHeight: filterMode === "harian" ? "80px" : "0px",
                opacity: filterMode === "harian" ? 1 : 0,
                marginTop: filterMode === "harian" ? "8px" : "0px",
              }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {filterMode === "harian"
                  ? stats.isTargetToday
                    ? "Kepatuhan Hari Ini"
                    : `Kepatuhan (${dailyDate})`
                  : "Kepatuhan Hari Ini"}
              </span>
              {[
                { label: "Sudah Mengisi", count: stats.submittedTodayCount, pct: stats.complianceRate, color: "bg-[var(--success)]" },
                { label: "Belum Mengisi", count: stats.notSubmittedCount, pct: 100 - stats.complianceRate, color: "bg-[var(--danger)]" },
              ].map(leg => (
                <div key={leg.label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${leg.color} shrink-0`} />
                  <span className="text-[10px] font-semibold text-[var(--text-primary)] flex-1 truncate">{leg.label}</span>
                  <span className="text-[10px] tabular-nums font-bold text-[var(--text-muted)] shrink-0">{leg.count}</span>
                  <span className="text-[9px] tabular-nums font-semibold text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-md px-1 py-0.5 min-w-[32px] text-center shrink-0">{leg.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Member Table with Filters */}
        <div className="lg:col-span-3 panel-glass rounded-2xl p-5 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Statistik Anggota</h3>
              <div
                tabIndex={0}
                className="ui-tooltip-group relative inline-flex items-center text-[var(--text-muted)] hover:text-[var(--info)] focus:outline-none cursor-pointer"
              >
                <InfoIcon className="h-3.5 w-3.5" />
                <div className="ui-tooltip ui-tooltip-right min-w-[240px] text-left">
                  <span>
                    Perhitungan konsistensi & hari kerja efektif dimulai sejak tanggal <strong>19 Agustus 2026</strong> (hari libur & kalender sebelum tanggal tersebut dikecualikan).
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-[var(--text-muted)] text-right truncate">
              Periode: <span className="font-bold text-[var(--text-primary)]">{dateRange.label}</span>
            </span>
          </div>

          {/* ── Filter Controls in a Single Row ── */}
          <div className="mt-3 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Search Input - Mengisi sisa ruang */}
              <div className="relative flex-1 min-w-[120px]">
                <input
                  type="text"
                  placeholder="Cari nama..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-lg pl-8 pr-2.5 py-1.5 outline-none focus:border-[var(--field-border-focus)] transition"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                  <SearchIcon className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Mode Selector Combobox - Lebar Ideal */}
              <select
                value={filterMode}
                onChange={e => {
                  const val = e.target.value as FilterMode;
                  setFilterMode(val);
                  if (val === "bulanan") setMonthlyWeek(-1);
                }}
                className="w-full sm:w-24 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] border border-[var(--border-soft)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--field-border-focus)] transition cursor-pointer shrink-0"
              >
                {filterModes.map(fm => (
                  <option key={fm.key} value={fm.key}>
                    {fm.label}
                  </option>
                ))}
              </select>

              {/* Harian: Datepicker - Lebar Ideal */}
              {filterMode === "harian" && (
                <div className="shrink-0 w-full sm:w-auto flex items-center justify-between gap-1 bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-lg px-2 py-0.5">
                  <button type="button" onClick={() => handleAdjustDay(-1)} className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition shrink-0" title="Hari Sebelumnya">
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1.5 px-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                    <input
                      type="date"
                      value={dailyDate}
                      onChange={(e) => setDailyDate(e.target.value)}
                      className="bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] cursor-pointer focus:ring-0 p-0 w-[115px] font-semibold"
                    />
                  </div>
                  <button type="button" onClick={() => handleAdjustDay(1)} className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition shrink-0" title="Hari Berikutnya">
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                  {dailyDate !== todayWita && (
                    <button
                      type="button"
                      onClick={() => setDailyDate(todayWita)}
                      className="text-[10px] font-bold text-[var(--primary)] hover:underline ml-1 px-1.5 py-0.5 rounded bg-[var(--primary)]/10 shrink-0"
                      title="Kembali ke Hari Ini"
                    >
                      Hari ini
                    </button>
                  )}
                </div>
              )}

              {/* Bulanan: Month + Week + Year selector in one row - Lebar Ideal */}
              {filterMode === "bulanan" && (
                <div className="shrink-0 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <select
                    value={monthlyMonth}
                    onChange={e => { setMonthlyMonth(Number(e.target.value)); setMonthlyWeek(-1); }}
                    className="w-full sm:w-28 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--field-border-focus)] transition cursor-pointer shrink-0"
                  >
                    {BULAN_LABELS.map((b, i) => <option key={i} value={i}>{b}</option>)}
                  </select>
                  <select
                    value={monthlyWeek}
                    onChange={e => setMonthlyWeek(Number(e.target.value))}
                    className="w-full sm:w-28 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--field-border-focus)] transition cursor-pointer shrink-0"
                  >
                    <option value={-1}>Semua</option>
                    {weeksForMonth.map((w, i) => (
                      <option key={i} value={i}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={monthlyYear}
                    onChange={e => { setMonthlyYear(Number(e.target.value)); setMonthlyWeek(-1); }}
                    className="w-full sm:w-20 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--field-border-focus)] transition cursor-pointer shrink-0"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {/* Tahunan: Year selector - Lebar Ideal */}
              {filterMode === "tahunan" && (
                <select
                  value={yearlyYear}
                  onChange={e => setYearlyYear(Number(e.target.value))}
                  className="w-full sm:w-20 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-panel-strong)] border border-[var(--border-soft)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--field-border-focus)] transition cursor-pointer shrink-0"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* ── Table ── */}
          <div className="mt-3 flex-1 overflow-y-auto max-h-[280px] custom-scrollbar -mx-1 px-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[var(--surface-panel-strong)]">
                  <th className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-3 rounded-l-lg">Nama</th>
                  {filterMode === "harian" ? (
                    <th className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2 text-center rounded-r-lg">Status</th>
                  ) : (
                    <>
                      <th className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2 text-center">Laporan</th>
                      <th className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2 text-center">Konsistensi</th>
                      <th className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2 text-center rounded-r-lg">Aktivitas</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {stats.memberStats.length > 0 ? (
                  stats.memberStats.map((member, idx) => (
                    <tr
                      key={member.name}
                      className={`border-b border-[var(--border-soft)]/30 hover:bg-[var(--surface-muted)]/40 transition-colors ${
                        idx === stats.memberStats.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[var(--surface-accent)] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-[var(--text-muted)]">
                              {member.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{member.name}</span>
                        </div>
                      </td>
                      {filterMode === "harian" ? (
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            member.totalReports > 0
                              ? "bg-[var(--success)]/15 text-[var(--success)]"
                              : "bg-[var(--danger)]/15 text-[var(--danger)]"
                          }`}>
                            {member.totalReports > 0 ? "Sudah" : "Belum"}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="py-2.5 px-2 text-center">
                            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{member.totalReports}</span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(member.percentage, 100)}%`,
                                    backgroundColor: member.percentage >= 80 ? "var(--success)" : member.percentage >= 50 ? "var(--warning)" : "var(--danger)",
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold tabular-nums text-[var(--text-muted)] min-w-[28px]">{member.percentage}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{member.totalActivities}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={filterMode === "harian" ? 2 : 4} className="py-10 text-center text-xs text-[var(--text-muted)]">
                      Tidak ada data untuk periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Activity Feed (full width, below) ── */}
      <div className="panel-glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Aktivitas Terbaru</h3>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--danger)] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--danger)]" />
            </span>
          </div>
          <span className="text-[10px] font-medium text-[var(--text-muted)]">{stats.latestActivities.length} kegiatan</span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {stats.latestActivities.length > 0 ? (
            stats.latestActivities.map((act, index) => (
              <div
                key={index}
                className="rounded-xl border border-[var(--border-soft)]/50 bg-[var(--surface-panel-strong)]/40 p-3 hover:bg-[var(--surface-muted)]/50 transition-colors duration-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-[8px] font-extrabold uppercase border ${
                    act.tim === "TRC"
                      ? "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/15"
                      : "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/15"
                  }`}>
                    {act.tim === "TRC" ? "TRC" : "PD"}
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{act.reporterName}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug line-clamp-2 min-h-[30px]">
                  {act.description}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-soft)]/30">
                  <div className="flex items-center gap-1 text-[var(--text-soft)]">
                    <ClockIcon className="h-2.5 w-2.5" />
                    <span className="text-[9px] font-semibold tabular-nums">{act.startTime} – {act.endTime}</span>
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] tabular-nums">{act.tanggal}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-14 text-center">
              <InboxIcon />
              <p className="mt-3 text-xs text-[var(--text-muted)] font-medium">Belum ada aktivitas tercatat.</p>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
