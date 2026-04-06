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
