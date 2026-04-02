import Swal from "sweetalert2";

const popupClass = "rounded-[28px]";

export async function askConfirmation(title: string, text: string, confirmText: string) {
  const result = await Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Batal",
    reverseButtons: true,
    customClass: {
      popup: popupClass,
      confirmButton: "swal-confirm",
      cancelButton: "swal-cancel",
    },
    buttonsStyling: false,
  });

  return result.isConfirmed;
}

export function showSuccess(title: string, text: string) {
  return Swal.fire({
    title,
    text,
    icon: "success",
    confirmButtonText: "Tutup",
    customClass: {
      popup: popupClass,
      confirmButton: "swal-confirm",
    },
    buttonsStyling: false,
  });
}

export function showError(title: string, text: string) {
  return Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonText: "Tutup",
    customClass: {
      popup: popupClass,
      confirmButton: "swal-confirm",
    },
    buttonsStyling: false,
  });
}

export function showInfo(title: string, text: string) {
  return Swal.fire({
    title,
    text,
    icon: "info",
    confirmButtonText: "Mengerti",
    customClass: {
      popup: popupClass,
      confirmButton: "swal-confirm",
    },
    buttonsStyling: false,
  });
}

export async function askPdfPaperSize(): Promise<"a4" | "f4" | "legal" | "letter" | null> {
  const result = await Swal.fire({
    title: "Pilih Ukuran Kertas",
    text: "Tentukan ukuran dokumen PDF yang akan diunduh.",
    input: "select",
    inputOptions: {
      a4: "A4 (210 x 297 mm)",
      f4: "F4 / Folio (210 x 330 mm)",
      legal: "Legal (216 x 356 mm)",
      letter: "Letter (216 x 279 mm)",
    },
    inputValue: "a4",
    showCancelButton: true,
    confirmButtonText: "Unduh PDF",
    cancelButtonText: "Batal",
    reverseButtons: true,
    customClass: {
      popup: popupClass,
      confirmButton: "swal-confirm",
      cancelButton: "swal-cancel",
    },
    buttonsStyling: false,
  });

  if (result.isConfirmed) {
    return result.value as "a4" | "f4" | "legal" | "letter";
  }
  return null;
}
