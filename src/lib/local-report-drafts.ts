import type {
  LocalDraftFileMap,
  LocalReportDraftRecord,
  LocalReportDraftSummary,
} from "../types/local-draft";
import { formatReporterNameForDatabase } from "./reporter-name";

const DATABASE_NAME = "silahar-local-report-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";

function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB tidak tersedia di browser ini."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Gagal membuka database draft lokal."));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    void openDatabase()
      .then((database) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = handler(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Operasi draft lokal gagal."));

        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          reject(
            transaction.error ?? new Error("Transaksi draft lokal tidak selesai."),
          );
          database.close();
        };
      })
      .catch(reject);
  });
}

function normalizePendingPhotos(
  pendingPhotos: LocalDraftFileMap,
): LocalDraftFileMap {
  const normalizedEntries: Array<[number, File[]]> = Object.entries(
    pendingPhotos,
  ).map(([activityNo, files]) => [Number(activityNo), files.filter(Boolean)]);

  return Object.fromEntries(
    normalizedEntries.filter(([, files]) => files.length > 0),
  );
}

function createDraftSummary(
  draft: LocalReportDraftRecord,
): LocalReportDraftSummary {
  return {
    id: draft.id,
    title: draft.title,
    reporterName: draft.draft.nama || "-",
    reportDate: draft.draft.reportDate,
    displayDate: draft.draft.tanggal,
    activityCount: draft.draft.activities.length,
    pendingPhotoCount: Object.values(draft.pendingPhotos).reduce(
      (total, files) => total + files.length,
      0,
    ),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    lastOpenedAt: draft.lastOpenedAt,
    uploadStatus: draft.uploadStatus,
    uploadError: draft.uploadError,
    lastUploadStartedAt: draft.lastUploadStartedAt,
    lastUploadFinishedAt: draft.lastUploadFinishedAt,
    uploadedReportId: draft.uploadedReportId,
    sourceReportId: draft.sourceReportId,
    deleteAfterUpload: Boolean(draft.deleteAfterUpload),
  };
}

export function createLocalDraftTitle(
  reporterName: string,
  reportDate: string,
  createdAt: string,
) {
  const trimmedName = formatReporterNameForDatabase(reporterName);
  const datePart = reportDate || createdAt.slice(0, 10);
  const timePart = createdAt.slice(11, 16);
  return trimmedName
    ? `${trimmedName} - ${datePart} - ${timePart}`
    : `DRAFT LOKAL - ${datePart} - ${timePart}`;
}

export async function listLocalReportDrafts() {
  const records = await withStore<LocalReportDraftRecord[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<LocalReportDraftRecord[]>,
  );

  return records
    .map((record) => ({
      ...record,
      pendingPhotos: normalizePendingPhotos(record.pendingPhotos ?? {}),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(createDraftSummary);
}

export async function loadLocalReportDraft(id: string) {
  const record = await withStore<LocalReportDraftRecord | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<LocalReportDraftRecord | undefined>,
  );

  if (!record) {
    return null;
  }

  return {
    ...record,
    pendingPhotos: normalizePendingPhotos(record.pendingPhotos ?? {}),
  } satisfies LocalReportDraftRecord;
}

export async function saveLocalReportDraft(
  input: Omit<
    LocalReportDraftRecord,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "lastOpenedAt"
    | "uploadStatus"
    | "uploadError"
    | "lastUploadStartedAt"
    | "lastUploadFinishedAt"
    | "uploadedReportId"
    | "deleteAfterUpload"
  > & {
    id?: string;
    createdAt?: string;
    title?: string;
  },
) {
  const now = new Date().toISOString();
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}`);
  const existing = input.id ? await loadLocalReportDraft(input.id) : null;
  const nextRecord: LocalReportDraftRecord = {
    id,
    title:
      input.title ??
      existing?.title ??
      createLocalDraftTitle(input.draft.nama, input.draft.reportDate, now),
    draft: input.draft,
    pendingPhotos: normalizePendingPhotos(input.pendingPhotos),
    editableOriginalPhotos: input.editableOriginalPhotos,
    sourceReportId: input.sourceReportId,
    sourceDraftSnapshot: input.sourceDraftSnapshot,
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
    lastOpenedAt: existing?.lastOpenedAt ?? null,
    uploadStatus: existing?.uploadStatus ?? "idle",
    uploadError: existing?.uploadError ?? null,
    lastUploadStartedAt: existing?.lastUploadStartedAt ?? null,
    lastUploadFinishedAt: existing?.lastUploadFinishedAt ?? null,
    uploadedReportId: existing?.uploadedReportId ?? null,
    deleteAfterUpload: existing?.deleteAfterUpload ?? false,
  };

  await withStore("readwrite", (store) => store.put(nextRecord));
  return nextRecord;
}

export async function touchLocalReportDraft(id: string) {
  const existing = await loadLocalReportDraft(id);
  if (!existing) {
    return null;
  }

  const next = {
    ...existing,
    lastOpenedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store) => store.put(next));
  return next;
}

export async function updateLocalReportDraftStatus(
  id: string,
  patch: Partial<
    Pick<
      LocalReportDraftRecord,
      | "uploadStatus"
      | "uploadError"
      | "lastUploadStartedAt"
      | "lastUploadFinishedAt"
      | "uploadedReportId"
      | "lastOpenedAt"
      | "title"
      | "deleteAfterUpload"
    >
  >,
) {
  const existing = await loadLocalReportDraft(id);
  if (!existing) {
    return null;
  }

  const next: LocalReportDraftRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store) => store.put(next));
  return next;
}

export async function deleteLocalReportDraft(id: string) {
  await withStore("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}

export async function clearUploadedLocalDrafts() {
  const drafts = await listLocalReportDrafts();
  await Promise.all(
    drafts
      .filter((draft) => draft.uploadStatus === "uploaded")
      .map((draft) => deleteLocalReportDraft(draft.id)),
  );
}
