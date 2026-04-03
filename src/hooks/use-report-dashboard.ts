import { useEffect, useMemo, useRef, useState } from "react";
import { askConfirmation, showError, showInfo, showSuccess } from "../lib/alerts";
import {
  DEFAULT_REPORT_RULES,
  normalizeReportRules,
  type ReportRules,
} from "../config/report-rules";
import { exportReportAsPdf, printReportDocument } from "../lib/exporters";
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
import {
  checkReporterNameExists,
  deleteReportFromDatabase,
  fetchReportRules,
  fetchReporterDirectoryNames,
  fetchReports,
  getActiveAdminSession,
  saveReportRulesToDatabase,
  saveReportToDatabase,
  signInAdminAccount,
  signOutAdminAccount,
  subscribeAdminSession,
  subscribeReportData,
} from "../lib/report-service";
import {
  clearDraft,
  loadCachedReporterNames,
  loadCachedReports,
  loadDeviceSubmittedNames,
  loadDraft,
  pushDeviceSubmittedName,
  removeDeviceSubmittedName,
  saveDraft as persistDraft,
  saveCachedReporterNames,
  saveCachedReports,
} from "../lib/storage";
import { isWitaFriday } from "../lib/time";
import { optimizeReportImages } from "../lib/image-optimizer";
import type { AdminSessionState } from "../types/admin";
import type { DraftReport, Report } from "../types/report";

export type View = "entry" | "history" | "status" | "admin";
export type DraftCacheStatus = "idle" | "saving" | "saved";

