import { useEffect, useState } from "react";
import { adminGetReporterPasswords } from "../../lib/report-service";
import { formatWitaDateTime } from "../../lib/time";
import { AdminEditableListCard } from "../admin-editable-list-card";
import { AdminReporterStatsView } from "../admin-reporter-stats-view";
import {
  AdminReporterToolbar,
  type ReporterSortMode,
} from "../admin-reporter-toolbar";

import { ClearableTextInput } from "./shared";
import type { AdminDashboardViewProps } from "./types";

export function ReporterManagementPanel(props: AdminDashboardViewProps) {
  const [reporterSearch, setReporterSearch] = useState("");
  const [reporterSortMode, setReporterSortMode] = useState<ReporterSortMode>("name-asc");
  const [editingReporterId, setEditingReporterId] = useState<string | null>(
    null,
  );
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    adminGetReporterPasswords()
      .then((data) => {
        if (!alive) return;
        setPasswords(data);
      })
      .catch((err) => {
        console.error("Gagal memuat password user:", err);
      });
    return () => {
      alive = false;
    };
  }, [props.reporterProfiles]);

  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(
    null,
  );

  const selectedReporter =
    props.reporterProfiles.find(
      (reporter) => reporter.id === selectedReporterId,
    ) ?? null;

  const visibleReporters = props.reporterProfiles
    .filter((reporter) =>
      reporter.fullName
        .toLowerCase()
        .includes(reporterSearch.trim().toLowerCase()),
    )
    .slice()
    .sort((left, right) => {
      if (reporterSortMode === "name-desc") {
        return right.fullName.localeCompare(left.fullName);
      }

      if (reporterSortMode === "join-time") {
        return (right.firstReportedAt ?? "").localeCompare(
          left.firstReportedAt ?? "",
        );
      }

      return left.fullName.localeCompare(right.fullName);
    });

  if (selectedReporter) {
    return (
      <AdminReporterStatsView
        reporter={selectedReporter}
        reports={props.reports}
        loading={props.loading}
        onBack={() => setSelectedReporterId(null)}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="settings-list-toolbar">
        <span className="settings-hint">{visibleReporters.length} dari {props.reporterProfiles.length} pengguna</span>
        <AdminReporterToolbar searchValue={reporterSearch} onSearchChange={setReporterSearch} sortMode={reporterSortMode} onSortModeChange={setReporterSortMode} disabled={props.adminSubmitting} />
      </div>

      {visibleReporters.length === 0 ? (
        <div className="surface-card rounded-[24px] p-5 text-sm text-[var(--text-muted)]">
          {reporterSearch.trim() ? "Tidak ada pengguna yang sesuai dengan pencarian." : "Belum ada pengguna yang terdaftar."}
        </div>
      ) : null}

      {visibleReporters.map((reporter) => {
        const isEditing = editingReporterId === reporter.id;

        return (
          <AdminEditableListCard
            key={reporter.id}
            title={
              isEditing ? (
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Edit pengguna publik
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedReporterId(reporter.id)}
                  className="truncate text-left text-base font-semibold text-[var(--text-primary)] transition hover:text-[var(--primary)]"
                >
                  {reporter.fullName}
                </button>
              )
            }
            meta={
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{reporter.totalReports} laporan</span>
                {reporter.firstReportedAt ? (
                  <span>
                    Awal: {formatWitaDateTime(reporter.firstReportedAt)}
                  </span>
                ) : null}
                {reporter.lastReportedAt ? (
                  <span>
                    Terakhir: {formatWitaDateTime(reporter.lastReportedAt)}
                  </span>
                ) : null}
              </div>
            }
            isEditing={isEditing}
            editContent={
              <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
                <ClearableTextInput
                  label="Nama pengguna publik"
                  value={
                    props.adminReporterDraftNames[reporter.id] ??
                    reporter.fullName
                  }
                  onChange={(value) =>
                    props.onChangeAdminReporterDraftName(reporter.id, value)
                  }
                  onClear={() =>
                    props.onChangeAdminReporterDraftName(reporter.id, "")
                  }
                />
                <ClearableTextInput
                  label="Password Pengguna"
                  value={passwords[reporter.id] ?? "123123123"}
                  onChange={(value) => {
                    setPasswords((prev) => ({ ...prev, [reporter.id]: value }));
                  }}
                />
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] px-4 py-3 text-xs text-[var(--text-muted)] md:col-span-2">
                  <p>
                    Data relasional laporan ikut memakai nama terbaru saat
                    disimpan. Password default adalah '123123123'.
                  </p>
                </div>
              </div>
            }
            disableActions={props.adminSubmitting}
            saveLoading={
              props.adminActiveAction === "rename-reporter" &&
              props.adminActiveItemId === reporter.id
            }
            deleteLoading={
              props.adminActiveAction === "delete-reporter" &&
              props.adminActiveItemId === reporter.id
            }
            saveLoadingLabel="mengubah profil"
            deleteLoadingLabel="menghapus jejak pengguna"
            onStartEdit={() => setEditingReporterId(reporter.id)}
            onCancelEdit={() => {
              props.onChangeAdminReporterDraftName(
                reporter.id,
                reporter.fullName,
              );
              setEditingReporterId(null);
            }}
            onSaveEdit={() => {
              void props
                .onHandleRenameReporterProfile(reporter, passwords[reporter.id])
                .then(() => setEditingReporterId(null));
            }}
            onDelete={() => void props.onHandleDeleteReporterTrace(reporter)}
            deleteLabel="Hapus jejak"
          />
        );
      })}
    </div>
  );
}

