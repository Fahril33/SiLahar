export type TeamType = {
  id: string;
  code: string;
  name: string;
  description: string;
  headerLines: string[];
  coordinatorName?: string;
  coordinatorNip?: string;
  coordinatorLabel?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamTypeDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  headerLines: string[];
  coordinatorName?: string;
  coordinatorNip?: string;
  coordinatorLabel?: string;
  isDefault?: boolean;
};

export const DEFAULT_HEADER_LINES: string[] = [
  "LAPORAN HARIAN KINERJA TIM REAKSI CEPAT",
  "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH",
  "TAHUN ANGGARAN 2026",
];
