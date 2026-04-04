import { useMemo, useState, useEffect, type ReactNode } from "react";
import { buildReporterAnalytics } from "../lib/reporter-analytics";
import type { Report, ReporterDirectoryProfile } from "../types/report";
import { getWitaToday } from "../lib/time";

function StatCard(props: { label: string; value: string; tone: string; subtext?: ReactNode }) {
  return (
    <div className="admin-stats-enter flex flex-col justify-between rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {props.label}
        </p>
        <p className={`mt-2 text-2xl font-bold ${props.tone}`}>{props.value}</p>
      </div>
      {props.subtext ? (
        <div className="mt-3 text-xs text-[var(--text-muted)]">{props.subtext}</div>
      ) : null}
    </div>
  );
}

function ReporterActivityChart(props: {
  allPoints: Array<{ reportDate: string; activityCount: number }>;
}) {
  const [filterMode, setFilterMode] = useState<"week" | "month">("week");
  const [filterMonth, setFilterMonth] = useState(() => {
    const parts = getWitaToday().split("-");
    return Number(parts[1]);
  });
  const [filterYear, setFilterYear] = useState(() => {
    const parts = getWitaToday().split("-");
    return Number(parts[0]);
  });

  const chartData = useMemo(() => {
    let range: string[] = [];
    if (filterMode === "week") {
      const today = getWitaToday();
      const [y, m, d] = today.split("-").map(Number);
      for (let i = 6; i >= 0; i--) {
        const date = new Date(y, m - 1, d - i);
        range.push(
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0",
          )}-${String(date.getDate()).padStart(2, "0")}`,
        );
      }
    } else {
      const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        range.push(
          `${filterYear}-${String(filterMonth).padStart(2, "0")}-${String(
            i,
          ).padStart(2, "0")}`,
        );
      }
    }

    return range.map((date) => {
      const point = props.allPoints.find((p) => p.reportDate === date);
      return {
        reportDate: date,
        activityCount: point?.activityCount ?? 0,
      };
    });
  }, [filterMode, filterMonth, filterYear, props.allPoints]);

  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, chartData.length - 1),
  );

  // Auto-update active index when range changes
  useEffect(() => {
    setActiveIndex(Math.max(0, chartData.length - 1));
  }, [chartData.length]);

  const maxValue = Math.max(
    1,
    ...chartData.map((point) => point.activityCount),
  );

  const activePoint = chartData[activeIndex] ?? chartData[chartData.length - 1];

  return (
    <div className="admin-stats-enter rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4 flex flex-col">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Aktivitas per tanggal laporan
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as "week" | "month")}
              className="field-input min-h-0 w-auto rounded-[12px] px-3 py-1.5 text-xs font-semibold"
            >
              <option value="week">Minggu (7 Hari)</option>
              <option value="month">Bulan</option>
            </select>

            {filterMode === "month" ? (
              <div className="flex items-center gap-1">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(Number(e.target.value))}
                  className="field-input min-h-0 w-auto rounded-[12px] px-2 py-1.5 text-xs font-semibold"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleDateString("id-ID", {
                        month: "short",
                      })}
                    </option>
                  ))}
                </select>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(Number(e.target.value))}
                  className="field-input min-h-0 w-auto rounded-[12px] px-2 py-1.5 text-xs font-semibold"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-[var(--info)] font-semibold">
          {activePoint
            ? `${activePoint.reportDate} | ${activePoint.activityCount} aktivitas`
            : "Silakan pilih bar chart"}
        </p>
      </div>

      <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1 mt-auto">
        {chartData.map((point, index) => {
          const barHeight = Math.max(8, (point.activityCount / maxValue) * 100);
          const isActive = index === activeIndex;

          return (
            <button
              key={point.reportDate}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="flex h-full min-w-[36px] md:min-w-[42px] flex-1 flex-col items-center justify-end gap-2"
              title={`${point.reportDate}: ${point.activityCount} aktivitas`}
            >
              <div
                className={`w-full rounded-t-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--success)]"
                    : point.activityCount > 0
                      ? "bg-[var(--info)] opacity-40 hover:opacity-70"
                      : "bg-[var(--border-strong)] opacity-20 hover:opacity-50"
                }`}
                style={{ height: `${point.activityCount === 0 && !isActive ? 4 : barHeight}%` }}
              />
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                {point.reportDate.slice(5)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminReporterStatsView(props: {
  reporter: ReporterDirectoryProfile;
  reports: Report[];
  loading: boolean;
  onBack: () => void;
}) {
  const analytics = useMemo(
    () => buildReporterAnalytics(props.reporter, props.reports),
    [props.reporter, props.reports],
  );

  if (props.loading) {
    return (
      <div className="grid gap-4">
        <div className="skeleton h-24 rounded-[24px]" />
        <div className="grid gap-3 md:grid-cols-4">
          <div className="skeleton h-28 rounded-[22px]" />
          <div className="skeleton h-28 rounded-[22px]" />
          <div className="skeleton h-28 rounded-[22px]" />
          <div className="skeleton h-28 rounded-[22px]" />
        </div>
        <div className="skeleton h-64 rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="admin-stats-enter surface-card rounded-[24px] p-5">
        <button
          type="button"
          onClick={props.onBack}
          className="btn-secondary px-4 py-2 text-sm"
        >
          Kembali
        </button>
        <h3 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
          {analytics.reporterName}
        </h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Bergabung sejak {analytics.joinedDateLabel} - laporan terakhir{" "}
          {analytics.latestReportDateLabel}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kehadiran"
          value={`${analytics.attendanceRate}%`}
          tone="text-emerald-600"
        />
        <StatCard
          label="Laporan dibuat / tidak"
          value={`${analytics.attendanceDays} / ${analytics.missedDays}`}
          tone="text-[var(--text-primary)]"
          subtext={`Tingkat tidak lapor: ${100 - analytics.attendanceRate}%. Dihitung sejak ${analytics.joinedDateLabel}.`}
        />
        <StatCard
          label="Jumlah laporan"
          value={`${analytics.totalReports}`}
          tone="text-[var(--info)]"
        />
        <StatCard
          label="Jumlah aktivitas"
          value={`${analytics.totalActivities}`}
          tone="text-[var(--warning)]"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <ReporterActivityChart allPoints={analytics.allChartPoints} />
        <div className="admin-stats-enter rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Ringkasan
          </p>
          <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            <p>Rentang hitung: {analytics.totalTrackedDays} hari.</p>
            <p>
              Rata-rata aktivitas per laporan:{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {analytics.avgActivitiesPerReport}
              </span>
            </p>
            <p>
              Bar chart dapat diklik untuk membaca jumlah aktivitas per tanggal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
