
import { useState } from "react";
import { AutocompleteInput } from "./autocomplete-input";
import bpbdIcon from "../assets/image/icon-bpbd.png";

type LoginViewProps = {
  reporterNames: string[];
  userSubmitting: boolean;
  onUserLogin: (name: string, pass: string) => Promise<void>;
  onUserRegister: (name: string, pass: string) => Promise<void>;
  adminSubmitting: boolean;
  onAdminLogin: () => Promise<void>;
  adminEmail: string;
  setAdminEmail: (val: string) => void;
  adminPassword: string;
  setAdminPassword: (val: string) => void;
};

type AuthTab = "user-login" | "user-register" | "admin-login";

export function LoginView(props: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>("user-login");
  const [userName, setUserName] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("silahar:last-login-username") || "";
    }
    return "";
  });
  const [userPassword, setUserPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showUserPass, setShowUserPass] = useState(false);
  const [showRegisterPass, setShowRegisterPass] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "user-login") {
      await props.onUserLogin(userName, userPassword);
    } else if (activeTab === "user-register") {
      await props.onUserRegister(registerName, registerPassword);
    } else {
      await props.onAdminLogin();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--surface-muted)] px-4 py-12 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--info-soft)] blur-[120px] pointer-events-none" />

      <div className="panel-glass w-full max-w-md p-8 rounded-[32px] shadow-xl relative z-10 border border-[var(--border-soft)]">
        {/* Header Logo & Title */}
        <div className="text-center mb-8">
          <img src={bpbdIcon} alt="Logo BPBD" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Sistem Laporan Harian</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">TRC-PUSADALOPS BPBD Provinsi Sulawesi Tengah

          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[var(--surface-muted)] p-1 rounded-xl mb-6 border border-[var(--border-soft)]">
          <button
            type="button"
            onClick={() => setActiveTab("user-login")}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === "user-login"
                ? "bg-[var(--surface-app)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Masuk Petugas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("user-register")}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === "user-register"
                ? "bg-[var(--surface-app)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Daftar Baru
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin-login")}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === "admin-login"
                ? "bg-[var(--surface-app)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Masuk Admin
          </button>
        </div>

        {/* Auth Form */}
        {activeTab === "user-login" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Nama Lengkap Petugas</label>
              <AutocompleteInput
                value={userName}
                onChange={setUserName}
                options={props.reporterNames}
                placeholder="Ketik/Pilih nama lengkap Anda"
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition shadow-inner"
                emptyMessage="Nama belum terdaftar. Gunakan tab 'Daftar Baru'."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Password</label>
              <div className="relative flex items-center">
                <input
                  type={showUserPass ? "text" : "password"}
                  id="user-login-password"
                  name="user-login-password"
                  autoComplete="current-password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  required
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl pl-4 pr-11 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowUserPass(!showUserPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none transition cursor-pointer bg-transparent border-none p-1 flex items-center justify-center"
                  title={showUserPass ? "Sembunyikan sandi" : "Tampilkan sandi"}
                >
                  {showUserPass ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] mt-1.5 font-semibold ml-1">
                * Password bawaan: <strong className="text-[var(--text-primary)]">123123123</strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={props.userSubmitting}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg focus:outline-none flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {props.userSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </>
              ) : (
                "Masuk Petugas"
              )}
            </button>
          </form>
        )}

        {activeTab === "user-register" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Nama Lengkap Petugas Baru</label>
              <input
                type="text"
                id="user-register-name"
                name="user-register-name"
                autoComplete="username"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="Masukkan nama lengkap baru Anda"
                required
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Password Akun</label>
              <div className="relative flex items-center">
                <input
                  type={showRegisterPass ? "text" : "password"}
                  id="user-register-password"
                  name="user-register-password"
                  autoComplete="new-password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Password baru (bawaan: 123123123)"
                  required
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl pl-4 pr-11 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPass(!showRegisterPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none transition cursor-pointer bg-transparent border-none p-1 flex items-center justify-center"
                  title={showRegisterPass ? "Sembunyikan sandi" : "Tampilkan sandi"}
                >
                  {showRegisterPass ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={props.userSubmitting}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg focus:outline-none flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {props.userSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </>
              ) : (
                "Daftar & Masuk"
              )}
            </button>
          </form>
        )}

        {activeTab === "admin-login" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Email Admin</label>
              <input
                type="email"
                id="admin-login-email"
                name="admin-login-email"
                autoComplete="email"
                value={props.adminEmail}
                onChange={(e) => props.setAdminEmail(e.target.value)}
                placeholder="admin@bpbd.com"
                required
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Password Admin</label>
              <div className="relative flex items-center">
                <input
                  type={showAdminPass ? "text" : "password"}
                  id="admin-login-password"
                  name="admin-login-password"
                  autoComplete="current-password"
                  value={props.adminPassword}
                  onChange={(e) => props.setAdminPassword(e.target.value)}
                  placeholder="Masukkan password admin"
                  required
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-soft)] focus:border-purple-500 rounded-xl pl-4 pr-11 py-3 text-sm focus:outline-none transition shadow-inner text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none transition cursor-pointer bg-transparent border-none p-1 flex items-center justify-center"
                  title={showAdminPass ? "Sembunyikan sandi" : "Tampilkan sandi"}
                >
                  {showAdminPass ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={props.adminSubmitting}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg focus:outline-none flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {props.adminSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </>
              ) : (
                "Masuk Admin"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
