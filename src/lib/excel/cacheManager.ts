import type { ExcelReportTemplate } from "../../types/excel-template";

const EXCEL_TEMPLATE_CACHE_NAME = "silahar-excel-template-cache";
const EXCEL_TEMPLATE_CACHE_ORIGIN = "https://silahar.local";

function isCacheApiSupported() {
  return typeof window !== "undefined" && "caches" in window;
}

function buildTemplateCacheUrl(template: ExcelReportTemplate) {
  const versionSegment = encodeURIComponent(template.cacheVersion.trim() || "v1");
  return `${EXCEL_TEMPLATE_CACHE_ORIGIN}/excel-template/${template.id}/${versionSegment}`;
}

async function fetchTemplateArrayBuffer(template: ExcelReportTemplate) {
  const response = await fetch(template.publicUrl);

  if (!response.ok) {
    throw new Error(
      `Template Excel belum bisa diambil (${response.status} ${response.statusText}).`,
    );
  }

  return {
    response,
    buffer: await response.clone().arrayBuffer(),
  };
}

async function pruneTemplateCache(activeTemplateCacheUrl: string) {
  if (!isCacheApiSupported()) {
    return;
  }

  const cache = await window.caches.open(EXCEL_TEMPLATE_CACHE_NAME);
  const requests = await cache.keys();

  await Promise.all(
    requests
      .filter((request) => request.url !== activeTemplateCacheUrl)
      .map((request) => cache.delete(request)),
  );
}

export async function getExcelTemplateBuffer(
  template: ExcelReportTemplate,
): Promise<ArrayBuffer> {
  const cacheUrl = buildTemplateCacheUrl(template);

  if (!isCacheApiSupported()) {
    const { buffer } = await fetchTemplateArrayBuffer(template);
    return buffer;
  }

  const cache = await window.caches.open(EXCEL_TEMPLATE_CACHE_NAME);
  const cachedResponse = await cache.match(cacheUrl);

  if (cachedResponse) {
    return cachedResponse.arrayBuffer();
  }

  const { response, buffer } = await fetchTemplateArrayBuffer(template);
  await cache.put(cacheUrl, response);
  await pruneTemplateCache(cacheUrl);

  return buffer;
}

export async function warmUpExcelTemplateCache(template: ExcelReportTemplate | null) {
  if (!template) {
    return;
  }

  await getExcelTemplateBuffer(template);
}
