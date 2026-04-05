import { useEffect, useMemo, useRef, useState } from "react";
import {
  askAcknowledge,
  askConfirmation,
  openProgressToast,
  showError,
  showInfo,
  showSuccess,
} from "../lib/alerts";
import {
  DEFAULT_REPORT_RULES,
  normalizeReportRules,
  type ReportRules,
} from "../config/report-rules";
import { warmUpExcelTemplateCache } from "../lib/excel/cacheManager";
import { generateDailyReportExcel } from "../lib/excel/excelGenerator";
import {
  activateExcelReportTemplate,
  buildAutoExcelTemplateName,
  deleteExcelReportTemplate,
  fetchExcelReportTemplates,
  resolveNextExcelTemplateVersion,
  updateExcelReportTemplateMetadata,
  uploadExcelReportTemplate,
} from "../lib/excel-template-service";
import { printReportDocument } from "../lib/exporters";
import { getSimilarName } from "../lib/name-utils";
import {
  createApproverDraftFromTemplate,
  fetchActiveReportTemplateConfig,
  saveTemplateApproverDefaults,
} from "../lib/report-template-service";
import {
  applyTemplateDefaultsToDraft,
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
  deleteReporterDirectoryTrace,
  fetchNotificationSettings,
  fetchReportRules,
  fetchReporterDirectoryProfiles,
  fetchReports,
  getActiveAdminSession,
  renameReporterDirectoryProfile,
  saveNotificationSettingsToDatabase,
  saveReportRulesToDatabase,
  saveReportToDatabase,
  signInAdminAccount,
  signOutAdminAccount,
  subscribeAdminSession,
  subscribeReportData,
} from "../lib/report-service";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  setRuntimeNotificationSettings,
  saveNotificationSettings as persistNotificationSettings,
} from "../lib/sound-utils";
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
import type { NotificationSettings } from "../types/notification-settings";
import type {
  ExcelReportTemplate,
  ExcelTemplateUploadDraft,
} from "../types/excel-template";
import type {
  ReportTemplateApproverDraft,
  ReportTemplateApproverRole,
  ReportTemplateConfig,
} from "../types/report-template";
import type {
  DraftReport,
  Report,
  ReportActivityPhoto,
  ReporterDirectoryProfile,
} from "../types/report";

export type View = "entry" | "history" | "status" | "admin";
export type DraftCacheStatus = "idle" | "saving" | "saved";
export type AdminActiveAction =
  | null
  | "login"
  | "logout"
  | "save-rules"
  | "save-template-approvers"
  | "activate-excel-template"
  | "rename-excel-template"
  | "delete-excel-template"
  | "rename-reporter"
  | "delete-reporter"
  | "save-notification-settings";
const ACTIVE_TEMPLATE_VERSION_KEY = "silahar:active-template-version";

function buildTemplateVersionId(template: ReportTemplateConfig | null) {
  if (!template) return null;
  return `${template.id}-${template.updatedAt.replace(/[^0-9]/g, "")}`;
}

function createDefaultApproverDraftMap(template: ReportTemplateConfig | null) {
  return {
    coordinator_team: createApproverDraftFromTemplate(template, "coordinator_team"),
    division_head: createApproverDraftFromTemplate(template, "division_head"),
  } satisfies Record<ReportTemplateApproverRole, ReportTemplateApproverDraft>;
}

function mapOriginalActivityPhotos(report: Report) {
  return Object.fromEntries(
    report.activities.map((activity) => [activity.no, activity.photos ?? []]),
  ) as Record<number, ReportActivityPhoto[]>;
}

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
    templateId: draft.templateId,
    nama: draft.nama,
    tanggal: draft.tanggal,
    reportDate: draft.reportDate,
    approverCoordinatorTemplateId: draft.approverCoordinatorTemplateId,
    approverCoordinator: draft.approverCoordinator,
    approverCoordinatorNip: draft.approverCoordinatorNip,
    approverDivisionHeadTemplateId: draft.approverDivisionHeadTemplateId,
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

function isActivityComplete(
  activity: DraftReport["activities"][number],
  pendingPhotos: PendingPhotoMap,
  issue: {
    endBeforeStart: boolean;
    startsBeforePreviousEnd: boolean;
  },
) {
  const hasPhoto =
    activity.photos.length > 0 || (pendingPhotos[activity.no]?.length ?? 0) > 0;

  return Boolean(
    activity.description.trim() &&
      activity.startTime &&
      activity.endTime &&
      hasPhoto &&
      !issue.endBeforeStart &&
      !issue.startsBeforePreviousEnd,
  );
}

