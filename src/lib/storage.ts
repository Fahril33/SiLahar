import type { DraftReport, Report } from "../types/report";

const DRAFT_KEY = "silahar:report-draft";
const REPORTS_CACHE_KEY = "silahar:reports-cache";
const REPORTER_NAMES_CACHE_KEY = "silahar:reporter-names-cache";
const DEVICE_SUBMITTED_NAMES_KEY = "silahar:device-submitted-names";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadDraft(defaultDraft: DraftReport) {
  return loadJson(DRAFT_KEY, defaultDraft);
}

export function saveDraft(draft: DraftReport) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  window.localStorage.removeItem(DRAFT_KEY);
}

export function loadCachedReports() {
  return loadJson<Report[]>(REPORTS_CACHE_KEY, []);
}

export function saveCachedReports(reports: Report[]) {
  window.localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(reports));
}

export function loadCachedReporterNames() {
  return loadJson<string[]>(REPORTER_NAMES_CACHE_KEY, []);
}

export function saveCachedReporterNames(names: string[]) {
  window.localStorage.setItem(
    REPORTER_NAMES_CACHE_KEY,
    JSON.stringify(
      Array.from(new Set(names.map((name) => name.trim().toUpperCase()).filter(Boolean))).sort(),
    ),
  );
}

export function loadDeviceSubmittedNames() {
  return loadJson<string[]>(DEVICE_SUBMITTED_NAMES_KEY, []);
}

export function saveDeviceSubmittedNames(names: string[]) {
  window.localStorage.setItem(
    DEVICE_SUBMITTED_NAMES_KEY,
    JSON.stringify(
      Array.from(new Set(names.map((name) => name.trim().toUpperCase()).filter(Boolean))).sort(),
    ),
  );
}

export function pushDeviceSubmittedName(name: string) {
  const nextNames = Array.from(
    new Set([name.trim().toUpperCase(), ...loadDeviceSubmittedNames()].filter(Boolean)),
  );
  saveDeviceSubmittedNames(nextNames);
  return nextNames;
}
