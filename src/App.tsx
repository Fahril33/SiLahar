import { AppTabs } from "./components/app-tabs";
import { EntryView } from "./components/entry-view";
import { HistoryView } from "./components/history-view";
import { StatusView } from "./components/status-view";
import { useReportDashboard } from "./hooks/use-report-dashboard";
import { today } from "./lib/report-draft";

export default function App() {
  const dashboard = useReportDashboard();

  return (
    <div className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AppTabs view={dashboard.view} onChange={dashboard.setView} />

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
            onChange={dashboard.change}
            onChangeActivity={dashboard.changeActivity}
            onAddActivity={dashboard.addActivity}
            onRemoveActivity={dashboard.removeActivity}
            onSetActivityFiles={dashboard.setActivityFiles}
            onHandleLoadEdit={dashboard.handleLoadEdit}
            onHandleExport={dashboard.handleExport}
            onHandleResetDraft={dashboard.handleResetDraft}
            onSaveReport={dashboard.saveReport}
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
            today={today}
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