export function useReportDashboard() {
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("silahar:active-view");
      if (stored === "entry" || stored === "history" || stored === "status" || stored === "admin") {
        return stored as View;
      }
    }
    return "entry";
  });
  const [paperFormat, setPaperFormat] = useState<"a4" | "f4" | "legal" | "letter">("a4");
  const [draft, setDraft] = useState<DraftReport>(() => normalizeDraft(loadDraft(createEmptyDraft())));
  const [reports, setReports] = useState<Report[]>(() => loadCachedReports());
  const [reporterProfiles, setReporterProfiles] = useState<ReporterDirectoryProfile[]>([]);
  const [activeReportTemplateConfig, setActiveReportTemplateConfig] =
    useState<ReportTemplateConfig | null>(null);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [excelTemplates, setExcelTemplates] = useState<ExcelReportTemplate[]>([]);
  const [excelTemplateDraft, setExcelTemplateDraft] =
    useState<ExcelTemplateUploadDraft>({
      templateName: buildAutoExcelTemplateName("v1", today),
      templateDate: today,
      cacheVersion: "v1",
    });
  const [selectedExcelTemplateFile, setSelectedExcelTemplateFile] =
    useState<File | null>(null);
  const [adminExcelTemplateDrafts, setAdminExcelTemplateDrafts] = useState<
    Record<string, ExcelTemplateUploadDraft>
  >({});
  const [excelTemplateUploading, setExcelTemplateUploading] = useState(false);
  const [excelExportingReportId, setExcelExportingReportId] = useState<string | null>(null);
  const [editLoadingReportId, setEditLoadingReportId] = useState<string | null>(null);
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
  const [editableOriginalPhotos, setEditableOriginalPhotos] = useState<
    Record<number, ReportActivityPhoto[]>
  >({});
  const [nameCheckLoading, setNameCheckLoading] = useState(false);
  const [nameExistsInDirectory, setNameExistsInDirectory] = useState<boolean | null>(null);
  const [reportRules, setReportRules] = useState<ReportRules>(DEFAULT_REPORT_RULES);
  const [adminSession, setAdminSession] = useState<AdminSessionState | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthLoading, setAdminAuthLoading] = useState(true);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminActiveAction, setAdminActiveAction] = useState<AdminActiveAction>(null);
  const [adminRuleDraft, setAdminRuleDraft] = useState<ReportRules>(DEFAULT_REPORT_RULES);
  const [adminTemplateApproverDrafts, setAdminTemplateApproverDrafts] =
    useState<Record<ReportTemplateApproverRole, ReportTemplateApproverDraft>>(
      () => createDefaultApproverDraftMap(null),
    );
  const [adminReporterDraftNames, setAdminReporterDraftNames] = useState<
    Record<string, string>
  >({});
  const [loadedSearchReportId, setLoadedSearchReportId] = useState<string | null>(null);
  const [loadedSearchSnapshot, setLoadedSearchSnapshot] = useState<string | null>(null);
  const [adminActiveItemId, setAdminActiveItemId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftCacheStatus, setDraftCacheStatus] = useState<DraftCacheStatus>("idle");
  const [searchOpen, setSearchOpen] = useState(false);

  const realtimeReloadTimeoutRef = useRef<number | null>(null);
  const backgroundRefreshIntervalRef = useRef<number | null>(null);
  const templateVersionRef = useRef<string | null>(null);
  const templatePreviousConfigRef = useRef<ReportTemplateConfig | null>(null);
  const templateInitializedRef = useRef(false);
  const templateRefreshPromptOpenRef = useRef(false);
  const previousViewRef = useRef<View>(view);
  const reportsRef = useRef(reports);
  const reporterNamesRef = useRef(reporterNames);

  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => { reporterNamesRef.current = reporterNames; }, [reporterNames]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("silahar:active-view", view);
    }
  }, [view]);

  useEffect(() => {
    if (previousViewRef.current !== view && (view === "history" || view === "status")) {
      void loadDashboardData();
    }
    previousViewRef.current = view;
  }, [view]);

  function handleRemoveSavedName(name: string) {
    const updated = removeDeviceSubmittedName(name);
    setDeviceSubmittedNames(updated);
  }

  useEffect(() => {
    setDraftCacheStatus("saving");
    persistDraft(draft);
    const t1 = window.setTimeout(() => {
      setDraftSavedAt(new Date().toISOString());
      setDraftCacheStatus("saved");
    }, 500);
    const t2 = window.setTimeout(() => {
      setDraftCacheStatus("idle");
    }, 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [draft]);

  useEffect(() => { void loadDashboardData(); }, []);

  useEffect(() => {
    const activeTemplate = excelTemplates.find((t) => t.isActive) ?? null;
    void warmUpExcelTemplateCache(activeTemplate).catch((err) => console.error(err));
  }, [excelTemplates]);

  useEffect(() => {
    const unsubscribe = subscribeReportData(() => {
      if (realtimeReloadTimeoutRef.current !== null) window.clearTimeout(realtimeReloadTimeoutRef.current);
      realtimeReloadTimeoutRef.current = window.setTimeout(() => { void loadDashboardData(); }, 300);
    });
    return () => {
      if (realtimeReloadTimeoutRef.current !== null) window.clearTimeout(realtimeReloadTimeoutRef.current);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void loadDashboardData(); };
    backgroundRefreshIntervalRef.current = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      if (backgroundRefreshIntervalRef.current !== null) window.clearInterval(backgroundRefreshIntervalRef.current);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void getActiveAdminSession().then((session) => {
      if (!alive) return;
      setAdminSession(session);
    }).catch(err => {
      console.error(err);
      if (alive) setAdminSession(null);
    }).finally(() => { if (alive) setAdminAuthLoading(false); });

    const unsubscribe = subscribeAdminSession((session) => {
      setAdminSession(session);
      setAdminAuthLoading(false);
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (adminSession || reportRules.allowAnyReportDate || draft.reportDate === today) return;
    setDraft((current) => normalizeDraft({ ...current, reportDate: today }));
  }, [adminSession, draft.reportDate, reportRules.allowAnyReportDate]);

  useEffect(() => {
    const nextId = buildTemplateVersionId(activeReportTemplateConfig);
    if (!nextId) return;
    if (!templateInitializedRef.current) {
      templateInitializedRef.current = true;
      templateVersionRef.current = nextId;
      templatePreviousConfigRef.current = activeReportTemplateConfig;
      if (typeof window !== "undefined") window.sessionStorage.setItem(ACTIVE_TEMPLATE_VERSION_KEY, nextId);
      return;
    }
    if (nextId === templateVersionRef.current) {
      templatePreviousConfigRef.current = activeReportTemplateConfig;
      return;
    }
    const previous = templatePreviousConfigRef.current;
    templateVersionRef.current = nextId;
    templatePreviousConfigRef.current = activeReportTemplateConfig;
    if (typeof window !== "undefined") window.sessionStorage.setItem(ACTIVE_TEMPLATE_VERSION_KEY, nextId);

    if (view === "entry") {
      if (templateRefreshPromptOpenRef.current) return;
      templateRefreshPromptOpenRef.current = true;
      void askAcknowledge("Template form diperbarui", "Admin baru saja mengubah data template. Klik OK untuk menyegarkan draft.", "OK")
        .then(() => setDraft(c => applyTemplateDefaultsToDraft(c, previous, activeReportTemplateConfig)))
        .finally(() => { templateRefreshPromptOpenRef.current = false; });
      return;
    }
    setDraft(c => applyTemplateDefaultsToDraft(c, previous, activeReportTemplateConfig));
  }, [activeReportTemplateConfig, view]);

  useEffect(() => () => revokePreviews(pendingPreviews), [pendingPreviews]);

  useEffect(() => {
    if (!draft.nama.trim()) {
      setNameExistsInDirectory(null);
      setNameCheckLoading(false);
      return;
    }
    setNameCheckLoading(true);
    const t = window.setTimeout(() => {
      void checkReporterNameExists(draft.nama)
        .then(exists => setNameExistsInDirectory(exists))
        .catch(err => { console.error(err); setNameExistsInDirectory(null); })
        .finally(() => setNameCheckLoading(false));
    }, 350);
    return () => window.clearTimeout(t);
  }, [draft.nama]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [dbR, dbRP, dbRules, dbET, dbATC, dbNS] = await Promise.all([
        fetchReports(), fetchReporterDirectoryProfiles(), fetchReportRules(),
        fetchExcelReportTemplates(), fetchActiveReportTemplateConfig(), fetchNotificationSettings()
      ]);
      const dbRN = dbRP.filter(r => r.isActive).map(r => r.fullName);
      setReports(dbR);
      setReporterProfiles(dbRP);
      setActiveReportTemplateConfig(dbATC);
      setNotificationSettings(dbNS);
      setRuntimeNotificationSettings(dbNS);
      persistNotificationSettings(dbNS);
      setExcelTemplates(dbET);
      setReporterNames(dbRN);
      setReportRules(dbRules);
      setAdminRuleDraft(dbRules);
      setAdminTemplateApproverDrafts(createDefaultApproverDraftMap(dbATC));
      setAdminReporterDraftNames(c => Object.fromEntries(dbRP.map(r => [r.id, c[r.id] ?? r.fullName])));
      setAdminExcelTemplateDrafts(c => Object.fromEntries(dbET.map(t => [t.id, c[t.id] ?? {
        templateName: t.templateName,
        templateDate: t.createdAt.slice(0, 10),
        cacheVersion: t.cacheVersion
      }])));
      const nextVersion = resolveNextExcelTemplateVersion(dbET);
      setExcelTemplateDraft(c => ({
        ...c,
        cacheVersion: nextVersion,
        templateName: c.templateName.trim() === "" || c.templateName === buildAutoExcelTemplateName(c.cacheVersion, c.templateDate)
          ? buildAutoExcelTemplateName(nextVersion, c.templateDate)
          : c.templateName
      }));
      saveCachedReports(dbR);
      saveCachedReporterNames(dbRN);
      setDraft(c => (hasMeaningfulDraft(c) || c.nama.trim()) ? c : createEmptyDraft(dbATC));
    } catch (err) {
      console.error(err);
      setReportRules(DEFAULT_REPORT_RULES);
      if (reportsRef.current.length === 0 && reporterNamesRef.current.length === 0) {
        await showError("Database belum tersedia", "Data database belum bisa dimuat.");
      }
    } finally { setLoading(false); }
  }

  const currentDraftSnapshot = useMemo(() => createDraftSnapshot(draft, pendingPhotos), [draft, pendingPhotos]);
  const hasDraftContent = useMemo(() => hasMeaningfulDraft(draft), [draft]);
  const similarName = useMemo(() => getSimilarName(draft.nama, reporterNames), [draft.nama, reporterNames]);
  const duplicateReport = useMemo(() => reports.find(r => r.reportDate === draft.reportDate && r.nama.trim().toLowerCase() === draft.nama.trim().toLowerCase()) ?? null, [draft.nama, draft.reportDate, reports]);
  const preview = useMemo(() => createPreviewReport(draft, pendingPreviews), [draft, pendingPreviews]);
  const historyResults = useMemo(() => reports.filter(r => (!historyName || r.nama.toLowerCase().includes(historyName.toLowerCase())) && (!historyDate || r.reportDate === historyDate)), [historyDate, historyName, reports]);
  const searchResult = useMemo(() => reports.find(r => r.reportDate === searchDate && r.nama.toLowerCase() === searchName.trim().toLowerCase()) ?? null, [reports, searchDate, searchName]);
  const searchResultLoaded = useMemo(() => Boolean(searchResult && loadedSearchReportId === searchResult.id && loadedSearchSnapshot === currentDraftSnapshot), [currentDraftSnapshot, loadedSearchReportId, loadedSearchSnapshot, searchResult]);
  const searchResultCanReload = useMemo(() => Boolean(searchResult && (loadedSearchReportId !== searchResult.id || loadedSearchSnapshot !== currentDraftSnapshot)), [currentDraftSnapshot, loadedSearchReportId, loadedSearchSnapshot, searchResult]);
  const searchResultNeedsReload = useMemo(() => Boolean(searchResult && loadedSearchReportId === searchResult.id && loadedSearchSnapshot !== currentDraftSnapshot), [currentDraftSnapshot, loadedSearchReportId, loadedSearchSnapshot, searchResult]);
  const statusRows = useMemo(() => reporterNames.map(name => ({
    name,
    done: reports.some(r => r.reportDate === historyDate && r.nama.toLowerCase() === name.toLowerCase()),
    report: reports.find(r => r.reportDate === historyDate && r.nama.toLowerCase() === name.toLowerCase()) ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name)), [historyDate, reporterNames, reports]);

  const activityTimeIssues = useMemo(() => draft.activities.map((act, i) => {
    const s = timeToMinutes(act.startTime);
    const e = timeToMinutes(act.endTime);
    const pE = i > 0 ? timeToMinutes(draft.activities[i - 1].endTime) : null;
    return {
      startAfterMorning: i === 0 && s > timeToMinutes("09:00"),
      endBeforeStart: e < s,
      startsBeforePreviousEnd: pE !== null && s < pE,
      overtime: e > timeToMinutes("16:00"),
    };
  }), [draft.activities]);

  const activityCompletionStates = useMemo(() => draft.activities.map((act, i) => isActivityComplete(act, pendingPhotos, activityTimeIssues[i] ?? { endBeforeStart: false, startsBeforePreviousEnd: false })), [activityTimeIssues, draft.activities, pendingPhotos]);
  const activeExcelTemplate = useMemo(() => excelTemplates.find(t => t.isActive) ?? null, [excelTemplates]);

  function change<K extends keyof DraftReport>(key: K, value: DraftReport[K]) {
    if (key === "reportDate" && !adminSession && !reportRules.allowAnyReportDate) {
      setDraft(c => normalizeDraft({ ...c, reportDate: today }));
      return;
    }
    setDraft(c => normalizeDraft({ ...c, [key]: value }));
  }

  function changeActivity(index: number, key: "description" | "startTime" | "endTime", value: string) {
    setDraft(c => normalizeDraft({ ...c, activities: c.activities.map((a, i) => i === index ? { ...a, [key]: value } : a) }));
  }

  function addActivity() {
    setDraft(c => normalizeDraft({
      ...c,
      activities: [...c.activities, {
        no: c.activities.length + 1,
        description: "",
        startTime: c.activities[c.activities.length - 1]?.endTime ?? "09:00",
        endTime: c.activities[c.activities.length - 1]?.endTime ?? "09:00",
        photos: [],
      }]
    }));
  }

  function removeActivity(index: number) {
    setDraft(c => normalizeDraft({ ...c, activities: c.activities.filter((_, i) => i !== index).map((a, i) => ({ ...a, no: i + 1 })) }));
    setPendingPhotos(c => {
      const entries = Object.entries(c).filter(([k]) => Number(k) !== index + 1).map(([k, f]) => [Number(k) > index + 1 ? Number(k) - 1 : Number(k), f] as const);
      return Object.fromEntries(entries);
    });
    setPendingPreviews(c => {
      (c[index + 1] ?? []).forEach(p => URL.revokeObjectURL(p.url));
      const entries = Object.entries(c).filter(([k]) => Number(k) !== index + 1).map(([k, p]) => [Number(k) > index + 1 ? Number(k) - 1 : Number(k), p] as const);
      return Object.fromEntries(entries);
    });
  }

  function clearActivityFiles(activityNo: number) {
    setDraft(c => normalizeDraft({ ...c, activities: c.activities.map(a => a.no === activityNo ? { ...a, photos: [] } : a) }));
    setPendingPhotos(c => { const n = { ...c }; delete n[activityNo]; return n; });
    setPendingPreviews(c => { (c[activityNo] ?? []).forEach(p => URL.revokeObjectURL(p.url)); const n = { ...c }; delete n[activityNo]; return n; });
  }

  function restoreActivityFiles(activityNo: number) {
    const orig = editableOriginalPhotos[activityNo] ?? [];
    if (orig.length === 0) return;
    setDraft(c => normalizeDraft({ ...c, activities: c.activities.map(a => a.no === activityNo ? { ...a, photos: orig } : a) }));
    setPendingPhotos(c => { const n = { ...c }; delete n[activityNo]; return n; });
    setPendingPreviews(c => { (c[activityNo] ?? []).forEach(p => URL.revokeObjectURL(p.url)); const n = { ...c }; delete n[activityNo]; return n; });
  }

  async function setActivityFiles(activityNo: number, files: FileList | null) {
    const sel = files ? Array.from(files) : [];
    const target = draft.activities.find(a => a.no === activityNo);
    const existing = target?.photos ?? [];
    const max = reportRules.maxPhotosPerActivity;
    const slots = Math.max(0, max - existing.length);
    const replace = existing.length > 0 && sel.length > slots;
    const allowed = replace ? max : slots;
    const limited = sel.slice(0, allowed);

    if (sel.length > allowed) {
      void showInfo("Batas foto aktivitas", replace ? `Foto lama otomatis diganti agar aktivitas ini tetap hanya menyimpan ${max} foto.` : `Sistem hanya mengambil file sesuai sisa kapasitas (${slots}).`);
    }
    if (limited.length === 0) return;
    const next = await optimizeReportImages(limited);
    if (replace) setDraft(c => normalizeDraft({ ...c, activities: c.activities.map(a => a.no === activityNo ? { ...a, photos: [] } : a) }));
    setPendingPhotos(c => ({ ...c, [activityNo]: next }));
    setPendingPreviews(c => {
      (c[activityNo] ?? []).forEach(p => URL.revokeObjectURL(p.url));
      return { ...c, [activityNo]: next.map(f => ({ name: f.name, url: URL.createObjectURL(f) })) };
    });
  }

  function resetDraftState() {
    revokePreviews(pendingPreviews);
    setPendingPhotos({});
    setPendingPreviews({});
    setEditableOriginalPhotos({});
    setLoadedSearchReportId(null);
    setLoadedSearchSnapshot(null);
    clearDraft();
    setDraft(createEmptyDraft(activeReportTemplateConfig));
    setDraftSavedAt(null);
    setDraftCacheStatus("idle");
  }

  function loadReportIntoDraft(report: Report) {
    const d = normalizeDraft({
      templateId: report.templateId,
      nama: report.nama,
      tanggal: report.tanggal,
      reportDate: report.reportDate,
      activities: report.activities.map(a => ({ id: a.id, no: a.no, description: a.description, startTime: a.startTime, endTime: a.endTime, photos: a.photos ?? [] })),
      approverCoordinatorTemplateId: report.approverCoordinatorTemplateId,
      approverCoordinator: report.approverCoordinator,
      approverCoordinatorNip: report.approverCoordinatorNip,
      approverDivisionHeadTemplateId: report.approverDivisionHeadTemplateId,
      approverDivisionHead: report.approverDivisionHead,
      approverDivisionHeadTitle: report.approverDivisionHeadTitle,
      approverDivisionHeadNip: report.approverDivisionHeadNip,
      notes: report.notes,
    });
    revokePreviews(pendingPreviews);
    setPendingPhotos({});
    setPendingPreviews({});
    setEditableOriginalPhotos(mapOriginalActivityPhotos(report));
    setDraft(d);
    setLoadedSearchReportId(report.id);
    setLoadedSearchSnapshot(createDraftSnapshot(d, {}));
  }

  async function handleLoadEdit(report: Report) {
    if (!adminSession && !reportRules.allowAnyReportDate && report.reportDate !== today) {
      await showError("Edit belum diizinkan", "Hanya laporan hari berjalan yang bisa diedit publik.");
      return;
    }
    const reloading = loadedSearchReportId === report.id && loadedSearchSnapshot !== currentDraftSnapshot;
    const confirmed = await askConfirmation(reloading ? "Muat ulang data asli?" : "Buka mode edit?", reloading ? "Perubahan yang belum disimpan akan diganti data asli." : `Data ${report.nama} akan dimuat ke form.`, reloading ? "Muat ulang" : "Lanjut edit");
    if (!confirmed) return;
    setEditLoadingReportId(report.id);
    try { loadReportIntoDraft(report); setView("entry"); } finally { setEditLoadingReportId(null); }
  }

  async function handleResetDraft() {
    if (await askConfirmation("Reset draft?", "Semua isian akan dibersihkan.", "Reset draft")) resetDraftState();
  }

  async function handleExport(report: Report) {
    if (!activeExcelTemplate) { await showError("Template Excel belum tersedia", "Admin perlu menyiapkan template Excel."); return; }
    setExcelExportingReportId(report.id);
    const toast = openProgressToast("Menyiapkan export Excel", [{ id: "prepare", label: "Menyiapkan" }, { id: "mapping", label: "Memetakan" }, { id: "images", label: "Memproses" }, { id: "build", label: "Menyusun" }, { id: "download", label: "Unduh" }]);
    try {
      await generateDailyReportExcel({ report, template: activeExcelTemplate, pendingPhotos: report.id === "preview" ? pendingPhotos : undefined, onStage: (s, d) => toast.update(s, d) });
      toast.close();
    } catch (err) { console.error(err); await showError("Export Excel gagal", "Terjadi masalah saat membuat file Excel."); }
    finally { setExcelExportingReportId(null); }
  }

  async function handlePrint(report: Report) {
    try { await printReportDocument(report, paperFormat); } catch (err) { console.error(err); await showError("Print gagal", "Dokumen belum berhasil dibuka."); }
  }

  async function saveReport() {
    if (!draft.nama.trim()) { await showError("Nama belum diisi", "Nama petugas wajib diisi."); return; }
    const fatalIdx = activityCompletionStates.findIndex(c => !c);
    if (fatalIdx !== -1) { await showError("Data belum lengkap", `Lengkapi Aktivitas ke-${draft.activities[fatalIdx].no}.`); return; }
    if (!adminSession && !reportRules.allowAnyReportDate && draft.reportDate !== today) { await showError("Tanggal belum diizinkan", "Hanya laporan hari berjalan yang diizinkan."); return; }
    if (activityTimeIssues.some(i => i.endBeforeStart || i.startsBeforePreviousEnd)) { await showError("Jam belum valid", "Periksa kembali urutan jam aktivitas."); return; }

    if (await askConfirmation(duplicateReport ? "Perbarui laporan?" : "Simpan laporan?", duplicateReport ? "Laporan sudah ada dan akan diperbarui." : "Laporan akan disimpan ke database.", duplicateReport ? "Perbarui" : "Simpan")) {
      setSubmitting(true);
      const toast = openProgressToast("Menyimpan laporan", [{ id: "prepare", label: "Menyiapkan" }, { id: "activities", label: "Menyimpan" }, { id: "photos", label: "Memproses" }, { id: "finalize", label: "Finalisasi" }]);
      try {
        await saveReportToDatabase(draft, pendingPhotos, duplicateReport, reportRules, (s, d) => toast.update(s, d));
        toast.close();
        await loadDashboardData();
        setDeviceSubmittedNames(pushDeviceSubmittedName(draft.nama));
        resetDraftState();
        await showSuccess("Laporan tersimpan", isWitaFriday(draft.reportDate) ? "terimakasih atas kerja keras anda. sampai jumpa hari senin." : "terimakasih atas kerja keras anda. sampai jumpa besok");
      } catch (err) {
        console.error(err);
        const msg = (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string") ? err.message : "Gagal menyimpan laporan.";
        await showError("Simpan gagal", msg);
      } finally { setSubmitting(false); }
    }
  }

  async function handleDeleteReport(report: Report) {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    if (await askConfirmation("Hapus laporan?", `Laporan ${report.nama} akan dihapus permanen.`, "Hapus laporan")) {
      setSubmitting(true);
      try {
        await deleteReportFromDatabase(report);
        if (loadedSearchReportId === report.id) resetDraftState();
        await loadDashboardData();
        await showSuccess("Laporan dihapus", "Data sudah dihapus.");
      } catch (err) { console.error(err); await showError("Hapus gagal", "Laporan belum berhasil dihapus."); }
      finally { setSubmitting(false); }
    }
  }

  async function handleRenameReporterProfile(reporter: ReporterDirectoryProfile) {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    const nextName = adminReporterDraftNames[reporter.id]?.trim().toUpperCase() ?? reporter.fullName;
    if (!nextName) { await showError("Nama belum valid", "Nama tidak boleh kosong."); return; }
    if (nextName === reporter.fullName) { await showInfo("Tidak ada perubahan", "Nama belum berubah."); return; }

    if (await askConfirmation("Ubah data pengguna?", `Laporan ${reporter.fullName} akan diubah menjadi ${nextName}.`, "Simpan perubahan")) {
      setAdminSubmitting(true);
      setAdminActiveAction("rename-reporter");
      setAdminActiveItemId(reporter.id);
      try {
        await renameReporterDirectoryProfile(reporter.id, nextName);
        await loadDashboardData();
        await showSuccess("Profil diperbarui", "Nama dan laporannya sudah disesuaikan.");
      } catch (err) { console.error(err); await showError("Rename gagal", "Gagal mengubah profil."); }
      finally { setAdminSubmitting(false); setAdminActiveAction(null); setAdminActiveItemId(null); }
    }
  }

  async function handleDeleteReporterTrace(reporter: ReporterDirectoryProfile) {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    if (await askConfirmation("Hapus jejak pengguna?", `Data ${reporter.fullName} akan dihapus permanen.`, "Hapus permanen")) {
      setAdminSubmitting(true);
      setAdminActiveAction("delete-reporter");
      setAdminActiveItemId(reporter.id);
      try {
        await deleteReporterDirectoryTrace(reporter.id);
        if (draft.nama.trim().toUpperCase() === reporter.fullName) resetDraftState();
        await loadDashboardData();
        await showSuccess("Jejak dihapus", "Data sudah dihapus.");
      } catch (err) { console.error(err); await showError("Hapus gagal", "Gagal menghapus jejak."); }
      finally { setAdminSubmitting(false); setAdminActiveAction(null); setAdminActiveItemId(null); }
    }
  }

  async function handleAdminLogin() {
    if (!adminEmail.trim() || !adminPassword) { await showError("Data tidak lengkap", "Email and password wajib diisi."); return; }
    setAdminSubmitting(true);
    setAdminActiveAction("login");
    try {
      const sess = await signInAdminAccount(adminEmail, adminPassword);
      setAdminSession(sess);
      setAdminEmail(""); 
      setAdminPassword("");
      await showSuccess("Login berhasil", `Selamat datang, ${sess.profile.fullName}.`);
    } catch (err) { console.error(err); await showError("Login gagal", "Periksa email and password."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); }
  }

  async function handleAdminLogout() {
    setAdminSubmitting(true);
    setAdminActiveAction("logout");
    try { await signOutAdminAccount(); setAdminSession(null); await showSuccess("Logout berhasil", "Sesi ditutup."); }
    catch (err) { console.error(err); await showError("Logout gagal", "Sesi belum ditutup."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); }
  }

  function changeAdminRule<K extends keyof ReportRules>(key: K, value: ReportRules[K]) {
    setAdminRuleDraft(c => normalizeReportRules({ ...c, [key]: value }));
  }

  function changeAdminReporterDraftName(reporterId: string, value: string) {
    setAdminReporterDraftNames(c => ({ ...c, [reporterId]: value.toUpperCase() }));
  }

  async function handleSaveAdminRules() {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    setAdminSubmitting(true);
    setAdminActiveAction("save-rules");
    try {
      const saved = await saveReportRulesToDatabase(adminRuleDraft);
      setReportRules(saved);
      setAdminRuleDraft(saved);
      await showSuccess("Rules tersimpan", "Pengaturan diperbarui.");
    } catch (err) { console.error(err); await showError("Simpan rules gagal", "Gagal menyimpan rules."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); }
  }

  function changeExcelTemplateDraft<K extends keyof ExcelTemplateUploadDraft>(key: K, value: ExcelTemplateUploadDraft[K]) {
    setExcelTemplateDraft(c => {
      const n = { ...c, [key]: value };
      if (key === "cacheVersion" || key === "templateDate") {
        const auto = buildAutoExcelTemplateName(c.cacheVersion, c.templateDate);
        if (c.templateName.trim() === "" || c.templateName === auto) {
          n.templateName = buildAutoExcelTemplateName(key === "cacheVersion" ? String(value) : c.cacheVersion, key === "templateDate" ? String(value) : c.templateDate);
        }
      }
      return n;
    });
  }

  function clearExcelTemplateDraftName() { setExcelTemplateDraft(c => ({ ...c, templateName: "" })); }
  function selectExcelTemplateFile(f: File | null) { setSelectedExcelTemplateFile(f); }

  function changeAdminExcelTemplateDraft<K extends keyof ExcelTemplateUploadDraft>(id: string, key: K, value: ExcelTemplateUploadDraft[K]) {
    setAdminExcelTemplateDrafts(c => {
      const d = c[id];
      if (!d) return c;
      return { ...c, [id]: { ...d, [key]: value }};
    });
  }

  async function handleUploadExcelTemplate() {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    if (!selectedExcelTemplateFile) { await showError("File belum dipilih", "Pilih file .xlsx."); return; }
    setExcelTemplateUploading(true);
    try {
      await uploadExcelReportTemplate(selectedExcelTemplateFile, excelTemplateDraft.templateName || buildAutoExcelTemplateName(excelTemplateDraft.cacheVersion, excelTemplateDraft.templateDate), excelTemplateDraft.cacheVersion);
      setExcelTemplateDraft(c => ({ ...c, templateName: buildAutoExcelTemplateName(c.cacheVersion, c.templateDate) }));
      setSelectedExcelTemplateFile(null);
      await loadDashboardData();
      await showSuccess("Template tersimpan", "Berhasil diupload.");
    } catch (err) { console.error(err); await showError("Upload gagal", "Gagal mengupload template."); }
    finally { setExcelTemplateUploading(false); }
  }

  async function handleActivateExcelTemplate(id: string) {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    setAdminSubmitting(true);
    setAdminActiveAction("activate-excel-template");
    setAdminActiveItemId(id);
    try { await activateExcelReportTemplate(id); await loadDashboardData(); await showSuccess("Template aktif", "Berhasil diaktifkan."); }
    catch (err) { console.error(err); await showError("Aktivasi gagal", "Gagal mengaktifkan template."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); setAdminActiveItemId(null); }
  }

  async function handleRenameExcelTemplate(template: ExcelReportTemplate) {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    const d = adminExcelTemplateDrafts[template.id] ?? { templateName: template.templateName, templateDate: template.createdAt.slice(0, 10), cacheVersion: template.cacheVersion };
    const name = d.templateName.trim();
    const ver = d.cacheVersion.trim() || "v1";
    if (name === template.templateName && ver === template.cacheVersion) { await showInfo("Tidak ada perubahan", "Metadata belum berubah."); return; }
    setAdminSubmitting(true);
    setAdminActiveAction("rename-excel-template");
    setAdminActiveItemId(template.id);
    try { await updateExcelReportTemplateMetadata(template.id, name, ver); await loadDashboardData(); await showSuccess("Template diperbarui", "Berhasil disimpan."); }
    catch (err) { console.error(err); await showError("Simpan gagal", "Gagal menyimpan metadata."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); setAdminActiveItemId(null); }
  }

  async function handleDeleteExcelTemplate(template: ExcelReportTemplate) {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    if (await askConfirmation("Hapus template?", `Template ${template.templateName} akan dihapus permanently.`, "Hapus template")) {
      setAdminSubmitting(true);
      setAdminActiveAction("delete-excel-template");
      setAdminActiveItemId(template.id);
      try { await deleteExcelReportTemplate(template); await loadDashboardData(); await showSuccess("Template dihapus", "Berhasil dihapus."); }
      catch (err) { console.error(err); await showError("Hapus gagal", "Gagal menghapus template."); }
      finally { setAdminSubmitting(false); setAdminActiveAction(null); setAdminActiveItemId(null); }
    }
  }

  function changeAdminTemplateApproverDraft<K extends keyof ReportTemplateApproverDraft>(role: ReportTemplateApproverRole, key: K, value: ReportTemplateApproverDraft[K]) {
    setAdminTemplateApproverDrafts(c => ({ ...c, [role]: { ...c[role], [key]: typeof value === "string" ? value.toUpperCase() : value }}));
  }

  async function handleSaveTemplateApproverDefaults() {
    if (!adminSession || !activeReportTemplateConfig) { await showError("Error", "Missing session or config."); return; }
    setAdminSubmitting(true);
    setAdminActiveAction("save-template-approvers");
    try {
      const next = await saveTemplateApproverDefaults(activeReportTemplateConfig.id, adminTemplateApproverDrafts);
      setActiveReportTemplateConfig(next);
      setAdminTemplateApproverDrafts(createDefaultApproverDraftMap(next));
      setDraft(c => (hasMeaningfulDraft(c) || c.nama.trim()) ? c : createEmptyDraft(next));
      await loadDashboardData();
      await showSuccess("Pejabat diperbarui", "Berhasil disimpan.");
    } catch (err) { console.error(err); await showError("Simpan gagal", "Gagal menyimpan pejabat."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); }
  }

  function changeNotificationSettings<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setNotificationSettings(c => ({ ...c, [key]: value }));
  }

  async function handleSaveNotificationSettings() {
    if (!adminSession) { await showError("Akses admin diperlukan", "Silakan login admin."); return; }
    setAdminSubmitting(true);
    setAdminActiveAction("save-notification-settings");
    try {
      const next = await saveNotificationSettingsToDatabase(notificationSettings);
      setNotificationSettings(next);
      setRuntimeNotificationSettings(next);
      persistNotificationSettings(next);
      await showSuccess("Notifikasi diperbarui", "Berhasil disimpan.");
    } catch (err) { console.error(err); await showError("Simpan gagal", "Gagal menyimpan notifikasi."); }
    finally { setAdminSubmitting(false); setAdminActiveAction(null); }
  }

  async function handleReloadDashboardData() { await loadDashboardData(); }

  return {
    view, setView, paperFormat, setPaperFormat, draft, reports, reporterProfiles,
    activeReportTemplateConfig, notificationSettings, excelTemplates, activeExcelTemplate,
    excelTemplateDraft, selectedExcelTemplateFileName: selectedExcelTemplateFile?.name ?? "",
    adminExcelTemplateDrafts, excelTemplateUploading, excelExportingReportId, editLoadingReportId,
    savedNames: deviceSubmittedNames, reporterNames, historyName, setHistoryName,
    historyDate, setHistoryDate, searchName, setSearchName, searchDate, setSearchDate,
    loading, submitting, pendingPreviews, similarName, nameCheckLoading, nameExistsInDirectory,
    reportRules, adminSession, adminEmail, setAdminEmail, adminPassword, setAdminPassword,
    adminAuthLoading, adminSubmitting, adminActiveAction, adminActiveItemId, adminRuleDraft,
    adminTemplateApproverDrafts, adminReporterDraftNames,
    canUseAnyReportDate: Boolean(adminSession) || reportRules.allowAnyReportDate,
    canManageReports: Boolean(adminSession),
    duplicateReport, activityTimeIssues, activityCompletionStates, preview, historyResults,
    searchResult, searchResultLoaded, searchResultCanReload, searchResultNeedsReload, statusRows,
    hasDraftContent, draftSavedAt, draftCacheStatus, searchOpen, setSearchOpen,
    change, changeActivity, addActivity, removeActivity, setActivityFiles, clearActivityFiles,
    restoreActivityFiles, editableOriginalPhotos, handleDeleteReport, handleLoadEdit,
    handleResetDraft, handleReloadDashboardData, handleExport, handlePrint, saveReport,
    handleRemoveSavedName, changeAdminRule, changeNotificationSettings,
    changeAdminTemplateApproverDraft, changeExcelTemplateDraft, clearExcelTemplateDraftName,
    selectExcelTemplateFile, changeAdminExcelTemplateDraft, changeAdminReporterDraftName,
    handleAdminLogin, handleAdminLogout, handleDeleteReporterTrace, handleUploadExcelTemplate,
    handleActivateExcelTemplate, handleRenameExcelTemplate, handleDeleteExcelTemplate,
    handleRenameReporterProfile, handleSaveAdminRules, handleSaveTemplateApproverDefaults,
    handleSaveNotificationSettings, isEditLoading: editLoadingReportId !== null,
  };
}
