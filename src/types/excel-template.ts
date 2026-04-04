export type ExcelReportTemplate = {
  id: string;
  templateName: string;
  cacheVersion: string;
  storagePath: string;
  publicUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExcelTemplateUploadDraft = {
  templateName: string;
  templateDate: string;
  cacheVersion: string;
};
