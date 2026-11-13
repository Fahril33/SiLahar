import { useState, useEffect } from "react";
import type {
  DatabasePeriodRoutingConfig,
  DatabasePeriodRule,
  DatabaseTargetAccount,
} from "../../types/database-routing";
import {
  fetchDatabasePeriodRouting,
  saveDatabasePeriodRouting,
  DEFAULT_DATABASE_PERIOD_ROUTING,
} from "../../lib/database-routing-service";
import { supabaseUrl, legacySupabaseUrl } from "../../lib/supabase";
import { showError, showSuccess } from "../../lib/alerts";
import { SpinnerIcon } from "./shared";

export function DatabasePeriodRoutingSubpanel(props: {
  onReloadReports?: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<DatabasePeriodRoutingConfig>(DEFAULT_DATABASE_PERIOD_ROUTING);

  // Form state for editing or creating a rule
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleStartDate, setRuleStartDate] = useState("");
  const [ruleEndDate, setRuleEndDate] = useState("");
  const [ruleTarget, setRuleTarget] = useState<DatabaseTargetAccount>("primary");
  const [ruleDesc, setRuleDesc] = useState("");

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetchDatabasePeriodRouting();
      setConfig(res);
    } catch (err: any) {
      console.warn("Gagal memuat aturan routing:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  function handleOpenCreateRule() {
    setEditingRuleId("new");
    setRuleName("");
    setRuleStartDate("");
    setRuleEndDate("");
    setRuleTarget("primary");
    setRuleDesc("");
  }

  function handleOpenEditRule(rule: DatabasePeriodRule) {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleStartDate(rule.startDate);
    setRuleEndDate(rule.endDate);
    setRuleTarget(rule.targetAccount);
    setRuleDesc(rule.description || "");
  }

  function handleCancelEdit() {
    setEditingRuleId(null);
  }

  function handleSaveRule() {
    if (!ruleName.trim()) {
      void showError("Validasi Gagal", "Nama aturan wajib diisi.");
      return;
    }

    if (editingRuleId === "new") {
      const newRule: DatabasePeriodRule = {
        id: `rule-${Date.now()}`,
        name: ruleName.trim(),
        startDate: ruleStartDate,
        endDate: ruleEndDate,
        targetAccount: ruleTarget,
        description: ruleDesc.trim(),
        enabled: true,
      };
      setConfig((prev) => ({
        ...prev,
        rules: [...prev.rules, newRule],
      }));
    } else if (editingRuleId) {
      setConfig((prev) => ({
        ...prev,
        rules: prev.rules.map((r) =>
          r.id === editingRuleId
            ? {
                ...r,
                name: ruleName.trim(),
                startDate: ruleStartDate,
                endDate: ruleEndDate,
                targetAccount: ruleTarget,
                description: ruleDesc.trim(),
              }
            : r,
        ),
      }));
    }

    setEditingRuleId(null);
  }

  function handleDeleteRule(id: string) {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
    }));
  }

  function handleToggleRule(id: string) {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r,
      ),
    }));
  }

  function handleRuleTargetToggle(id: string) {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === id
          ? { ...r, targetAccount: r.targetAccount === "primary" ? "legacy" : "primary" }
          : r,
      ),
    }));
  }

  function handleApplyDefaultPreset() {
    setConfig(DEFAULT_DATABASE_PERIOD_ROUTING);
  }

  function handleApplyAllPrimaryPreset() {
    setConfig((prev) => ({
      ...prev,
      defaultAccount: "primary",
      rules: [
        {
          id: "rule-all-primary",
          name: "Seluruh Periode (100% DB Baru)",
          startDate: "",
          endDate: "",
          targetAccount: "primary",
          description: "Semua laporan dari seluruh periode ditarik murni dari Database Baru.",
          enabled: true,
        },
      ],
    }));
  }

  async function handleSaveConfiguration() {
    setSaving(true);
    try {
      await saveDatabasePeriodRouting(config);
      void showSuccess(
        "Pengaturan Tersimpan",
        "Aturan routing periode database berhasil diperbarui dan diterapkan ke seluruh sistem.",
      );
      if (props.onReloadReports) {
        await props.onReloadReports();
      }
    } catch (err: any) {
      void showError("Penyimpanan Gagal", err?.message || "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-card rounded-[22px] p-8 text-center text-xs text-[var(--text-muted)] border border-[var(--border-soft)]">
        <SpinnerIcon />
        <span className="ml-2 font-medium">Memuat konfigurasi routing periode database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="surface-card rounded-[24px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 text-xl">🔀</span>
            <div>
              <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>Routing Database per Periode Laporan</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 font-bold">
                  Multi-DB Hybrid
                </span>
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Tentukan dari database mana (<strong>DB Baru</strong> vs <strong>DB Lama</strong>) data laporan ditarik dan ditampilkan berdasarkan rentang tanggal/periode.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveConfiguration}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? <SpinnerIcon /> : <span>💾</span>}
              <span>Simpan Aturan Routing</span>
            </button>
          </div>
        </div>

        {/* Database Identifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <strong className="text-emerald-700 dark:text-emerald-300 font-bold">
                DB Baru / Primary (Penyimpanan Aktif)
              </strong>
            </div>
            <code className="text-[11px] text-[var(--text-muted)] font-mono block truncate">
              {supabaseUrl}
            </code>
          </div>

          <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <strong className="text-blue-700 dark:text-blue-300 font-bold">
                DB Lama / Legacy (Arsip Historis)
              </strong>
            </div>
            <code className="text-[11px] text-[var(--text-muted)] font-mono block truncate">
              {legacySupabaseUrl || "(Belum dikonfigurasi)"}
            </code>
          </div>
        </div>

        {/* Global Options */}
        <div className="pt-3 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-muted)]">Akun Fallback Default:</span>
            <select
              value={config.defaultAccount}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  defaultAccount: e.target.value as DatabaseTargetAccount,
                }))
              }
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 text-[var(--text-primary)] font-bold"
            >
              <option value="primary">DB Baru (Primary)</option>
              <option value="legacy">DB Lama (Legacy)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text-primary)] select-none">
            <input
              type="checkbox"
              checked={config.preferPrimaryOnDuplicate}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  preferPrimaryOnDuplicate: e.target.checked,
                }))
              }
              className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Prioritaskan DB Baru jika laporan terdata di kedua database</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text-primary)] select-none">
            <input
              type="checkbox"
              checked={config.redirectLegacyPhotoUrls}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  redirectLegacyPhotoUrls: e.target.checked,
                }))
              }
              className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Alihkan URL foto ke storage baru untuk periode DB Baru</span>
          </label>
        </div>
      </div>

      {/* 2. Rules List & Preset Actions */}
      <div className="surface-card rounded-[22px] p-5 sm:p-6 border border-[var(--border-soft)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Daftar Aturan Periode Database ({config.rules.length} Aturan)
            </h5>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Urutan aturan dievaluasi dari atas ke bawah. Aturan pertama yang cocok dengan tanggal laporan akan menentukan database sumber.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplyDefaultPreset}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[var(--text-primary)] font-semibold transition cursor-pointer"
            >
              🔄 Terapkan Preset Standar
            </button>

            <button
              type="button"
              onClick={handleApplyAllPrimaryPreset}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition cursor-pointer"
            >
              ⚡ Alihkan Semua ke DB Baru
            </button>

            <button
              type="button"
              onClick={handleOpenCreateRule}
              className="text-[11px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>+</span>
              <span>Tambah Aturan Periode</span>
            </button>
          </div>
        </div>

        {/* Rule Form Modal / Inline Box */}
        {editingRuleId && (
          <div className="p-4 rounded-2xl border border-blue-500/40 bg-blue-500/5 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <strong className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span>✏️</span>
                <span>{editingRuleId === "new" ? "Buat Aturan Periode Baru" : "Edit Aturan Periode"}</span>
              </strong>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕ Batal
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Nama Aturan / Label Periode:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Periode September - Oktober 2026"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Tanggal Mulai (Opsional):
                </label>
                <input
                  type="date"
                  value={ruleStartDate}
                  onChange={(e) => setRuleStartDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Tanggal Selesai (Opsional):
                </label>
                <input
                  type="date"
                  value={ruleEndDate}
                  onChange={(e) => setRuleEndDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Ambil Data Laporan Dari Database:
                </label>
                <select
                  value={ruleTarget}
                  onChange={(e) => setRuleTarget(e.target.value as DatabaseTargetAccount)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-primary)] font-bold"
                >
                  <option value="primary">DB Baru / Primary (bpskqdsokwxnaglatbft)</option>
                  <option value="legacy">DB Lama / Legacy (cmjkferokecxvtyslvmj)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Deskripsi / Catatan Tambahan:
                </label>
                <input
                  type="text"
                  placeholder="Catatan mengenai periode ini..."
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary text-xs px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="btn-primary text-xs px-4 py-1.5 rounded-lg font-bold cursor-pointer"
              >
                Simpan Aturan ke Daftar
              </button>
            </div>
          </div>
        )}

        {/* Rules Table / Cards */}
        <div className="space-y-2.5">
          {config.rules.map((rule, idx) => {
            const isPrimary = rule.targetAccount === "primary";

            return (
              <div
                key={rule.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  rule.enabled
                    ? isPrimary
                      ? "bg-emerald-500/5 border-emerald-500/30"
                      : "bg-blue-500/5 border-blue-500/30"
                    : "bg-[var(--surface-muted)]/20 border-[var(--border-soft)] opacity-60"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="rounded border-[var(--border-soft)] text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      title={rule.enabled ? "Nonaktifkan Aturan" : "Aktifkan Aturan"}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        #{idx + 1}. {rule.name}
                      </span>

                      {/* Target Account Pill with quick toggle */}
                      <button
                        type="button"
                        onClick={() => handleRuleTargetToggle(rule.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                          isPrimary
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                            : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40"
                        }`}
                        title="Klik untuk mengubah database target (DB Baru / DB Lama)"
                      >
                        <span>{isPrimary ? "🟢 DB Baru" : "🔵 DB Lama"}</span>
                        <span className="text-[9px] opacity-70">⇄</span>
                      </button>

                      {!rule.enabled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/20 font-semibold">
                          Non-Aktif
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                      <span>
                        Rentang: <strong>{rule.startDate || "Awal"}</strong> s/d{" "}
                        <strong>{rule.endDate || "Seterusnya"}</strong>
                      </span>
                      {rule.description && (
                        <>
                          <span>•</span>
                          <span className="font-sans italic">{rule.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenEditRule(rule)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] text-[var(--text-primary)] font-semibold transition cursor-pointer"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold transition cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
