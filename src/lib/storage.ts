import type { DraftReport, Report } from "../types/report";
import {
  formatReporterNameForDatabase,
  isAdminName,
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
  return loadJson<string[]>(REPORTER_NAMES_CACHE_KEY, []).filter((name) => name && !isAdminName(name));
}

export function saveCachedReporterNames(names: string[]) {
  const uniqueNames = Array.from(
    names
      .reduce((map, name) => {
        if (!name || isAdminName(name)) return map;
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
  return loadJson<string[]>(DEVICE_SUBMITTED_NAMES_KEY, []).filter((name) => name && !isAdminName(name));
}

export function saveDeviceSubmittedNames(names: string[]) {
  const uniqueNames = Array.from(
    names
      .reduce((map, name) => {
        if (!name || isAdminName(name)) return map;
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
  if (isAdminName(name)) return loadDeviceSubmittedNames();
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

const TEMPLATE_CONFIG_CACHE_KEY = "silahar:template-config-cache";
const TEAM_TYPES_CACHE_KEY = "silahar:team-types-cache";
const SIGNATURE_CACHE_PREFIX = "silahar:sig-data:";

export function loadCachedReportTemplateConfig<T>(): T | null {
  return loadJson<T | null>(TEMPLATE_CONFIG_CACHE_KEY, null);
}

export function saveCachedReportTemplateConfig<T>(config: T): void {
  if (!config) return;
  try {
    window.localStorage.setItem(TEMPLATE_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {}
}

export function loadCachedTeamTypes<T>(): T | null {
  return loadJson<T | null>(TEAM_TYPES_CACHE_KEY, null);
}

export function saveCachedTeamTypes<T>(teamTypes: T): void {
  if (!teamTypes) return;
  try {
    window.localStorage.setItem(TEAM_TYPES_CACHE_KEY, JSON.stringify(teamTypes));
  } catch {}
}

// In-memory instant cache for signature data URLs to avoid re-fetching across renders
const memorySignatureCache = new Map<string, string>();

function hashUrlKey(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `${SIGNATURE_CACHE_PREFIX}${Math.abs(hash)}`;
}

export function getCachedSignatureDataUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:image/")) return url;
  if (memorySignatureCache.has(url)) {
    return memorySignatureCache.get(url)!;
  }
  try {
    const key = hashUrlKey(url);
    const cached = window.localStorage.getItem(key);
    if (cached) {
      memorySignatureCache.set(url, cached);
      return cached;
    }
  } catch {}
  return null;
}

export function setCachedSignatureDataUrl(url: string, dataUrl: string): void {
  if (!url || !dataUrl) return;
  memorySignatureCache.set(url, dataUrl);
  try {
    // Only cache if under 600KB to prevent quota exceeded errors
    if (dataUrl.length < 600000) {
      const key = hashUrlKey(url);
      window.localStorage.setItem(key, dataUrl);
    }
  } catch {}
}

export async function prefetchAndCacheSignatureImage(url: string): Promise<string> {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:image/")) {
    setCachedSignatureDataUrl(url, url);
    return url;
  }
  const cached = getCachedSignatureDataUrl(url);
  if (cached) return cached;

  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setCachedSignatureDataUrl(url, result);
        resolve(result);
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

