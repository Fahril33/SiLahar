export const SETTINGS_GROUPS = [
  {
    label: "Umum",
    items: [
      { id: "rules", label: "Aturan laporan", description: "Atur tanggal pengisian, batas foto, dan awal operasional sistem.", icon: "M4 7h16M4 17h16M8 4v6M16 14v6" },
      { id: "reporters", label: "Pengguna", description: "Kelola akun petugas dan lihat riwayat pengisian laporannya.", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
      { id: "sounds", label: "Notifikasi", description: "Kelola suara notifikasi yang berlaku untuk seluruh pengguna.", icon: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" },
    ],
  },
  {
    label: "Dokumen",
    items: [
      { id: "teams", label: "Tim & pejabat", description: "Kelola identitas tim, koordinator, dan pejabat pengesah laporan.", icon: "M3 21V7l9-4 9 4v14M3 21h18M8 10v7M12 10v7M16 10v7" },
      { id: "header", label: "Kop laporan", description: "Sesuaikan susunan kop dokumen untuk setiap tim.", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h6" },
      { id: "signatures", label: "Tanda tangan", description: "Kelola gambar tanda tangan pejabat untuk dokumen laporan.", icon: "m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5" },
      { id: "excel", label: "Template Excel", description: "Unggah dan tentukan template yang digunakan untuk ekspor Excel.", icon: "M4 3h16v18H4zM4 9h16M10 3v18M4 15h16" },
    ],
  },
  {
    label: "Data & cadangan",
    items: [
      { id: "media", label: "Media gambar", description: "Audit foto dan tanda tangan, kelola arsip, dan bersihkan berkas yang tidak terpakai.", icon: "M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0" },
      { id: "bulk-export", label: "Unduh laporan", description: "Pilih laporan dan aktivitas, lalu unduh dalam format yang diperlukan.", icon: "M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" },
      { id: "bulk-upload", label: "Cadangan data", description: "Kelola cadangan perangkat dan pulihkan laporan ke database.", icon: "M4 3h16v6H4zM4 15h16v6H4zM8 6h.01M8 18h.01M12 9v6" },
      { id: "migration", label: "Migrasi database", description: "Salin struktur data sistem, akun pengguna, dan pengaturan dari database lama ke database baru dengan UUID identik.", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
    ],
  },
] as const;

export type AdminSection = typeof SETTINGS_GROUPS[number]["items"][number]["id"];

export function getSettingsSection(id: AdminSection) {
  return SETTINGS_GROUPS.flatMap((group) => [...group.items]).find((item) => item.id === id)!;
}

export function loadSettingsSection(): AdminSection {
  if (typeof window === "undefined") return "rules";
  const stored = window.localStorage.getItem("silahar:admin-active-section");
  // Preserve the previous template section when migrating to the flatter navigation.
  if (stored === "templates") return "signatures";
  return SETTINGS_GROUPS.some((group) => group.items.some((item) => item.id === stored))
    ? stored as AdminSection
    : "rules";
}

export function SettingsNavigation(props: {
  activeSection: AdminSection;
  onChange: (section: AdminSection) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="settings-mobile-navigation">
        <label htmlFor="settings-section" className="settings-label">Bagian pengaturan</label>
        <select id="settings-section" value={props.activeSection} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value as AdminSection)} className="field-input">
          {SETTINGS_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <nav className="settings-navigation" aria-label="Pengaturan admin">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.label} className="settings-navigation-group">
            <p>{group.label}</p>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={props.disabled}
                aria-current={props.activeSection === item.id ? "page" : undefined}
                aria-controls="admin-settings-content"
                onClick={() => props.onChange(item.id)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
