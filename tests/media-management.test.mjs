import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { build } from "esbuild";

// Bundle the real services with in-memory Supabase adapters. No test can contact a server.
const bundled = await build({
  stdin: { contents: 'export * from "./src/lib/media-service"; export * from "./src/lib/media-utils";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false,
  define: { "import.meta.env.VITE_SUPABASE_URL": '"https://fixture.invalid"' },
  plugins: [{
    name: "memory-only-supabase",
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(supabase|report-service)$/ }, (args) => ({ path: args.path, namespace: "memory-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "memory-fixture" }, (args) => ({ contents: args.path.endsWith("report-service")
        ? "export async function getActiveAdminSession() { return globalThis.mediaFixture.admin; }"
        : "export const supabase = new Proxy({}, { get: (_, key) => globalThis.mediaFixture.client[key] }); export function createIsolatedSupabaseClient() { return globalThis.mediaFixture.isolated; }", loader: "js" }));
    },
  }],
});
const media = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const bucket = { id: "daily-report-proofs", name: "daily-report-proofs", prefix: "", public: true, auditable: true };
const signatureBucket = { ...bucket, id: "official-signatures", name: "official-signatures" };
const object = (name, size = 1024, mime = "image/jpeg") => ({ id: `id-${name}`, name, metadata: { size, mimetype: mime }, created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:00Z" });
const image = (path) => ({ id: path, path, name: path.split("/").at(-1), size: 1024, mimeType: "image/jpeg", createdAt: "2026-11-02T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z", references: [], status: "orphan" });
const photoRow = (path = "report/activity/photo.jpg", id = "photo-1") => ({ id, storage_path: path, public_url: "", daily_report_activities: { id: "activity", report_id: "report", daily_reports: { id: "report", reporter_name: "Petugas", report_date: "2026-11-02" } } });
let fixture;
let cache;

beforeEach(() => {
  cache = new Map();
  globalThis.sessionStorage = { getItem: (key) => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value), removeItem: (key) => cache.delete(key) };
  fixture = {
    admin: { user: { id: "admin-1", email: "admin@fixture.invalid" } },
    folders: new Map(), listing: [], removed: [], referenceReads: [],
    rows: { daily_report_activity_photos: [], team_types: [], report_template_approvers: [] },
    failFolder: null, failTable: null, failRemove: null, emptyRemove: false,
    loginCount: 0,
  };
  const storage = (source) => ({
    listBuckets: async () => ({ data: [bucket, signatureBucket], error: null }),
    from: (id) => ({
      list: async (path, options) => {
        fixture.listing.push({ bucket: id, path, offset: options.offset });
        return path === fixture.failFolder ? { data: null, error: { message: "Denied" } } : { data: (fixture.folders.get(`${id}/${path}`) || []).slice(options.offset, options.offset + options.limit), error: null };
      },
      remove: async (paths) => {
        fixture.removed.push({ source, bucket: id, paths });
        if (fixture.failRemove?.(paths)) return { data: null, error: { message: "Denied" } };
        return { data: fixture.emptyRemove ? [] : paths.map((name) => ({ name })), error: null };
      },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://fixture.invalid/storage/v1/object/public/${id}/${path}` } }),
      createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://fixture.invalid/signed/${path}`, error: null })), error: null }),
    }),
  });
  fixture.client = {
    storage: storage("main"),
    from: (table) => ({ select: () => ({ order: () => ({ range: async (from, to) => {
      fixture.referenceReads.push({ table, from });
      return table === fixture.failTable ? { data: null, error: { message: "Denied" } } : { data: fixture.rows[table].slice(from, to + 1), error: null };
    } }) }) }),
  };
  fixture.isolated = {
    storage: storage("isolated"),
    auth: { signInWithPassword: async ({ email, password }) => {
      fixture.loginCount++;
      assert.equal(email, fixture.admin.user.email);
      return password === " real password " ? { data: { user: { id: "admin-1" } }, error: null } : { data: { user: null }, error: { message: "Invalid password" } };
    } },
  };
  globalThis.mediaFixture = fixture;
});

test("matches encoded URLs, signed query strings and bucket-prefixed paths", () => {
  const files = [image("report/activity/foto wilayah.jpg"), image("other/foto wilayah.jpg"), image("report/activity/literal%20name.jpg")];
  const refs = [
    { id: "1", bucketId: bucket.id, paths: ["https://fixture.invalid/storage/v1/object/sign/daily-report-proofs/report/activity/foto%20wilayah.jpg?token=secret"] },
    { id: "2", bucketId: bucket.id, paths: ["daily-report-proofs/report/activity/literal%2520name.jpg"] },
  ];
  const results = media.correlateMedia(files, refs, bucket.id, true);
  assert.deepEqual(results.map((file) => file.status), ["linked", "orphan", "linked"]);
  assert.equal(results[0].references.length, 1);
});

test("keeps full-path collisions and buckets separate, while protecting basename-only references", () => {
  const refs = [
    { id: "1", bucketId: bucket.id, paths: ["a/shared.jpg"] },
    { id: "2", bucketId: "official-signatures", paths: ["b/shared.jpg"] },
    { id: "3", bucketId: bucket.id, paths: ["loose.jpg"] },
  ];
  const results = media.correlateMedia([image("a/shared.jpg"), image("b/shared.jpg"), image("folder/loose.jpg")], refs, bucket.id, true);
  assert.deepEqual(results.map((file) => file.status), ["linked", "orphan", "linked"]);
  assert.deepEqual(media.mediaPathVariants("https://fixture.invalid/storage/v1/object/public/other/a/shared.jpg", bucket.id), []);
  assert.deepEqual(media.mediaPathVariants("bad%XY.jpg", bucket.id), ["bad%XY.jpg"]);
  assert.deepEqual(media.mediaPathVariants("daily-report-proofs%2Fa%2Fshared.jpg", bucket.id), ["daily-report-proofs%2Fa%2Fshared.jpg", "a/shared.jpg"]);
});

test("never labels unaudited sources as orphan", () => {
  assert.equal(media.correlateMedia([image("a.jpg")], [], "unknown", false)[0].status, "unknown");
});

test("enumerates root images, arbitrary depth and more than 1000 objects without truncation", async () => {
  fixture.folders.set(`${bucket.id}/`, [{ name: "folder", id: null, metadata: null }, object("root.png"), object("notes.txt", 100, "text/plain")]);
  fixture.folders.set(`${bucket.id}/folder`, [{ name: "deep", id: null, metadata: null }, ...Array.from({ length: 1005 }, (_, i) => object(`photo-${i}.jpg`))]);
  fixture.folders.set(`${bucket.id}/folder/deep`, [object("last.webp")]);
  const result = await media.scanStorageImages(bucket, "admin-1");
  assert.equal(result.files.length, 1007);
  assert.ok(result.files.some((file) => file.path === "folder/deep/last.webp"));
  assert.ok(fixture.listing.some((request) => request.path === "folder" && request.offset === 1000));
  assert.equal(result.cached, false);
});

test("caches complete scans for five minutes, separates buckets/admins and permits forced refresh", async () => {
  fixture.folders.set(`${bucket.id}/`, [object("cached.jpg")]);
  await media.scanStorageImages(bucket, "admin-1");
  const firstRequests = fixture.listing.length;
  assert.equal((await media.scanStorageImages(bucket, "admin-1")).cached, true);
  assert.equal(fixture.listing.length, firstRequests);
  await media.scanStorageImages(bucket, "admin-2");
  await media.scanStorageImages(signatureBucket, "admin-1");
  assert.equal(fixture.listing.length, firstRequests + 2);
  await media.scanStorageImages(bucket, "admin-1", { force: true });
  assert.equal(fixture.listing.length, firstRequests + 3);
  const key = [...cache.keys()].find((key) => key.includes(":admin-1:daily-report-proofs:"));
  const entry = JSON.parse(cache.get(key)); entry.scannedAt = Date.now() - 300001; cache.set(key, JSON.stringify(entry));
  assert.equal((await media.scanStorageImages(bucket, "admin-1")).cached, false);
});

test("a failed subfolder cannot produce a partial successful audit or a cache entry", async () => {
  fixture.folders.set(`${bucket.id}/`, [object("root.jpg"), { name: "blocked", id: null, metadata: null }]);
  fixture.failFolder = "blocked";
  await assert.rejects(media.scanStorageImages(bucket, "admin-1"), /Denied/);
  assert.equal(cache.size, 0);
});

test("aborted scans do not make requests or write cache", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(media.scanStorageImages(bucket, "admin-1", { signal: controller.signal }));
  assert.equal(fixture.listing.length, 0);
  assert.equal(cache.size, 0);
});

