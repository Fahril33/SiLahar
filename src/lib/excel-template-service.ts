import type { ExcelReportTemplate } from "../types/excel-template";
import { supabase } from "./supabase";
import { getWitaToday } from "./time";

const EXCEL_TEMPLATE_BUCKET = "report-excel-templates";
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ExcelReportTemplateRow = {
  id: string;
  template_name: string;
  cache_version: string;
  storage_path: string;
  public_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function sanitizeTemplateFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function mapExcelTemplateRow(
  row: ExcelReportTemplateRow,
): ExcelReportTemplate {
  return {
    id: row.id,
    templateName: row.template_name,
    cacheVersion: row.cache_version,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildAutoExcelTemplateName(
  cacheVersion: string,
  templateDate = getWitaToday(),
) {
  return `Template-format-excel_${templateDate}_${cacheVersion.trim() || "v1"}`;
}

export function resolveNextExcelTemplateVersion(
  templates: Array<{ cacheVersion: string }>,
) {
  const maxVersionNumber = templates.reduce((maxValue, template) => {
    const versionMatch = template.cacheVersion.trim().match(/^v(\d+)$/i);
    const versionNumber = versionMatch ? Number(versionMatch[1]) : 0;
    return Math.max(maxValue, Number.isFinite(versionNumber) ? versionNumber : 0);
  }, 0);

  return `v${maxVersionNumber + 1}`;
}

export async function fetchExcelReportTemplates() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("excel_report_templates")
    .select(
      "id, template_name, cache_version, storage_path, public_url, is_active, created_at, updated_at",
    )
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      console.warn(
        "Tabel excel_report_templates belum tersedia, lewati fitur template Excel.",
        error,
      );
      return [];
    }

    throw error;
  }

  return (data ?? []).map((row) =>
    mapExcelTemplateRow(row as ExcelReportTemplateRow),
  );
}

export async function uploadExcelReportTemplate(
  file: File,
  templateName: string,
  cacheVersion: string,
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const normalizedName = templateName.trim();
  const normalizedVersion = cacheVersion.trim() || "v1";

  if (!normalizedName) {
    throw new Error("Nama template Excel wajib diisi.");
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Template Excel wajib berformat .xlsx.");
  }

  const storagePath = `${normalizedVersion}/${Date.now()}-${sanitizeTemplateFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(EXCEL_TEMPLATE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || EXCEL_MIME_TYPE,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from(EXCEL_TEMPLATE_BUCKET)
    .getPublicUrl(storagePath);

  const { error: insertError } = await supabase
    .from("excel_report_templates")
    .insert({
      template_name: normalizedName,
      cache_version: normalizedVersion,
      storage_path: storagePath,
      public_url: publicUrlData.publicUrl,
      is_active: false,
    });

  if (insertError) {
    await supabase.storage.from(EXCEL_TEMPLATE_BUCKET).remove([storagePath]);
    throw insertError;
  }
}

export async function activateExcelReportTemplate(templateId: string) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const { error } = await supabase.rpc("set_active_excel_report_template", {
    template_id_input: templateId,
  });

  if (error) {
    throw error;
  }
}

export async function updateExcelReportTemplateMetadata(
  templateId: string,
  templateName: string,
  cacheVersion: string,
) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  const normalizedName = templateName.trim();
  const normalizedVersion = cacheVersion.trim() || "v1";

  if (!normalizedName) {
    throw new Error("Nama template Excel wajib diisi.");
  }

  const { error } = await supabase
    .from("excel_report_templates")
    .update({
      template_name: normalizedName,
      cache_version: normalizedVersion,
    })
    .eq("id", templateId);

  if (error) {
    throw error;
  }
}

export async function deleteExcelReportTemplate(template: ExcelReportTemplate) {
  if (!supabase) {
    throw new Error("Supabase client belum terkonfigurasi.");
  }

  if (template.isActive) {
    throw new Error("Template Excel aktif tidak bisa dihapus sebelum diganti.");
  }

  const { error: deleteError } = await supabase
    .from("excel_report_templates")
    .delete()
    .eq("id", template.id);

  if (deleteError) {
    throw deleteError;
  }

  const { error: removeStorageError } = await supabase.storage
    .from(EXCEL_TEMPLATE_BUCKET)
    .remove([template.storagePath]);

  if (removeStorageError) {
    console.error("Metadata template terhapus, tetapi file storage belum terhapus.", removeStorageError);
  }
}
