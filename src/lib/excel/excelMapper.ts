import type { Report, ReportActivityPhoto } from "../../types/report";

export type ExcelCellPatch = {
  cell: string;
  value: string | number;
};

export type ExcelImagePatch = {
  photo: ReportActivityPhoto;
  range: {
    startColumn: number;
    startRow: number;
    endColumn: number;
    endRow: number;
  };
};

export type ExcelMappedReport = {
  worksheetIndex: number;
  activityTemplateRow: number;
  textCells: ExcelCellPatch[];
  imageCells: ExcelImagePatch[];
  notes: string[];
  approvalCells: {
    coordinatorNameCell: string;
    coordinatorNipCell: string;
    divisionHeadNameCell: string;
    divisionHeadTitleCell: string;
    divisionHeadNipCell: string;
  };
};

export const EXCEL_TEMPLATE_LAYOUT = {
  worksheetIndex: 0,
  reporterNameCell: "D5",
  reportDateTextCell: "D6",
  activityTemplateRow: 9,
  activityNumberColumn: "B",
  activityDescriptionColumn: "C",
  activityStartTimeColumn: "I",
  activitySeparatorColumn: "J",
  activityEndTimeColumn: "K",
  activityImageStartColumn: 12,
  activityImageEndColumn: 14,
  approvalAnchorRow: 17,
  notesStartRow: 21,
  coordinatorNameColumn: "B",
  coordinatorNipColumn: "B",
  divisionHeadNameColumn: "I",
  divisionHeadTitleColumn: "I",
  divisionHeadNipColumn: "I",
  noteNumberColumn: "B",
  noteTextColumn: "C",
  noteTextMergeEndColumn: "L",
} as const;

export function mapReportToExcelTemplate(report: Report): ExcelMappedReport {
  const textCells: ExcelCellPatch[] = [
    { cell: EXCEL_TEMPLATE_LAYOUT.reporterNameCell, value: report.nama },
    {
      cell: EXCEL_TEMPLATE_LAYOUT.reportDateTextCell,
      value: report.tanggal,
    },
  ];

  const imageCells: ExcelImagePatch[] = [];

  report.activities.forEach((activity, index) => {
    const rowNumber = EXCEL_TEMPLATE_LAYOUT.activityTemplateRow + index;
    textCells.push(
      {
        cell: `${EXCEL_TEMPLATE_LAYOUT.activityNumberColumn}${rowNumber}`,
        value: activity.no,
      },
      {
        cell: `${EXCEL_TEMPLATE_LAYOUT.activityDescriptionColumn}${rowNumber}`,
        value: activity.description,
      },
      {
        cell: `${EXCEL_TEMPLATE_LAYOUT.activityStartTimeColumn}${rowNumber}`,
        value: activity.startTime,
      },
      {
        cell: `${EXCEL_TEMPLATE_LAYOUT.activitySeparatorColumn}${rowNumber}`,
        value: "-",
      },
      {
        cell: `${EXCEL_TEMPLATE_LAYOUT.activityEndTimeColumn}${rowNumber}`,
        value: `${activity.endTime} WITA`,
      },
    );

    const firstPhoto = activity.photos[0];

    if (firstPhoto) {
      imageCells.push({
        photo: firstPhoto,
        range: {
          startColumn: EXCEL_TEMPLATE_LAYOUT.activityImageStartColumn,
          startRow: rowNumber,
          endColumn: EXCEL_TEMPLATE_LAYOUT.activityImageEndColumn,
          endRow: rowNumber + 1,
        },
      });
    }
  });

  return {
    worksheetIndex: EXCEL_TEMPLATE_LAYOUT.worksheetIndex,
    activityTemplateRow: EXCEL_TEMPLATE_LAYOUT.activityTemplateRow,
    textCells,
    imageCells,
    notes: report.notes,
    approvalCells: {
      coordinatorNameCell: `${EXCEL_TEMPLATE_LAYOUT.coordinatorNameColumn}${EXCEL_TEMPLATE_LAYOUT.approvalAnchorRow}`,
      coordinatorNipCell: `${EXCEL_TEMPLATE_LAYOUT.coordinatorNipColumn}${EXCEL_TEMPLATE_LAYOUT.approvalAnchorRow + 1}`,
      divisionHeadNameCell: `${EXCEL_TEMPLATE_LAYOUT.divisionHeadNameColumn}${EXCEL_TEMPLATE_LAYOUT.approvalAnchorRow}`,
      divisionHeadTitleCell: `${EXCEL_TEMPLATE_LAYOUT.divisionHeadTitleColumn}${EXCEL_TEMPLATE_LAYOUT.approvalAnchorRow + 1}`,
      divisionHeadNipCell: `${EXCEL_TEMPLATE_LAYOUT.divisionHeadNipColumn}${EXCEL_TEMPLATE_LAYOUT.approvalAnchorRow + 2}`,
    },
  };
}
