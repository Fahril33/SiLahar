import { useEffect, useState, useRef, type CSSProperties } from "react";
import { AdminDashboardView } from "./components/admin-dashboard-view";
import { AppTabs } from "./components/app-tabs";
import { EntryView } from "./components/entry-view";
import { HistoryView } from "./components/history-view";
import { StatusView } from "./components/status-view";
import { ConnectivityBanner } from "./components/connectivity-banner";
import { useConnectivity } from "./hooks/useConnectivity";
import { useReportDashboard } from "./hooks/use-report-dashboard";
import { today } from "./lib/report-draft";
import { showSuccess, showInfo } from "./lib/alerts";

type ThemeMode = "light" | "dark" | "cheerfull";
type NavbarPosition = "top" | "left" | "right";
type NavbarMotion = "to-top" | "to-left" | "to-right";

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M19 14.8A7 7 0 0 1 9.2 5a8.5 8.5 0 1 0 9.8 9.8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheerfullIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 2.8l1.65 4.45 4.75.2-3.72 2.95 1.28 4.58L12 12.35 8.04 14.98l1.28-4.58L5.6 7.45l4.75-.2L12 2.8z" />
      <path d="M6.5 18.5h11" strokeLinecap="round" />
    </svg>
  );
}

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: JSX.Element;
}> = [
  { value: "light", label: "Terang", icon: <SunIcon /> },
  { value: "dark", label: "Gelap", icon: <MoonIcon /> },
  { value: "cheerfull", label: "Cheerfull", icon: <CheerfullIcon /> },
];

function ThemeSwitcher({
  themeMode,
  onChange,
  className = "",
}: {
  themeMode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  className?: string;
}) {
  const activeIndex = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.value === themeMode),
  );
  return (
    <div
      className={`theme-switcher ${className}`.trim()}
      style={{ "--active-theme-index": activeIndex } as CSSProperties}
    >
      <span className="theme-switcher-slider" aria-hidden="true" />
      {THEME_OPTIONS.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={themeMode === value ? "is-active" : ""}
          aria-label={label}
          title={label}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className || "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16L21 21" strokeLinecap="round" />
    </svg>
  );
}

function LayoutIcon(props: {
  position: "top" | "left" | "right";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className || "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.position === "top" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
        </>
      )}
      {props.position === "left" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </>
      )}
      {props.position === "right" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </>
      )}
    </svg>
  );
}

function getNextNavbarPosition(current: NavbarPosition): NavbarPosition {
  if (current === "top") return "left";
  if (current === "left") return "right";
  return "top";
}

function getNavbarMotion(nextPosition: NavbarPosition): NavbarMotion {
  if (nextPosition === "left") return "to-left";
  if (nextPosition === "right") return "to-right";
  return "to-top";
}

function loadThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("silahar:theme-mode");
  if (stored === "comfort" || stored === "cheerfull") return "cheerfull";
  return stored === "dark" ? "dark" : "light";
}

