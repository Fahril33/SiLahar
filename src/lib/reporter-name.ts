export function normalizeReporterName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatReporterNameForDatabase(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isSameReporterName(left: string, right: string) {
  return normalizeReporterName(left) === normalizeReporterName(right);
}

export function includesReporterName(source: string, keyword: string) {
  return normalizeReporterName(source).includes(normalizeReporterName(keyword));
}

export function isAdminName(name: string): boolean {
  if (!name) return false;
  const norm = normalizeReporterName(name);
  return (
    norm === "admin" ||
    norm === "administrator" ||
    norm.startsWith("admin@") ||
    norm.startsWith("admin.") ||
    norm.startsWith("admin_") ||
    norm === "admin@bpbd.com" ||
    norm.includes("admin@")
  );
}

/**
 * Dedup nama secara case-insensitive, prioritaskan format pertama yang ditemukan.
 * Mengabaikan nama/email akun admin.
 * ["Ahmad", "AHMAD", "ahmad"] → ["Ahmad"]
 */
export function deduplicateReporterNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const name of names) {
    if (!name || isAdminName(name)) continue;
    const norm = normalizeReporterName(name);
    if (!seen.has(norm)) {
      seen.set(norm, name);
    }
  }
  return Array.from(seen.values());
}

/**
 * Cari nama canonical dari daftar yang ada (case-insensitive match).
 * Jika "AHMAD" diinput dan "Ahmad" sudah ada, return "Ahmad".
 * Jika tidak ditemukan, return input yang sudah di-trim.
 */
export function resolveCanonicalName(input: string, knownNames: string[]): string {
  const match = knownNames.find(n => isSameReporterName(n, input));
  return match ?? input.trim();
}

