import { saveAs } from "file-saver";
import type { ExcelReportTemplate } from "../../types/excel-template";
import type { Report, ReportActivityPhoto } from "../../types/report";
import { supabase } from "../supabase";
import { getExcelTemplateBuffer } from "./cacheManager";
import {
  EXCEL_TEMPLATE_LAYOUT,
  mapReportToExcelTemplate,
} from "./excelMapper";

const PROOF_BUCKET = "daily-report-proofs";
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const IMAGE_CELL_PADDING_X_PX = 6;
const IMAGE_CELL_PADDING_Y_PX = 6;
const ACTIVITY_IMAGE_BORDER_STYLE: Partial<import("exceljs").Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

type ExcelImageExtension = "png" | "jpeg";
type ExcelPreparedImage = {
  buffer: ArrayBuffer;
  extension: ExcelImageExtension;
  width: number;
  height: number;
};

export type GenerateReportExcelOptions = {
  report: Report;
  template: ExcelReportTemplate;
};

function sanitizeExcelFileSegment(value: string) {
  return value
    .trim()
    .replace(/[.,/\\]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_()-]/gi, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildExcelFileName(report: Report) {
  const nameSegment = sanitizeExcelFileSegment(report.nama || "LAPORAN");
  const dateSegment = sanitizeExcelFileSegment(
    report.tanggal || report.reportDate || "TANGGAL",
  );
  return `${nameSegment}_${dateSegment}.xlsx`;
}

function buildCellAddress(column: string, row: number) {
  return `${column}${row}`;
}

function mergeRangeAndSetValue(
  worksheet: import("exceljs").Worksheet,
  rangeAddress: string,
  value: string,
  alignment: Partial<import("exceljs").Alignment> = {
    horizontal: "center",
    vertical: "middle",
  },
) {
  worksheet.unMergeCells(rangeAddress);
  worksheet.mergeCells(rangeAddress);

  const masterCellAddress = rangeAddress.split(":")[0];
  const masterCell = worksheet.getCell(masterCellAddress);
  masterCell.value = value;
  masterCell.alignment = {
    ...masterCell.alignment,
    ...alignment,
  };
}

function getWorksheetColumnWidthPixels(
  worksheet: import("exceljs").Worksheet,
  columnNumber: number,
) {
  const width = worksheet.getColumn(columnNumber).width ?? 8.43;
  return Math.max(24, Math.round(width * 7 + 5));
}

function getMergedRangeWidthPixels(
  worksheet: import("exceljs").Worksheet,
  startColumn: number,
  endColumn: number,
) {
  let totalWidth = 0;

  for (
    let columnNumber = startColumn;
    columnNumber <= endColumn;
    columnNumber += 1
  ) {
    totalWidth += getWorksheetColumnWidthPixels(worksheet, columnNumber);
  }

  return totalWidth;
}

function getImageCellLayout(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
  imageWidth: number,
  imageHeight: number,
  mergedCellWidthPixels: number,
) {
  const paddedImageWidth = Math.max(
    24,
    mergedCellWidthPixels - IMAGE_CELL_PADDING_X_PX * 2,
  );
  const paddedImageHeight = Math.max(
    24,
    Math.round(
      (paddedImageWidth * Math.max(1, imageHeight)) / Math.max(1, imageWidth),
    ),
  );
  const rowHeightPixels = Math.max(
    90 + IMAGE_CELL_PADDING_Y_PX * 2,
    paddedImageHeight + IMAGE_CELL_PADDING_Y_PX * 2,
  );

  worksheet.getRow(rowNumber).height = Math.round(rowHeightPixels * 0.75);

  return {
    paddedImageWidth,
    paddedImageHeight,
    topOffsetRatio: IMAGE_CELL_PADDING_Y_PX / rowHeightPixels,
  };
}

function applyMergedImageCellBorder(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
) {
  worksheet.getCell(`L${rowNumber}`).border = {
    top: ACTIVITY_IMAGE_BORDER_STYLE.top,
    bottom: ACTIVITY_IMAGE_BORDER_STYLE.bottom,
    left: ACTIVITY_IMAGE_BORDER_STYLE.left,
  };
  worksheet.getCell(`M${rowNumber}`).border = {
    top: ACTIVITY_IMAGE_BORDER_STYLE.top,
    bottom: ACTIVITY_IMAGE_BORDER_STYLE.bottom,
  };
  worksheet.getCell(`N${rowNumber}`).border = {
    top: ACTIVITY_IMAGE_BORDER_STYLE.top,
    bottom: ACTIVITY_IMAGE_BORDER_STYLE.bottom,
    right: ACTIVITY_IMAGE_BORDER_STYLE.right,
  };
}

function ensureDynamicActivityRows(
  worksheet: import("exceljs").Worksheet,
  activityCount: number,
) {
  const extraRowCount = Math.max(0, activityCount - 1);

  if (extraRowCount === 0) {
    return;
  }

  worksheet.duplicateRow(
    EXCEL_TEMPLATE_LAYOUT.activityTemplateRow,
    extraRowCount,
    true,
  );

  for (let offset = 1; offset <= extraRowCount; offset += 1) {
    const rowNumber = EXCEL_TEMPLATE_LAYOUT.activityTemplateRow + offset;
    worksheet.unMergeCells(
      `${EXCEL_TEMPLATE_LAYOUT.activityDescriptionColumn}${rowNumber}:H${rowNumber}`,
    );
    worksheet.unMergeCells(`L${rowNumber}:N${rowNumber}`);
    worksheet.mergeCells(
      `${EXCEL_TEMPLATE_LAYOUT.activityDescriptionColumn}${rowNumber}:H${rowNumber}`,
    );
    worksheet.mergeCells(`L${rowNumber}:N${rowNumber}`);
    applyMergedImageCellBorder(worksheet, rowNumber);
  }
}

function writeApprovalSection(
  worksheet: import("exceljs").Worksheet,
  report: Report,
  dynamicRowOffset: number,
) {
  const approvalRow = EXCEL_TEMPLATE_LAYOUT.approvalAnchorRow + dynamicRowOffset;
  const titleRow = approvalRow - 6;
  const labelRow = approvalRow - 5;

  mergeRangeAndSetValue(worksheet, `B${titleRow}:N${titleRow}`, "PERSETUJUAN");
  mergeRangeAndSetValue(
    worksheet,
    `B${labelRow}:G${labelRow}`,
    "KOORDINATOR TIM",
  );
  mergeRangeAndSetValue(
    worksheet,
    `I${labelRow}:N${labelRow}`,
    "KEPALA BIDANG KEDARURATAN & LOGISTIK",
  );

  mergeRangeAndSetValue(
    worksheet,
    `B${approvalRow}:G${approvalRow}`,
    report.approverCoordinator,
  );
  mergeRangeAndSetValue(
    worksheet,
    `B${approvalRow + 1}:G${approvalRow + 1}`,
    report.approverCoordinatorNip,
  );
  mergeRangeAndSetValue(
    worksheet,
    `I${approvalRow}:N${approvalRow}`,
    report.approverDivisionHead,
  );
  mergeRangeAndSetValue(
    worksheet,
    `I${approvalRow + 1}:N${approvalRow + 1}`,
    report.approverDivisionHeadTitle,
  );
  mergeRangeAndSetValue(
    worksheet,
    `I${approvalRow + 2}:N${approvalRow + 2}`,
    report.approverDivisionHeadNip,
  );
}

function writeNotesSection(
  worksheet: import("exceljs").Worksheet,
  notes: string[],
  dynamicRowOffset: number,
) {
  const noteStartRow = EXCEL_TEMPLATE_LAYOUT.notesStartRow + dynamicRowOffset;
  const templateNoteRows = 2;
  const extraNoteRows = Math.max(0, notes.length - templateNoteRows);

  if (extraNoteRows > 0) {
    worksheet.duplicateRow(noteStartRow + templateNoteRows - 1, extraNoteRows, true);
  }

  notes.forEach((noteText, index) => {
    const rowNumber = noteStartRow + index;
    const noteCell = worksheet.getCell(
      buildCellAddress(EXCEL_TEMPLATE_LAYOUT.noteTextColumn, rowNumber),
    );

    worksheet.unMergeCells(
      `${EXCEL_TEMPLATE_LAYOUT.noteTextColumn}${rowNumber}:${EXCEL_TEMPLATE_LAYOUT.noteTextMergeEndColumn}${rowNumber}`,
    );
    worksheet.mergeCells(
      `${EXCEL_TEMPLATE_LAYOUT.noteTextColumn}${rowNumber}:${EXCEL_TEMPLATE_LAYOUT.noteTextMergeEndColumn}${rowNumber}`,
    );
    worksheet.getCell(
      buildCellAddress(EXCEL_TEMPLATE_LAYOUT.noteNumberColumn, rowNumber),
    ).value = index + 1;
    noteCell.value = noteText;
    noteCell.alignment = {
      ...noteCell.alignment,
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
  });
}

function resolveOptimizedPhotoUrl(photo: ReportActivityPhoto) {
  if (!supabase || !photo.storagePath) {
    return photo.publicUrl;
  }

  const { data } = supabase.storage
    .from(PROOF_BUCKET)
    .getPublicUrl(photo.storagePath, {
      transform: {
        width: 1200,
        height: 1200,
        quality: 80,
        resize: "contain",
      },
    });

  return data.publicUrl || photo.publicUrl;
}

async function convertImageBlobToPngBuffer(
  blob: Blob,
): Promise<ExcelPreparedImage> {
  if (blob.type === "image/png") {
    const bitmap = await createImageBitmap(blob);
    const buffer = await blob.arrayBuffer();
    const payload = {
      buffer,
      extension: "png" as const,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    return {
      ...payload,
    };
  }

  if (blob.type === "image/jpeg" || blob.type === "image/jpg") {
    const bitmap = await createImageBitmap(blob);
    const buffer = await blob.arrayBuffer();
    const payload = {
      buffer,
      extension: "jpeg" as const,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    return {
      ...payload,
    };
  }

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas browser belum siap untuk konversi gambar.");
  }

  context.drawImage(bitmap, 0, 0);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
        } else {
          reject(new Error("Konversi gambar ke PNG belum berhasil."));
        }
      },
      "image/png",
      0.92,
    );
  });

  bitmap.close();

  return {
    buffer: await pngBlob.arrayBuffer(),
    extension: "png",
    width: bitmap.width,
    height: bitmap.height,
  };
}