export default function App() {
  const dashboard = useReportDashboard();
  const { isOnline, status } = useConnectivity();
  const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode);
  const [navbarPosition, setNavbarPosition] = useState<NavbarPosition>("top");
  const [navbarMotion, setNavbarMotion] = useState<NavbarMotion>("to-top");
  const [navbarMotionKey, setNavbarMotionKey] = useState(0);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 1024px)").matches,
  );
  const previousConnectivityRef = useRef<boolean>(isOnline);

  useEffect(() => {
    if (previousConnectivityRef.current === isOnline) return;

    if (isOnline) {
      void showSuccess(
        "Terhubung Kembali",
        "Sinkronisasi data berhasil dipulihkan.",
      );
    } else {
      void showInfo(
        "Koneksi Terputus",
        status === "offline"
          ? "Cek koneksi internet Anda."
          : "Basis data sedang mengalami gangguan.",
      );
    }

    previousConnectivityRef.current = isOnline;
  }, [isOnline, status]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("silahar:theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktopLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (dashboard.view !== "entry" || !isDesktopLayout)
      setNavbarPosition("top");
  }, [dashboard.view, isDesktopLayout]);

  const canMoveNavbar = dashboard.view === "entry" && isDesktopLayout;

  function handleMoveNavbar() {
    if (!canMoveNavbar) return;
    const next = getNextNavbarPosition(navbarPosition);
    setNavbarMotion(getNavbarMotion(next));
    setNavbarMotionKey((k) => k + 1);
    setNavbarPosition(next);
  }

  const navbarMotionLine = (
    <div className="navbar-motion-track" aria-hidden="true">
      <span
        key={navbarMotionKey}
        className={`navbar-motion-line navbar-motion-line-${navbarMotion}`}
      />
    </div>
  );

  const compactNavbar = (
    <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-panel)]/50 p-3 backdrop-blur-md">
      {navbarMotionLine}
      <div className="flex flex-1 items-center gap-2 overflow-x-auto min-w-0 hide-scrollbar">
        {dashboard.view === "entry" && (
          <button
            type="button"
            onClick={() => dashboard.setSearchOpen(!dashboard.searchOpen)}
            className={`flex shrink-0 items-center justify-center h-[38px] px-3 rounded-[10px] text-sm font-medium transition-colors ${dashboard.searchOpen ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" : "bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-soft)]"}`}
            title="Cari laporan"
          >
            <SearchIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <AppTabs view={dashboard.view} onChange={dashboard.setView} />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <ThemeSwitcher
          themeMode={themeMode}
          onChange={setThemeMode}
          className="hidden shrink-0 sm:flex"
        />
        <button
          type="button"
          onClick={handleMoveNavbar}
          disabled={!canMoveNavbar}
          className={`hidden lg:flex shrink-0 h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] ${canMoveNavbar ? "hover:bg-[var(--surface-hover)]" : "cursor-not-allowed opacity-40"}`}
          title="Pindah posisi Navbar"
        >
          <LayoutIcon position={navbarPosition} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <ConnectivityBanner />
      <div className="mx-auto flex max-w-[1760px] flex-col gap-4">
        {navbarPosition === "top" && (
          <header className="panel-glass relative flex flex-col gap-3 overflow-hidden rounded-[24px] px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            {navbarMotionLine}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                  SiLahar
                </h1>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] sm:text-sm">
                  Sistem laporan harian tim reaksi cepat
                </p>
              </div>
              <ThemeSwitcher
                themeMode={themeMode}
                onChange={setThemeMode}
                className="shrink-0 lg:hidden"
              />
            </div>
            <div className="flex flex-row items-center gap-2 lg:min-w-0 lg:gap-3">
              {dashboard.view === "entry" && (
                <button
                  type="button"
                  onClick={() => dashboard.setSearchOpen(!dashboard.searchOpen)}
                  className={`hidden lg:flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-medium transition-colors ${dashboard.searchOpen ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" : "bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-soft)]"}`}
                >
                  <SearchIcon /> Cari laporan
                </button>
              )}
              <div className="min-w-0 flex-1 lg:flex-none">
                <AppTabs view={dashboard.view} onChange={dashboard.setView} />
              </div>
              {dashboard.view === "entry" && (
                <button
                  type="button"
                  onClick={() => dashboard.setSearchOpen(!dashboard.searchOpen)}
                  className={`lg:hidden flex items-center justify-center shrink-0 h-[42px] px-4 rounded-[12px] text-sm font-medium transition-colors ${dashboard.searchOpen ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" : "bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-soft)]"}`}
                  aria-label="Cari laporan"
                >
                  <SearchIcon />
                </button>
              )}
              <ThemeSwitcher
                themeMode={themeMode}
                onChange={setThemeMode}
                className="hidden shrink-0 lg:flex"
              />
              <button
                type="button"
                onClick={handleMoveNavbar}
                disabled={!canMoveNavbar}
                className={`hidden lg:flex shrink-0 h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] ${canMoveNavbar ? "hover:bg-[var(--surface-hover)]" : "cursor-not-allowed opacity-40"}`}
                title="Pindah posisi Navbar"
              >
                <LayoutIcon position={navbarPosition} />
              </button>
            </div>
          </header>
        )}

        {dashboard.view === "entry" ? (
          <EntryView
            draft={dashboard.draft}
            savedNames={dashboard.savedNames}
            reporterNames={dashboard.reporterNames}
            searchName={dashboard.searchName}
            setSearchName={dashboard.setSearchName}
            searchDate={dashboard.searchDate}
            setSearchDate={dashboard.setSearchDate}
            searchResult={dashboard.searchResult}
            searchResultLoaded={dashboard.searchResultLoaded}
            searchResultCanReload={dashboard.searchResultCanReload}
            searchResultNeedsReload={dashboard.searchResultNeedsReload}
            similarName={dashboard.similarName}
            nameCheckLoading={dashboard.nameCheckLoading}
            nameExistsInDirectory={dashboard.nameExistsInDirectory}
            reportRules={dashboard.reportRules}
            canUseAnyReportDate={dashboard.canUseAnyReportDate}
            activityTimeIssues={dashboard.activityTimeIssues}
            activityCompletionStates={dashboard.activityCompletionStates}
            duplicateReport={dashboard.duplicateReport}
            pendingPreviews={dashboard.pendingPreviews}
            preview={dashboard.preview}
            submitting={dashboard.submitting}
            isEditLoading={dashboard.isEditLoading}
            excelExportingReportId={dashboard.excelExportingReportId}
            hasDraftContent={dashboard.hasDraftContent}
            draftSavedAt={dashboard.draftSavedAt}
            draftCacheStatus={dashboard.draftCacheStatus}
            searchOpen={dashboard.searchOpen}
            onChange={dashboard.change}
            onChangeActivity={dashboard.changeActivity}
            onAddActivity={dashboard.addActivity}
            onRemoveActivity={dashboard.removeActivity}
            onSetActivityFiles={dashboard.setActivityFiles}
            onClearActivityFiles={dashboard.clearActivityFiles}
            onRestoreActivityFiles={dashboard.restoreActivityFiles}
            editableOriginalPhotos={dashboard.editableOriginalPhotos}
            onHandleLoadEdit={dashboard.handleLoadEdit}
            onHandleExport={dashboard.handleExport}
            onHandlePrint={dashboard.handlePrint}
            onHandleResetDraft={dashboard.handleResetDraft}
            onSaveReport={dashboard.saveReport}
            onHandleRemoveSavedName={dashboard.handleRemoveSavedName}
            paperFormat={dashboard.paperFormat}
            setPaperFormat={dashboard.setPaperFormat}
            navbarPosition={navbarPosition}
            navbarSlot={navbarPosition !== "top" ? compactNavbar : null}
            isOnline={isOnline}
          />
        ) : null}

        {dashboard.view === "history" ? (
          <HistoryView
            loading={dashboard.loading}
            historyName={dashboard.historyName}
            setHistoryName={dashboard.setHistoryName}
            historyDate={dashboard.historyDate}
            setHistoryDate={dashboard.setHistoryDate}
            historyResults={dashboard.historyResults}
            onHandleLoadEdit={dashboard.handleLoadEdit}
            onHandleExport={dashboard.handleExport}
            onHandlePrint={dashboard.handlePrint}
            onHandleDeleteReport={dashboard.handleDeleteReport}
            excelExportingReportId={dashboard.excelExportingReportId}
            editLoadingReportId={dashboard.editLoadingReportId}
            today={today}
            canUseAnyReportDate={dashboard.canUseAnyReportDate}
            canManageReports={dashboard.canManageReports}
            paperFormat={dashboard.paperFormat}
            setPaperFormat={dashboard.setPaperFormat}
            onReload={dashboard.handleReloadDashboardData}
          />
        ) : null}

        {dashboard.view === "status" ? (
          <StatusView
            historyDate={dashboard.historyDate}
            setHistoryDate={dashboard.setHistoryDate}
            statusRows={dashboard.statusRows}
            loading={dashboard.loading}
            onReload={dashboard.handleReloadDashboardData}
          />
        ) : null}

        {dashboard.view === "admin" ? (
          <AdminDashboardView
            adminSession={dashboard.adminSession}
            adminEmail={dashboard.adminEmail}
            setAdminEmail={dashboard.setAdminEmail}
            adminPassword={dashboard.adminPassword}
            setAdminPassword={dashboard.setAdminPassword}
            adminAuthLoading={dashboard.adminAuthLoading}
            loading={dashboard.loading}
            adminSubmitting={dashboard.adminSubmitting}
            adminActiveAction={dashboard.adminActiveAction}
            adminActiveItemId={dashboard.adminActiveItemId}
            adminRuleDraft={dashboard.adminRuleDraft}
            activeReportTemplateConfig={dashboard.activeReportTemplateConfig}
            notificationSettings={dashboard.notificationSettings}
            adminTemplateApproverDrafts={dashboard.adminTemplateApproverDrafts}
            excelTemplates={dashboard.excelTemplates}
            activeExcelTemplate={dashboard.activeExcelTemplate}
            excelTemplateDraft={dashboard.excelTemplateDraft}
            adminExcelTemplateDrafts={dashboard.adminExcelTemplateDrafts}
            selectedExcelTemplateFileName={
              dashboard.selectedExcelTemplateFileName
            }
            excelTemplateUploading={dashboard.excelTemplateUploading}
            reports={dashboard.reports}
            reporterProfiles={dashboard.reporterProfiles}
            adminReporterDraftNames={dashboard.adminReporterDraftNames}
            onChangeAdminRule={dashboard.changeAdminRule}
            onChangeExcelTemplateDraft={dashboard.changeExcelTemplateDraft}
            onClearExcelTemplateDraftName={
              dashboard.clearExcelTemplateDraftName
            }
            onSelectExcelTemplateFile={dashboard.selectExcelTemplateFile}
            onChangeAdminExcelTemplateDraft={
              dashboard.changeAdminExcelTemplateDraft
            }
            onChangeAdminReporterDraftName={
              dashboard.changeAdminReporterDraftName
            }
            onHandleAdminLogin={dashboard.handleAdminLogin}
            onHandleAdminLogout={dashboard.handleAdminLogout}
            onHandleSaveAdminRules={dashboard.handleSaveAdminRules}
            onChangeNotificationSettings={dashboard.changeNotificationSettings}
            onHandleSaveNotificationSettings={
              dashboard.handleSaveNotificationSettings
            }
            onChangeAdminTemplateApproverDraft={
              dashboard.changeAdminTemplateApproverDraft
            }
            onHandleSaveTemplateApproverDefaults={
              dashboard.handleSaveTemplateApproverDefaults
            }
            onHandleUploadExcelTemplate={dashboard.handleUploadExcelTemplate}
            onHandleActivateExcelTemplate={
              dashboard.handleActivateExcelTemplate
            }
            onHandleRenameExcelTemplate={dashboard.handleRenameExcelTemplate}
            onHandleDeleteExcelTemplate={dashboard.handleDeleteExcelTemplate}
            onHandleRenameReporterProfile={
              dashboard.handleRenameReporterProfile
            }
            onHandleDeleteReporterTrace={dashboard.handleDeleteReporterTrace}
            isOnline={isOnline}
          />
        ) : null}
      </div>
    </div>
  );
}
