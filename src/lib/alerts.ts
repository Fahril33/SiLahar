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
