import { useEffect, useState } from "react";
import { AppTabs } from "./components/app-tabs";
import { EntryView } from "./components/entry-view";
import { HistoryView } from "./components/history-view";
import { StatusView } from "./components/status-view";
import { useReportDashboard } from "./hooks/use-report-dashboard";
import { today } from "./lib/report-draft";

type ThemeMode = "light" | "dark" | "comfort";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M19 14.8A7 7 0 0 1 9.2 5a8.5 8.5 0 1 0 9.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ComfortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" />
      <path d="M8 9h8M8 12h5M8 15h7" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className || "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16L21 21" strokeLinecap="round" />
    </svg>
  );
}

function LayoutIcon(props: { position: "top" | "left" | "right", className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className || "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function loadThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem("silahar:theme-mode");
  return stored === "dark" || stored === "comfort" ? stored : "light";
}

export default function App() {
  const dashboard = useReportDashboard();
  const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode);
  const [navbarPosition, setNavbarPosition] = useState<"top" | "left" | "right">("top");

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("silahar:theme-mode", themeMode);
  }, [themeMode]);

  const compactNavbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-[var(--border-soft)] bg-[var(--surface-panel)]/50 backdrop-blur-md">
      <div className="flex flex-1 items-center gap-2 overflow-x-auto min-w-0 hide-scrollbar">
        {dashboard.view === "entry" && (
          <button
            type="button"
            onClick={() => dashboard.setSearchOpen(!dashboard.searchOpen)}
            className={`flex shrink-0 items-center justify-center h-[38px] px-3 rounded-[10px] text-sm font-medium transition-colors ${
              dashboard.searchOpen 
                ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" 
                : "bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-soft)]"
            }`}
            title="Cari laporan"
          >
            <SearchIcon />
          </button>
        )}
        <div className="flex-1 min-w-0 shrink-0">
          <AppTabs view={dashboard.view} onChange={dashboard.setView} />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <div className="theme-switcher shrink-0 flex hidden sm:flex">
          {[
            { value: "light", label: "Terang", icon: <SunIcon /> },
            { value: "dark", label: "Gelap", icon: <MoonIcon /> },
            { value: "comfort", label: "Comfort", icon: <ComfortIcon /> },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setThemeMode(value as ThemeMode)}
              className={themeMode === value ? "is-active" : ""}
              aria-label={label as string}
              title={label as string}
            >
              {icon}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNavbarPosition((p) => p === "top" ? "left" : p === "left" ? "right" : "top")}
          className="hidden lg:flex shrink-0 h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-soft)] hover:bg-[var(--surface-hover)]"
          title="Pindah posisi Navbar"
        >
          <LayoutIcon position={navbarPosition} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1760px] flex-col gap-4">
        {navbarPosition === "top" && (
          <header className="panel-glass flex flex-col gap-3 rounded-[24px] px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                  SiLahar
                </h1>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] sm:text-sm">
                  Sistem laporan harian tim reaksi cepat
                </p>
              </div>
              <div className="theme-switcher shrink-0 lg:hidden">
                {[
                  { value: "light", label: "Terang", icon: <SunIcon /> },
                  { value: "dark", label: "Gelap", icon: <MoonIcon /> },
                  { value: "comfort", label: "Comfort", icon: <ComfortIcon /> },
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setThemeMode(value as ThemeMode)}
                    className={themeMode === value ? "is-active" : ""}
                    aria-label={label as string}
                    title={label as string}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-row items-center gap-2 lg:min-w-0 lg:gap-3">
              {dashboard.view === "entry" && (
                <button
                  type="button"
                  onClick={() => dashboard.setSearchOpen(!dashboard.searchOpen)}
                  className={`hidden lg:flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-medium transition-colors ${
                    dashboard.searchOpen 
                      ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" 
                      : "bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-soft)]"
                  }`}
                >
                  <SearchIcon /> Cari laporan
                </button>
              )}

              <div className="flex-1 lg:flex-none">
                <AppTabs view={dashboard.view} onChange={dashboard.setView} />
              </div>

              {dashboard.view === "entry" && (
                <button
                  type="button"
                  onClick={() => dashboard.setSearchOpen(!dashboard.searchOpen)}
                  className={`lg:hidden flex items-center justify-center shrink-0 h-[42px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
                    dashboard.searchOpen 
                      ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" 
                      : "bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-soft)]"
                  }`}
                  aria-label="Cari laporan"
                >
                  <SearchIcon />
                </button>
              )}

              <div className="theme-switcher hidden shrink-0 lg:flex">
                {[
                  { value: "light", label: "Terang", icon: <SunIcon /> },
                  { value: "dark", label: "Gelap", icon: <MoonIcon /> },
                  { value: "comfort", label: "Comfort", icon: <ComfortIcon /> },
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setThemeMode(value as ThemeMode)}
                    className={themeMode === value ? "is-active" : ""}
                    aria-label={label as string}
                    title={label as string}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setNavbarPosition((p) => p === "top" ? "left" : p === "left" ? "right" : "top")}
                className="hidden lg:flex shrink-0 h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-soft)] hover:bg-[var(--surface-hover)]"
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
            activityTimeIssues={dashboard.activityTimeIssues}
            duplicateToday={dashboard.duplicateToday}
            pendingPreviews={dashboard.pendingPreviews}
            preview={dashboard.preview}
            submitting={dashboard.submitting}
            hasDraftContent={dashboard.hasDraftContent}
            draftSavedAt={dashboard.draftSavedAt}
            draftCacheStatus={dashboard.draftCacheStatus}
            searchOpen={dashboard.searchOpen}
            setSearchOpen={dashboard.setSearchOpen}
            onChange={dashboard.change}
            onChangeActivity={dashboard.changeActivity}
            onAddActivity={dashboard.addActivity}
            onRemoveActivity={dashboard.removeActivity}
            onSetActivityFiles={dashboard.setActivityFiles}
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
            today={today}
            paperFormat={dashboard.paperFormat}
            setPaperFormat={dashboard.setPaperFormat}
          />
        ) : null}

        {dashboard.view === "status" ? (
          <StatusView
            historyDate={dashboard.historyDate}
            setHistoryDate={dashboard.setHistoryDate}
            statusRows={dashboard.statusRows}
            loading={dashboard.loading}
          />
        ) : null}
      </div>
    </div>
  );
}