test("reads every reference page and includes signatures in their actual bucket", async () => {
  fixture.rows.daily_report_activity_photos = Array.from({ length: 1001 }, (_, i) => photoRow(`r/a/photo-${i}.jpg`, `photo-${i}`));
  fixture.rows.team_types = [{ id: "team", name: "TRC", signature_url: "https://fixture.invalid/storage/v1/object/public/daily-report-proofs/signatures/team.png" }];
  fixture.rows.report_template_approvers = [{ id: "approver", official_name: "Kabid", signature_url: "https://fixture.invalid/storage/v1/object/public/official-signatures/head.png" }];
  const refs = await media.fetchMediaReferences();
  assert.equal(refs.length, 1003);
  assert.equal(refs.find((ref) => ref.kind === "team").bucketId, bucket.id);
  assert.equal(refs.find((ref) => ref.kind === "approver").bucketId, signatureBucket.id);
  assert.ok(fixture.referenceReads.some((request) => request.from === 1000));
});

test("a conflicting public URL never hides the stored photo path from its original bucket", async () => {
  fixture.rows.daily_report_activity_photos = [{ ...photoRow(), public_url: "https://fixture.invalid/storage/v1/object/public/official-signatures/other.jpg" }];
  const refs = await media.fetchMediaReferences();
  assert.equal(media.correlateMedia([image("report/activity/photo.jpg")], refs, bucket.id, true)[0].status, "linked");
  assert.equal(media.correlateMedia([image("other.jpg")], refs, signatureBucket.id, true)[0].status, "linked");
});

