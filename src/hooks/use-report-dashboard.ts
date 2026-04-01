import { useEffect, useMemo, useState } from "react";
import { askConfirmation, showError, showInfo, showSuccess } from "../lib/alerts";
import { DEFAULT_REPORT_RULES, type ReportRules } from "../config/report-rules";
import { exportReportAsExcel, exportReportAsWord } from "../lib/exporters";
import { getSimilarName } from "../lib/name-utils";
import {
  createEmptyDraft,
  createPreviewReport,
  normalizeDraft,
  revokePreviews,
  timeToMinutes,
  today,
  type PendingPhotoMap,
  type PendingPreviewMap,
} from "../lib/report-draft";
import { checkReporterNameExists, fetchReportRules, fetchReporterDirectoryNames, fetchReports, saveReportToDatabase } from "../lib/report-service";
import {
  clearDraft,
  loadCachedReporterNames,
  loadCachedReports,
  loadDeviceSubmittedNames,
  loadDraft,
  pushDeviceSubmittedName,
  saveCachedReporterNames,
  saveCachedReports,
  saveDraft,
} from "../lib/storage";
import { isWitaFriday } from "../lib/time";
import type { DraftReport, Report } from "../types/report";

export type View = "entry" | "history" | "status";

function createDraftSnapshot(draft: DraftReport, pendingPhotos: PendingPhotoMap) {
  return JSON.stringify({
    nama: draft.nama,
    tanggal: draft.tanggal,
    reportDate: draft.reportDate,
    approverCoordinator: draft.approverCoordinator,
    approverCoordinatorNip: draft.approverCoordinatorNip,
    approverDivisionHead: draft.approverDivisionHead,
    approverDivisionHeadTitle: draft.approverDivisionHeadTitle,
    approverDivisionHeadNip: draft.approverDivisionHeadNip,
    notes: draft.notes,
    activities: draft.activities.map((activity) => ({
      no: activity.no,
      description: activity.description,
      startTime: activity.startTime,
      endTime: activity.endTime,
      photos: activity.photos.map((photo) => ({
        id: photo.id,
        storagePath: photo.storagePath,
        publicUrl: photo.publicUrl,
      })),
      pendingPhotos: (pendingPhotos[activity.no] ?? []).map((file) => file.name),
    })),
  });
}

