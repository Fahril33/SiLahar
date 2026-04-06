import type { DraftReport, Report } from "../types/report";
import {
  formatReporterNameForDatabase,
  normalizeReporterName,
} from "./reporter-name";

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
  const uniqueNames = Array.from(
    names
      .reduce((map, name) => {
        const formatted = formatReporterNameForDatabase(name);
        const normalized = normalizeReporterName(formatted);
        if (formatted && !map.has(normalized)) {
          map.set(normalized, formatted);
        }
        return map;
      }, new Map<string, string>())
      .values(),
  ).sort();

  window.localStorage.setItem(
    REPORTER_NAMES_CACHE_KEY,
    JSON.stringify(uniqueNames),
  );
}

export function loadDeviceSubmittedNames() {
  return loadJson<string[]>(DEVICE_SUBMITTED_NAMES_KEY, []);
}

export function saveDeviceSubmittedNames(names: string[]) {
  const uniqueNames = Array.from(
    names
      .reduce((map, name) => {
        const formatted = formatReporterNameForDatabase(name);
        const normalized = normalizeReporterName(formatted);
        if (formatted && !map.has(normalized)) {
          map.set(normalized, formatted);
        }
        return map;
      }, new Map<string, string>())
      .values(),
  ).sort();

  window.localStorage.setItem(
    DEVICE_SUBMITTED_NAMES_KEY,
    JSON.stringify(uniqueNames),
  );
}

export function pushDeviceSubmittedName(name: string) {
  const current = loadDeviceSubmittedNames();
  const formatted = formatReporterNameForDatabase(name);
  const nextNames = [
    formatted,
    ...current.filter((item) => normalizeReporterName(item) !== normalizeReporterName(formatted)),
  ].filter(Boolean);
  saveDeviceSubmittedNames(nextNames);
  return nextNames;
}
export function removeDeviceSubmittedName(name: string) {
  const current = loadDeviceSubmittedNames();
  const target = normalizeReporterName(name);
  const nextNames = current.filter((n) => normalizeReporterName(n) !== target);
  saveDeviceSubmittedNames(nextNames);
  return nextNames;
}