function hasMeaningfulDraft(draft: DraftReport) {
  return Boolean(
    draft.activities.some(
      (activity) =>
        activity.description.trim() ||
        activity.photos.length > 0 ||
        activity.startTime !== "09:00" ||
        activity.endTime !== "09:00",
    ),
  );
}

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
  const [paperFormat, setPaperFormat] = useState<"a4" | "f4" | "legal" | "letter">("a4");
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
  const [adminSession, setAdminSession] = useState<AdminSessionState | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthLoading, setAdminAuthLoading] = useState(true);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminRuleDraft, setAdminRuleDraft] = useState<ReportRules>(DEFAULT_REPORT_RULES);
  const [loadedSearchReportId, setLoadedSearchReportId] = useState<string | null>(null);
  const [loadedSearchSnapshot, setLoadedSearchSnapshot] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftCacheStatus, setDraftCacheStatus] = useState<DraftCacheStatus>("idle");
  const [searchOpen, setSearchOpen] = useState(false);
  const realtimeReloadTimeoutRef = useRef<number | null>(null);

  function handleRemoveSavedName(name: string) {
    const updated = removeDeviceSubmittedName(name);
    setDeviceSubmittedNames(updated);
  }

  useEffect(() => {
    setDraftCacheStatus("saving");
    persistDraft(draft);
    
    const timeoutId1 = window.setTimeout(() => {
      setDraftSavedAt(new Date().toISOString());
      setDraftCacheStatus("saved");
    }, 500);

    const timeoutId2 = window.setTimeout(() => {
      setDraftCacheStatus("idle");
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId1);
      window.clearTimeout(timeoutId2);
    };
  }, [draft]);
  useEffect(() => {
    void loadDashboardData();
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeReportData(() => {
      if (realtimeReloadTimeoutRef.current !== null) {
        window.clearTimeout(realtimeReloadTimeoutRef.current);
      }

      realtimeReloadTimeoutRef.current = window.setTimeout(() => {
        void loadDashboardData();
      }, 300);
    });

    return () => {
      if (realtimeReloadTimeoutRef.current !== null) {
        window.clearTimeout(realtimeReloadTimeoutRef.current);
      }
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    let alive = true;

    void getActiveAdminSession()
      .then((session) => {
        if (!alive) return;
        setAdminSession(session);
      })
      .catch((error) => {
        console.error(error);
        if (alive) setAdminSession(null);
      })
      .finally(() => {
        if (alive) setAdminAuthLoading(false);
      });

    const unsubscribe = subscribeAdminSession((session) => {
      setAdminSession(session);
      setAdminAuthLoading(false);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (adminSession || reportRules.allowAnyReportDate || draft.reportDate === today) {
      return;
    }

    setDraft((current) => normalizeDraft({ ...current, reportDate: today }));
  }, [adminSession, draft.reportDate, reportRules.allowAnyReportDate]);
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
      setAdminRuleDraft(dbReportRules);
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
  const hasDraftContent = useMemo(() => hasMeaningfulDraft(draft), [draft]);
  const similarName = useMemo(() => getSimilarName(draft.nama, reporterNames), [draft.nama, reporterNames]);
  const duplicateReport = useMemo(
    () =>
      reports.find(
        (report) =>
          report.reportDate === draft.reportDate &&
          report.nama.trim().toLowerCase() === draft.nama.trim().toLowerCase(),
      ) ?? null,
    [draft.nama, draft.reportDate, reports],
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
    if (key === "reportDate" && !adminSession && !reportRules.allowAnyReportDate) {
      setDraft((current) => normalizeDraft({ ...current, reportDate: today }));
      return;
    }

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

  async function setActivityFiles(activityNo: number, files: FileList | null) {
    const selectedFiles = files ? Array.from(files) : [];
    const limitedFiles = selectedFiles.slice(0, reportRules.maxPhotosPerActivity);

    if (selectedFiles.length > reportRules.maxPhotosPerActivity) {
      void showInfo(
        "Batas foto aktivitas",
        reportRules.maxPhotosPerActivity === 1
          ? "Saat ini setiap baris aktivitas hanya dapat menyimpan 1 foto. Sistem hanya mengambil file pertama."
          : `Saat ini setiap baris aktivitas hanya dapat menyimpan ${reportRules.maxPhotosPerActivity} foto. Sistem hanya mengambil file sesuai batas tersebut.`,
      );
    }

    const nextFiles = await optimizeReportImages(limitedFiles);

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
    setDraftSavedAt(null);
    setDraftCacheStatus("idle");
  }

  function loadReportIntoDraft(report: Report) {
    const nextDraft = normalizeDraft({
      nama: report.nama,
      tanggal: report.tanggal,
      reportDate: report.reportDate,
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
    if (!adminSession && !reportRules.allowAnyReportDate && report.reportDate !== today) {
      await showError(
        "Edit laporan belum diizinkan",
        "Saat ini laporan publik di luar hari berjalan hanya bisa dibaca, belum bisa diedit.",
      );
      return;
    }

    const isReloadingOriginal = loadedSearchReportId === report.id && loadedSearchSnapshot !== currentDraftSnapshot;
    const confirmed = await askConfirmation(
      isReloadingOriginal ? "Muat ulang data asli?" : "Buka mode edit?",
      isReloadingOriginal
        ? `Perubahan yang belum disimpan akan diganti dengan data asli ${report.nama} dari database.`
        : `Data ${report.nama} untuk ${report.tanggal} akan dimuat ke form dan perubahan berikutnya akan menggantikan laporan pada tanggal tersebut.`,
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

  async function handleExport(report: Report) {
    try {
      await exportReportAsPdf(report, paperFormat);
    } catch (error) {
      console.error(error);
      await showError("Export gagal", "PDF belum berhasil dibuat. Coba lagi setelah memastikan foto dan data laporan sudah lengkap.");
    }
  }

  async function handlePrint(report: Report) {
    try {
      await printReportDocument(report, paperFormat);
    } catch (error) {
      console.error(error);
      await showError("Print gagal", "Dokumen belum berhasil dibuka untuk print. Coba lagi setelah memastikan data dan foto sudah termuat.");
    }
  }

  async function saveReport() {
    if (!draft.nama.trim() || !draft.activities.some((item) => item.description.trim())) {
      await showError("Data belum lengkap", "Nama dan minimal satu detail aktivitas wajib diisi sebelum disimpan.");
      return;
    }

    if (!adminSession && !reportRules.allowAnyReportDate && draft.reportDate !== today) {
      await showError(
        "Tanggal laporan belum diizinkan",
        "Saat ini admin membatasi pengisian laporan hanya untuk hari berjalan.",
      );
      return;
    }

    if (activityTimeIssues.some((issue) => issue.endBeforeStart || issue.startsBeforePreviousEnd)) {
      await showError("Jam aktivitas belum valid", "Pastikan jam selesai tidak kurang dari jam mulai, dan jam mulai aktivitas berikutnya tidak lebih kecil dari jam selesai aktivitas sebelumnya.");
      return;
    }

    const confirmed = await askConfirmation(
      duplicateReport ? "Perbarui laporan tanggal ini?" : "Simpan laporan ke database?",
      duplicateReport
        ? `Laporan ${draft.nama} untuk ${draft.tanggal} sudah ada dan akan diperbarui.`
        : `Laporan ${draft.nama} untuk ${draft.tanggal} akan disimpan ke database beserta foto bukti yang diunggah.`,
      duplicateReport ? "Perbarui" : "Simpan",
    );

    if (!confirmed) return;

    setSubmitting(true);
    try {
      await saveReportToDatabase(draft, pendingPhotos, duplicateReport, reportRules);
      await loadDashboardData();
      setDeviceSubmittedNames(pushDeviceSubmittedName(draft.nama));
      resetDraftState();
      await showSuccess(
        "Laporan tersimpan",
        isWitaFriday(draft.reportDate)
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

  async function handleDeleteReport(report: Report) {
    if (!adminSession) {
      await showError("Akses admin diperlukan", "Silakan login admin terlebih dahulu.");
      return;
    }

    const confirmed = await askConfirmation(
      "Hapus laporan ini?",
      `Laporan ${report.nama} untuk ${report.tanggal} akan dihapus permanen beserta foto buktinya.`,
      "Hapus laporan",
    );

    if (!confirmed) return;

    setSubmitting(true);
    try {
      await deleteReportFromDatabase(report);
      if (loadedSearchReportId === report.id) {
        resetDraftState();
      }
      await loadDashboardData();
      await showSuccess("Laporan dihapus", "Data laporan dan foto bukti sudah dihapus.");
    } catch (error) {
      console.error(error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Laporan belum berhasil dihapus.";
      await showError("Hapus gagal", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminLogin() {
    if (!adminEmail.trim() || !adminPassword) {
      await showError("Login admin belum lengkap", "Email dan password admin wajib diisi.");
      return;
    }

    setAdminSubmitting(true);
    try {
      const session = await signInAdminAccount(adminEmail, adminPassword);
      setAdminSession(session);
      setAdminEmail("");
      setAdminPassword("");
      await showSuccess("Login berhasil", `Selamat datang, ${session.profile.fullName}.`);
    } catch (error) {
      console.error(error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Login admin belum berhasil. Periksa email dan password.";
      await showError("Login gagal", message);
    } finally {
      setAdminSubmitting(false);
    }
  }

  async function handleAdminLogout() {
    setAdminSubmitting(true);
    try {
      await signOutAdminAccount();
      setAdminSession(null);
      await showSuccess("Logout berhasil", "Sesi admin sudah ditutup.");
    } catch (error) {
      console.error(error);
      await showError("Logout gagal", "Sesi admin belum berhasil ditutup.");
    } finally {
      setAdminSubmitting(false);
    }
  }

  function changeAdminRule<K extends keyof ReportRules>(
    key: K,
    value: ReportRules[K],
  ) {
    setAdminRuleDraft((current) => normalizeReportRules({ ...current, [key]: value }));
  }

  async function handleSaveAdminRules() {
    if (!adminSession) {
      await showError("Akses admin diperlukan", "Silakan login admin terlebih dahulu.");
      return;
    }

    setAdminSubmitting(true);
    try {
      const savedRules = await saveReportRulesToDatabase(adminRuleDraft);
      setReportRules(savedRules);
      setAdminRuleDraft(savedRules);
      await showSuccess("Rules tersimpan", "Pengaturan laporan publik berhasil diperbarui.");
    } catch (error) {
      console.error(error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Pengaturan rules belum berhasil disimpan.";
      await showError("Simpan rules gagal", message);
    } finally {
      setAdminSubmitting(false);
    }
  }

  return {
    view,
    setView,
    paperFormat,
    setPaperFormat,
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
    adminSession,
    adminEmail,
    setAdminEmail,
    adminPassword,
    setAdminPassword,
    adminAuthLoading,
    adminSubmitting,
    adminRuleDraft,
    canUseAnyReportDate: Boolean(adminSession) || reportRules.allowAnyReportDate,
    canManageReports: Boolean(adminSession),
    duplicateReport,
    activityTimeIssues,
    preview,
    historyResults,
    searchResult,
    searchResultLoaded,
    searchResultCanReload,
    searchResultNeedsReload,
    statusRows,
    hasDraftContent,
    draftSavedAt,
    draftCacheStatus,
    searchOpen,
    setSearchOpen,
    change,
    changeActivity,
    addActivity,
    removeActivity,
    setActivityFiles,
    handleDeleteReport,
    handleLoadEdit,
    handleResetDraft,
    handleExport,
    handlePrint,
    saveReport,
    handleRemoveSavedName,
    changeAdminRule,
    handleAdminLogin,
    handleAdminLogout,
    handleSaveAdminRules,
  };
}
