// Aturan ini sengaja dipisah agar mudah dipindahkan ke konfigurasi admin nanti.
export type ReportRules = {
  allowAnyReportDate: boolean;
  maxPhotosPerActivity: number;
};

export const DEFAULT_REPORT_RULES: ReportRules = {
  allowAnyReportDate: true,
  maxPhotosPerActivity: 1,
};

export function normalizeReportRules(input: Partial<ReportRules> | null | undefined): ReportRules {
  return {
    allowAnyReportDate:
      input?.allowAnyReportDate ?? DEFAULT_REPORT_RULES.allowAnyReportDate,
    maxPhotosPerActivity: Math.max(1, Number(input?.maxPhotosPerActivity ?? DEFAULT_REPORT_RULES.maxPhotosPerActivity) || DEFAULT_REPORT_RULES.maxPhotosPerActivity),
  };
}
