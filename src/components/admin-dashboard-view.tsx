import { useEffect, useRef, useState } from "react";
import { askConfirmation } from "../lib/alerts";
import type { AdminDashboardViewProps } from "./admin/types";
import { AdminLoadingOverlay, AdminLoginCard, AdminSessionCard } from "./admin/shared";
import { OperationalSettingsPanel } from "./admin/operational-settings-panel";
import { TeamSettingsPanel } from "./admin/team-settings-panel";
import { ReporterManagementPanel } from "./admin/reporter-management-panel";
import { DocumentTemplatePanel } from "./admin/document-template-panel";
import { SoundSettingsPanel } from "./admin/sound-settings-panel";
import { BulkExportPanel } from "./admin/bulk-export-panel";
import { BulkUploadPanel } from "./admin/bulk-upload-panel";
import { UserProfilePanel } from "./admin/user-profile-panel";
import { MediaSettingsPanel } from "./admin/media-settings-panel";
import { DatabaseMigrationPanel } from "./admin/database-migration-panel";
import { SettingsNavigation, getSettingsSection, loadSettingsSection, type AdminSection } from "./admin/settings-navigation";
import "../styles/admin-settings.css";

export function AdminDashboardView(props: AdminDashboardViewProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>(loadSettingsSection);
  const [hasUnsavedHeaders, setHasUnsavedHeaders] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const contentHeading = useRef<HTMLHeadingElement>(null);
  const currentSection = getSettingsSection(activeSection);
  const isAdmin = Boolean(props.adminSession && !props.userSession);

  useEffect(() => {
    window.localStorage.setItem("silahar:admin-active-section", activeSection);
  }, [activeSection]);

  async function navigate(section: AdminSection) {
    if (section === activeSection || mediaBusy) return;
    if (hasUnsavedHeaders && section !== "header" && section !== "teams") {
      const leave = await askConfirmation(
        "Tinggalkan perubahan kop?",
        "Perubahan kop laporan belum disimpan. Meninggalkan bagian ini akan membuang perubahan tersebut.",
        "Tinggalkan perubahan",
      );
      if (!leave) return;
    }
    setActiveSection(section);
    requestAnimationFrame(() => contentHeading.current?.focus({ preventScroll: true }));
  }

  return (
    <section className={isAdmin ? "admin-settings" : "panel-glass rounded-[32px] p-4 sm:p-6"}>
      <header className={isAdmin ? "settings-page-header" : "mb-6 flex flex-wrap items-center justify-between gap-4"}>
        <div className="min-w-0">
          <p className="settings-eyebrow">{props.userSession ? "Akun saya" : "Administrasi"}</p>
          <h2 className="settings-page-title">{props.userSession ? "Profil & unduh laporan" : "Pengaturan"}</h2>
          {isAdmin && <p className="settings-hint">Kelola operasional, dokumen, dan data SiLahar.</p>}
        </div>
        {props.adminSession && (
          <AdminSessionCard
            adminSession={props.adminSession}
            adminSubmitting={props.adminSubmitting || mediaBusy}
            adminActiveAction={props.adminActiveAction}
            onHandleAdminLogout={props.onHandleAdminLogout}
          />
        )}
      </header>

      {props.adminAuthLoading ? <AdminLoadingOverlay /> : props.userSession ? (
        <UserProfilePanel
          userSession={props.userSession}
          userSubmitting={props.userSubmitting || false}
          onUserUpdateProfile={props.onUserUpdateProfile || (async () => { })}
          onUserLogout={props.onUserLogout || (async () => { })}
          reports={props.reports}
          bulkExporting={props.bulkExporting}
          onHandleBulkExport={props.onHandleBulkExport}
          onHandleDownloadDeviceBackupExcel={props.onHandleDownloadDeviceBackupExcel}
          onHandleDownloadDeviceBackupJson={props.onHandleDownloadDeviceBackupJson}
          deviceBackupExporting={props.deviceBackupExporting}
        />
      ) : !props.adminSession ? <AdminLoginCard {...props} /> : (
        <div className="settings-layout">
          <aside className="settings-sidebar">
            <SettingsNavigation activeSection={activeSection} onChange={navigate} disabled={mediaBusy} />
          </aside>
          <div className="settings-content" id="admin-settings-content">
            <div className="settings-section-heading">
              <h3 tabIndex={-1} ref={contentHeading}>{currentSection.label}</h3>
              <p className="settings-hint">{currentSection.description}</p>
            </div>
            {activeSection === "rules" && <OperationalSettingsPanel {...props} />}
            {activeSection === "reporters" && <ReporterManagementPanel {...props} />}
            {(activeSection === "header" || activeSection === "teams") && <TeamSettingsPanel {...props} section={activeSection} onDirtyChange={setHasUnsavedHeaders} />}
            {(activeSection === "signatures" || activeSection === "excel") && <DocumentTemplatePanel {...props} section={activeSection} />}
            {activeSection === "sounds" && <SoundSettingsPanel {...props} />}
            {activeSection === "media" && (
              <MediaSettingsPanel
                adminSession={props.adminSession}
                reports={props.reports}
                onBusyChange={setMediaBusy}
                onRefreshReports={props.onReloadReports}
              />
            )}
            {activeSection === "bulk-export" && (
              <BulkExportPanel
                reports={props.reports}
                bulkExporting={props.bulkExporting}
                onHandleBulkExport={props.onHandleBulkExport}
                onHandleDownloadDeviceBackupExcel={props.onHandleDownloadDeviceBackupExcel}
                onHandleDownloadDeviceBackupJson={props.onHandleDownloadDeviceBackupJson}
                deviceBackupExporting={props.deviceBackupExporting}
              />
            )}
            {activeSection === "bulk-upload" && (
              <BulkUploadPanel
                reports={props.reports}
                onHandleBulkUploadDeviceBackup={props.onHandleBulkUploadDeviceBackup}
                deviceBackupBulkUploading={props.deviceBackupBulkUploading}
                onRefreshReports={props.onReloadReports}
              />
            )}
            {activeSection === "migration" && (
              <DatabaseMigrationPanel
                adminSession={props.adminSession}
                onReloadReports={props.onReloadReports}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