test("reference failures and malformed relations block deletion", async () => {
  fixture.failTable = "team_types";
  await assert.rejects(media.deleteMediaImages(bucket, [image("test.jpg")], "admin-1", null), /Audit referensi/);
  assert.equal(fixture.removed.length, 0);
  fixture.failTable = null;
  fixture.rows.daily_report_activity_photos = [{ ...photoRow(), daily_report_activities: null }];
  await assert.rejects(media.fetchMediaReferences(), /Relasi laporan tidak lengkap/);
});

test("requires an active matching administrator and an audited bucket", async () => {
  fixture.admin = null;
  await assert.rejects(media.deleteMediaImages(bucket, [image("orphan.jpg")], "admin-1", null), /administrator/);
  fixture.admin = { user: { id: "other-admin" } };
  await assert.rejects(media.deleteMediaImages(bucket, [image("orphan.jpg")], "admin-1", null), /administrator/);
  await assert.rejects(media.deleteMediaImages({ ...bucket, auditable: false }, [image("test.jpg")], "other-admin", null), /belum terhubung/);
  assert.equal(fixture.removed.length, 0);
});

test("rechecks current data and blocks stale orphan classifications without verified password", async () => {
  fixture.rows.daily_report_activity_photos = [photoRow()];
  await assert.rejects(media.deleteMediaImages(bucket, [image("report/activity/photo.jpg")], "admin-1", null), media.MediaPasswordRequiredError);
  for (const access of [{ client: fixture.isolated, adminId: "other-admin", expiresAt: Date.now() + 60000 }, { client: fixture.isolated, adminId: "admin-1", expiresAt: Date.now() - 1 }]) {
    await assert.rejects(media.deleteMediaImages(bucket, [image("report/activity/photo.jpg")], "admin-1", access), media.MediaPasswordRequiredError);
  }
  assert.equal(fixture.removed.length, 0);
});

