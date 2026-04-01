import { getWitaToday, nowIso } from "../lib/time";
import type { DraftReport, Report } from "../types/report";

export const defaultDraft: DraftReport = {
  nama: "",
  tanggal: "RABU, 01 APRIL 2026",
  reportDate: getWitaToday(),
  activities: [
    {
      no: 1,
      description: "",
      startTime: "09:00",
      endTime: "12:00",
      photos: [],
    },
  ],
  approverCoordinator: "ARIS PEBRIANSYAH, S.STP, M.AP",
  approverCoordinatorNip: "199602102018081001",
  approverDivisionHead: "ANDY A SEMBIRING,.S.STP,.M.Si",
  approverDivisionHeadTitle: "Pembina Utama Tkt I",
  approverDivisionHeadNip: "19831221 200212 1 004",
  notes: [
    "DIKUMPULKAN SETIAP HARI DI ADMIN.",
    "LAPORAN DI KUMPULKAN DENGAN MAP SNEILHEKTER YANG TELAH DI BERIKAN NAMA MASING2.",
  ],
};

export const seededReports: Report[] = [
  {
    id: "RPT-001",
    nama: "MUHAMMAD FAHRIL, S.KOM.",
    tanggal: "RABU, 01 APRIL 2026",
    reportDate: getWitaToday(),
    activities: [
      {
        no: 1,
        description: "Setup Database Web GIS",
        startTime: "09:00",
        endTime: "12:00",
        photos: [],
      },
      {
        no: 2,
        description: "Setup API Web GIS",
        startTime: "13:00",
        endTime: "16:00",
        photos: [],
      },
    ],
    approverCoordinator: "ARIS PEBRIANSYAH, S.STP, M.AP",
    approverCoordinatorNip: "199602102018081001",
    approverDivisionHead: "ANDY A SEMBIRING,.S.STP,.M.Si",
    approverDivisionHeadTitle: "Pembina Utama Tkt I",
    approverDivisionHeadNip: "19831221 200212 1 004",
    notes: [
      "DIKUMPULKAN SETIAP HARI DI ADMIN.",
      "LAPORAN DI KUMPULKAN DENGAN MAP SNEILHEKTER YANG TELAH DI BERIKAN NAMA MASING2.",
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdByRole: "anonymous",
    createdByLabel: "Pengguna umum",
    updatedByRole: "anonymous",
    updatedByLabel: "Pengguna umum",
  },
];

export const monitoredUsers = [
  "Abdul Rahman",
  "Aditiya Pratama",
  "Muhammad Fahril, S.Kom.",
  "Maya Salsabila",
  "Riska Wulandari",
  "Yusuf Salam",
];
