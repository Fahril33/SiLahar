export type DatabaseTargetAccount = "primary" | "legacy";

export interface DatabasePeriodRule {
  id: string;
  name: string;
  startDate: string; // Format YYYY-MM-DD atau "" (tanpa batas awal)
  endDate: string; // Format YYYY-MM-DD atau "" (tanpa batas akhir)
  targetAccount: DatabaseTargetAccount; // "primary" (DB Baru) | "legacy" (DB Lama)
  description?: string;
  enabled: boolean;
}

export interface DatabasePeriodRoutingConfig {
  defaultAccount: DatabaseTargetAccount;
  preferPrimaryOnDuplicate: boolean;
  redirectLegacyPhotoUrls: boolean;
  rules: DatabasePeriodRule[];
  updatedAt?: string;
}