test("validates actual admin credentials with an isolated client and rejects hardcoded passwords", async () => {
  for (const password of ["admin", "admin123", "silahar2026", "wrong"]) await assert.rejects(media.verifyMediaDeletionPassword(password, "admin-1"), /tidak sesuai/);
  const access = await media.verifyMediaDeletionPassword(" real password ", "admin-1");
  assert.equal(access.client, fixture.isolated);
  assert.equal(access.adminId, "admin-1");
  assert.equal(fixture.loginCount, 5);
  fixture.rows.daily_report_activity_photos = [photoRow()];
  const result = await media.deleteMediaImages(bucket, [image("report/activity/photo.jpg")], "admin-1", access);
  assert.deepEqual(result.failed, []);
  assert.equal(fixture.removed[0].source, "isolated");
});

test("batches and deduplicates orphan deletion, counts only actual removals and preserves failures", async () => {
  const files = Array.from({ length: 55 }, (_, index) => image(`orphan-${index}.jpg`));
  fixture.failRemove = (paths) => paths.length < 50;
  const progress = [];
  const result = await media.deleteMediaImages(bucket, [...files, files[0]], "admin-1", null, (done) => progress.push(done));
  assert.equal(result.deleted.length, 50);
  assert.equal(result.failed.length, 5);
  assert.deepEqual(progress, [50, 55]);
  assert.equal(fixture.removed.length, 2);
  assert.equal(fixture.removed[0].source, "main");
});

test("does not count empty removal responses as a successful delete", async () => {
  fixture.emptyRemove = true;
  const result = await media.deleteMediaImages(bucket, [image("not-removed.jpg")], "admin-1", null);
  assert.deepEqual(result.deleted, []);
  assert.deepEqual(result.failed, ["not-removed.jpg"]);
});

test("creates public or short-lived private preview links only for requested paths", async () => {
  assert.equal((await media.getMediaImageUrls(bucket, ["image.jpg"]))["image.jpg"], "https://fixture.invalid/storage/v1/object/public/daily-report-proofs/image.jpg");
  assert.equal((await media.getMediaImageUrls({ ...bucket, public: false }, ["image.jpg"]))["image.jpg"], "https://fixture.invalid/signed/image.jpg");
  assert.equal(media.isStorageImage("document.pdf", "application/pdf"), false);
  assert.equal(media.isStorageImage("opaque", "image/avif"), true);
  assert.equal(media.formatMediaBytes(1024), "1 KB");
});

test("handles nested array relations, backslashes, and root-relative URLs gracefully", async () => {
  // Test array-wrapped relations returned by PostgREST
  fixture.rows.daily_report_activity_photos = [{
    id: "photo-array",
    storage_path: "report\\activity\\nested.jpg",
    public_url: "/storage/v1/object/public/daily-report-proofs/report/activity/nested.jpg?version=1#top",
    daily_report_activities: [{
      id: "act-1",
      report_id: "rep-1",
      daily_reports: [{ id: "rep-1", reporter_name: "Array Reporter", report_date: "2026-11-02" }],
    }],
  }];
  fixture.rows.team_types = [{ id: "team-rel", name: "Rel TRC", signature_url: "signatures/rel-team.png" }];
  fixture.rows.report_template_approvers = [{ id: "app-b64", official_name: "B64", signature_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" }];

  const refs = await media.fetchMediaReferences();
  // Nested photo should match normalized forward slash path
  const photoResult = media.correlateMedia([image("report/activity/nested.jpg")], refs, bucket.id, true);
  assert.equal(photoResult[0].status, "linked");
  assert.equal(photoResult[0].references[0].label, "Array Reporter");

  // Relative signature without bucket should be protected in daily-report-proofs and official-signatures
  const sigProofResult = media.correlateMedia([image("signatures/rel-team.png")], refs, bucket.id, true);
  assert.equal(sigProofResult[0].status, "linked");
  const sigOfficeResult = media.correlateMedia([image("signatures/rel-team.png")], refs, signatureBucket.id, true);
  assert.equal(sigOfficeResult[0].status, "linked");

  // Base64 data URL should not cause false positive links on arbitrary files
  const unknownFile = media.correlateMedia([image("random.png")], refs, bucket.id, true);
  assert.equal(unknownFile[0].status, "orphan");
});