export function useReportDashboard() {
  const [view, setView] = useState<View>("entry");
  const [draft, setDraft] = useState<DraftReport>(() => normalizeDraft(loadDraft(createEmptyDraft())));
  const [reports, setReports] = useState<Report[]>(() => loadCachedReports());
  const [reporterNames, setReporterNames] = useState<string[]>(() => loadCachedReporterNames());
  const [deviceSubmittedNames, setDeviceSubmittedNames] = useState<string[]>(() => loadDeviceSubmittedNames());
  const [historyName, setHistoryName] = useState("");
  const [historyDate, setHistoryDate] = useState(today);
  const [searchName, setSearchName] = useState("");
  const [searchDate, setSearchDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhotoMap>({});
  const [pendingPreviews, setPendingPreviews] = useState<PendingPreviewMap>({});
  const [nameCheckLoading, setNameCheckLoading] = useState(false);
  const [nameExistsInDirectory, setNameExistsInDirectory] = useState<boolean | null>(null);
  const [reportRules, setReportRules] = useState<ReportRules>(DEFAULT_REPORT_RULES);
  const [loadedSearchReportId, setLoadedSearchReportId] = useState<string | null>(null);
  const [loadedSearchSnapshot, setLoadedSearchSnapshot] = useState<string | null>(null);

  useEffect(() => saveDraft(draft), [draft]);
  useEffect(() => {
    void loadDashboardData();
  }, []);
  useEffect(() => () => revokePreviews(pendingPreviews), [pendingPreviews]);
  useEffect(() => {
    if (!draft.nama.trim()) {
      setNameExistsInDirectory(null);
      setNameCheckLoading(false);
      return;
    }

    setNameCheckLoading(true);
    const timeoutId = window.setTimeout(() => {
      void checkReporterNameExists(draft.nama)
        .then((exists) => setNameExistsInDirectory(exists))
        .catch((error) => {
          console.error(error);
          setNameExistsInDirectory(null);
        })
        .finally(() => setNameCheckLoading(false));
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [draft.nama]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [dbReports, dbReporterNames, dbReportRules] = await Promise.all([
        fetchReports(),
        fetchReporterDirectoryNames(),
        fetchReportRules(),
      ]);
      setReports(dbReports);
      setReporterNames(dbReporterNames);
      setReportRules(dbReportRules);
      saveCachedReports(dbReports);
      saveCachedReporterNames(dbReporterNames);
    } catch (error) {
      console.error(error);
      setReportRules(DEFAULT_REPORT_RULES);
      if (reports.length === 0 && reporterNames.length === 0) {
        await showError("Database belum tersedia", "Data database belum bisa dimuat dan cache belum tersedia.");
      }
    } finally {
      setLoading(false);
    }
  }

  const currentDraftSnapshot = useMemo(() => createDraftSnapshot(draft, pendingPhotos), [draft, pendingPhotos]);
  const similarName = useMemo(() => getSimilarName(draft.nama, reporterNames), [draft.nama, reporterNames]);
  const duplicateToday = useMemo(
    () => reports.find((report) => report.reportDate === today && report.nama.trim().toLowerCase() === draft.nama.trim().toLowerCase()) ?? null,
    [draft.nama, reports],
  );
  const preview = useMemo(() => createPreviewReport(draft, pendingPreviews), [draft, pendingPreviews]);
  const historyResults = useMemo(
    () => reports.filter((report) => (!historyName || report.nama.toLowerCase().includes(historyName.toLowerCase())) && (!historyDate || report.reportDate === historyDate)),
    [historyDate, historyName, reports],
  );
  const searchResult = useMemo(
    () => reports.find((report) => report.reportDate === searchDate && report.nama.toLowerCase() === searchName.trim().toLowerCase()) ?? null,
    [reports, searchDate, searchName],
  );
  const searchResultLoaded = useMemo(
    () => Boolean(searchResult && loadedSearchReportId === searchResult.id && loadedSearchSnapshot === currentDraftSnapshot),
    [currentDraftSnapshot, loadedSearchReportId, loadedSearchSnapshot, searchResult],
  );
  const searchResultCanReload = useMemo(
    () => Boolean(searchResult && (loadedSearchReportId !== searchResult.id || loadedSearchSnapshot !== currentDraftSnapshot)),
    [currentDraftSnapshot, loadedSearchReportId, loadedSearchSnapshot, searchResult],
  );
  const searchResultNeedsReload = useMemo(
    () => Boolean(searchResult && loadedSearchReportId === searchResult.id && loadedSearchSnapshot !== currentDraftSnapshot),
    [currentDraftSnapshot, loadedSearchReportId, loadedSearchSnapshot, searchResult],
  );
  const statusRows = useMemo(
    () =>
      reporterNames
        .map((name) => ({
          name,
          done: reports.some((report) => report.reportDate === historyDate && report.nama.toLowerCase() === name.toLowerCase()),
          report: reports.find((report) => report.reportDate === historyDate && report.nama.toLowerCase() === name.toLowerCase()) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [historyDate, reporterNames, reports],
  );
  const activityTimeIssues = useMemo(
    () =>
      draft.activities.map((activity, index) => {
        const startMinutes = timeToMinutes(activity.startTime);
        const endMinutes = timeToMinutes(activity.endTime);
        const previousEndMinutes = index > 0 ? timeToMinutes(draft.activities[index - 1].endTime) : null;

        return {
          startAfterMorning: index === 0 && startMinutes > timeToMinutes("09:00"),
          endBeforeStart: endMinutes < startMinutes,
          startsBeforePreviousEnd: previousEndMinutes !== null && startMinutes < previousEndMinutes,
          overtime: endMinutes > timeToMinutes("16:00"),
        };
      }),
    [draft.activities],
  );

  function change<K extends keyof DraftReport>(key: K, value: DraftReport[K]) {
    setDraft((current) => normalizeDraft({ ...current, [key]: value }));
  }

  function changeActivity(index: number, key: "description" | "startTime" | "endTime", value: string) {
    setDraft((current) =>
      normalizeDraft({
        ...current,
        activities: current.activities.map((activity, activityIndex) => (activityIndex === index ? { ...activity, [key]: value } : activity)),
      }),
    );
  }

  function addActivity() {
    setDraft((current) =>
      normalizeDraft({
        ...current,
        activities: [
          ...current.activities,
          {
            no: current.activities.length + 1,
            description: "",
            startTime: current.activities[current.activities.length - 1]?.endTime ?? "09:00",
            endTime: current.activities[current.activities.length - 1]?.endTime ?? "09:00",
            photos: [],
          },
        ],
      }),
    );
  }

  function removeActivity(index: number) {
    setDraft((current) =>
      normalizeDraft({
        ...current,
        activities: current.activities.filter((_, i) => i !== index).map((activity, i) => ({ ...activity, no: i + 1 })),
      }),
    );

    setPendingPhotos((current) => {
      const entries = Object.entries(current)
        .filter(([key]) => Number(key) !== index + 1)
        .map(([key, files]) => [Number(key) > index + 1 ? Number(key) - 1 : Number(key), files] as const);
      return Object.fromEntries(entries);
    });

    setPendingPreviews((current) => {
      const removed = current[index + 1] ?? [];
      removed.forEach((photo) => URL.revokeObjectURL(photo.url));
      const nextEntries = Object.entries(current)
        .filter(([key]) => Number(key) !== index + 1)
        .map(([key, previews]) => [Number(key) > index + 1 ? Number(key) - 1 : Number(key), previews] as const);
      return Object.fromEntries(nextEntries);
    });
  }

  function setActivityFiles(activityNo: number, files: FileList | null) {
    const selectedFiles = files ? Array.from(files) : [];
    const nextFiles = selectedFiles.slice(0, reportRules.maxPhotosPerActivity);

    if (selectedFiles.length > reportRules.maxPhotosPerActivity) {
      void showInfo(
        "Batas foto aktivitas",
        reportRules.maxPhotosPerActivity === 1
          ? "Saat ini setiap baris aktivitas hanya dapat menyimpan 1 foto. Sistem hanya mengambil file pertama."
          : `Saat ini setiap baris aktivitas hanya dapat menyimpan ${reportRules.maxPhotosPerActivity} foto. Sistem hanya mengambil file sesuai batas tersebut.`,
      );
    }

    setPendingPhotos((current) => ({ ...current, [activityNo]: nextFiles }));
    setPendingPreviews((current) => {
      (current[activityNo] ?? []).forEach((photo) => URL.revokeObjectURL(photo.url));
      return {
        ...current,
        [activityNo]: nextFiles.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
      };
    });
  }

  function resetDraftState() {
    revokePreviews(pendingPreviews);
    setPendingPhotos({});
    setPendingPreviews({});
    setLoadedSearchReportId(null);
    setLoadedSearchSnapshot(null);
    clearDraft();
    setDraft(createEmptyDraft());
  }

  function loadReportIntoDraft(report: Report) {
    const nextDraft = normalizeDraft({
      nama: report.nama,
      tanggal: report.tanggal,
      reportDate: today,
      activities: report.activities.map((activity) => ({
        id: activity.id,
        no: activity.no,
        description: activity.description,
        startTime: activity.startTime,
        endTime: activity.endTime,
        photos: activity.photos ?? [],
      })),
      approverCoordinator: report.approverCoordinator,
      approverCoordinatorNip: report.approverCoordinatorNip,
      approverDivisionHead: report.approverDivisionHead,
      approverDivisionHeadTitle: report.approverDivisionHeadTitle,
      approverDivisionHeadNip: report.approverDivisionHeadNip,
      notes: report.notes,
    });

    revokePreviews(pendingPreviews);
    setPendingPhotos({});
    setPendingPreviews({});
    setDraft(nextDraft);
    setLoadedSearchReportId(report.id);
    setLoadedSearchSnapshot(createDraftSnapshot(nextDraft, {}));
  }

  async function handleLoadEdit(report: Report) {
    const isReloadingOriginal = loadedSearchReportId === report.id && loadedSearchSnapshot !== currentDraftSnapshot;
    const confirmed = await askConfirmation(
      isReloadingOriginal ? "Muat ulang data asli?" : "Buka mode edit?",
      isReloadingOriginal
        ? `Perubahan yang belum disimpan akan diganti dengan data asli ${report.nama} dari database.`
        : `Data ${report.nama} akan dimuat ke form dan perubahan berikutnya akan menggantikan laporan hari ini.`,
      isReloadingOriginal ? "Muat ulang" : "Lanjut edit",
    );
    if (!confirmed) return;
    loadReportIntoDraft(report);
    setView("entry");
  }

  async function handleResetDraft() {
    const confirmed = await askConfirmation("Reset draft?", "Semua isian yang belum disimpan akan dibersihkan dari form.", "Reset draft");
    if (!confirmed) return;
    resetDraftState();
  }

  async function handleExport(report: Report, format: "excel" | "word") {
    const confirmed = await askConfirmation("Unduh laporan?", `Laporan ${report.nama} akan diunduh dalam format ${format.toUpperCase()}.`, `Unduh ${format.toUpperCase()}`);
    if (!confirmed) return;
    if (format === "excel") exportReportAsExcel(report);
    else exportReportAsWord(report);
  }

  async function saveReport() {
    if (!draft.nama.trim() || !draft.activities.some((item) => item.description.trim())) {
      await showError("Data belum lengkap", "Nama dan minimal satu detail aktivitas wajib diisi sebelum disimpan.");
      return;
    }

    if (activityTimeIssues.some((issue) => issue.endBeforeStart || issue.startsBeforePreviousEnd)) {
      await showError("Jam aktivitas belum valid", "Pastikan jam selesai tidak kurang dari jam mulai, dan jam mulai aktivitas berikutnya tidak lebih kecil dari jam selesai aktivitas sebelumnya.");
      return;
    }

    const confirmed = await askConfirmation(
      duplicateToday ? "Perbarui laporan hari ini?" : "Simpan laporan ke database?",
      duplicateToday
        ? `Laporan ${draft.nama} untuk hari ini sudah ada dan akan diperbarui.`
        : `Laporan ${draft.nama} akan disimpan ke database beserta foto bukti yang diunggah.`,
      duplicateToday ? "Perbarui" : "Simpan",
    );

    if (!confirmed) return;

    setSubmitting(true);
    try {
      await saveReportToDatabase(draft, pendingPhotos, duplicateToday, reportRules);
      await loadDashboardData();
      setDeviceSubmittedNames(pushDeviceSubmittedName(draft.nama));
      resetDraftState();
      await showSuccess(
        "Laporan tersimpan",
        isWitaFriday()
          ? "terimakasih atas kerja keras anda. sampai jumpa hari senin."
          : "terimakasih atas kerja keras anda. sampai jumpa besok",
      );
    } catch (error) {
      console.error(error);
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : "";
      const message =
        errorMessage.toLowerCase().includes("batas foto")
          ? errorMessage
          : "Terjadi masalah saat menyimpan laporan atau mengunggah foto bukti.";
      await showError("Simpan gagal", message);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    view,
    setView,
    draft,
    reports,
    savedNames: deviceSubmittedNames,
    reporterNames,
    historyName,
    setHistoryName,
    historyDate,
    setHistoryDate,
    searchName,
    setSearchName,
    searchDate,
    setSearchDate,
    loading,
    submitting,
    pendingPreviews,
    similarName,
    nameCheckLoading,
    nameExistsInDirectory,
    reportRules,
    duplicateToday,
    activityTimeIssues,
    preview,
    historyResults,
    searchResult,
    searchResultLoaded,
    searchResultCanReload,
    searchResultNeedsReload,
    statusRows,
    change,
    changeActivity,
    addActivity,
    removeActivity,
    setActivityFiles,
    handleLoadEdit,
    handleResetDraft,
    handleExport,
    saveReport,
  };
}