async function fetchExcelImage(photo: ReportActivityPhoto) {
  try {
    const response = await fetch(resolveOptimizedPhotoUrl(photo));

    if (!response.ok) {
      throw new Error(
        `Foto ${photo.originalFileName} gagal dimuat (${response.status}).`,
      );
    }

    const blob = await response.blob();
    return await convertImageBlobToPngBuffer(blob);
  } catch (error) {
    console.error("Gagal mengambil gambar Excel.", error);
    return null;
  }
}

export async function generateDailyReportExcel({
  report,
  template,
}: GenerateReportExcelOptions) {
  const [{ Workbook }, templateBuffer] = await Promise.all([
    import("exceljs"),
    getExcelTemplateBuffer(template),
  ]);

  const workbook = new Workbook();
  await workbook.xlsx.load(templateBuffer);

  const mappedReport = mapReportToExcelTemplate(report);
  const worksheet = workbook.worksheets[mappedReport.worksheetIndex] ?? workbook.worksheets[0];
  const dynamicRowOffset = Math.max(0, report.activities.length - 1);

  ensureDynamicActivityRows(worksheet, report.activities.length);

  mappedReport.textCells.forEach((cellPatch) => {
    worksheet.getCell(cellPatch.cell).value = cellPatch.value;
  });

  writeApprovalSection(worksheet, report, dynamicRowOffset);
  writeNotesSection(worksheet, mappedReport.notes, dynamicRowOffset);

  for (const imagePatch of mappedReport.imageCells) {
    const imagePayload = await fetchExcelImage(imagePatch.photo);

    if (!imagePayload) {
      continue;
    }

    const mergedCellWidthPixels = getMergedRangeWidthPixels(
      worksheet,
      imagePatch.range.startColumn,
      imagePatch.range.endColumn,
    );
    const imageCellLayout = getImageCellLayout(
      worksheet,
      imagePatch.range.startRow,
      imagePayload.width,
      imagePayload.height,
      mergedCellWidthPixels,
    );

    const imageId = workbook.addImage(imagePayload);
    worksheet.addImage(imageId, {
      tl: {
        col: imagePatch.range.startColumn - 1 + 0.08,
        row:
          imagePatch.range.startRow - 1 + imageCellLayout.topOffsetRatio,
      },
      ext: {
        width: imageCellLayout.paddedImageWidth,
        height: imageCellLayout.paddedImageHeight,
      },
      editAs: "oneCell",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
  saveAs(blob, buildExcelFileName(report));
}
