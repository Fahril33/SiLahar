import Swal from "sweetalert2";
import { playSound } from "./sound-utils";

const confirmPopupClass = "swal-modern-popup";
const toastPopupClass = "swal-modern-toast";
const progressToastPopupClass = "swal-progress-toast";

export type ProgressToastStage = {
  id: string;
  label: string;
};

type ProgressToastStageState = "pending" | "active" | "done";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderProgressToastHtml(
  stages: ProgressToastStage[],
  stageStates: Record<string, ProgressToastStageState>,
  stageTexts: Record<string, string>,
) {
  return `
    <div class="swal-progress-list" role="list">
      ${stages
        .map((stage) => {
          const state = stageStates[stage.id] ?? "pending";
          const detail = stageTexts[stage.id];
          const indicator =
            state === "done"
              ? '<span class="swal-progress-indicator-icon">✓</span>'
              : state === "active"
                ? '<span class="swal-progress-indicator-spinner"></span>'
                : '<span class="swal-progress-indicator-dot"></span>';

          return `
            <div class="swal-progress-row is-${state}" role="listitem">
              <span class="swal-progress-indicator" aria-hidden="true">${indicator}</span>
              <div class="swal-progress-content">
                <div class="swal-progress-label">${escapeHtml(stage.label)}</div>
                ${
                  detail
                    ? `<div class="swal-progress-detail">${escapeHtml(detail)}</div>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function fireToast(icon: "success" | "error" | "info", title: string, text: string) {
  void Swal.fire({
    toast: true,
    position: "top",
    icon,
    title,
    text,
    timer: icon === "error" ? 5200 : 3400,
    timerProgressBar: true,
    showConfirmButton: false,
    showCloseButton: false,
    
    didOpen: (toast) => {
      toast.onmouseenter = () => Swal.stopTimer();
      toast.onmouseleave = () => Swal.resumeTimer();
      toast.onclick = () => Swal.close();
    },
    customClass: {
      popup: toastPopupClass,
      title: "swal-toast-title",
      htmlContainer: "swal-toast-text",
      icon: "swal-toast-icon",
    },
    buttonsStyling: false,
  });

  return Promise.resolve();
}

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
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
      confirmButton: "swal-confirm",
      cancelButton: "swal-cancel",
    },
    buttonsStyling: false,
  });

  return result.isConfirmed;
}

export async function askAcknowledge(
  title: string,
  text: string,
  confirmText = "OK",
) {
  await Swal.fire({
    title,
    text,
    icon: "info",
    confirmButtonText: confirmText,
    customClass: {
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
      confirmButton: "swal-confirm",
    },
    buttonsStyling: false,
  });
}

export async function askSlowSaveFallback() {
  const result = await Swal.fire({
    title: "Simpan masih berjalan",
    text: "Anda bisa simpan snapshot ke draft lokal agar aman, atau biarkan proses upload tetap lanjut di background sementara Anda pindah halaman.",
    icon: "info",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "Simpan draft lokal",
    denyButtonText: "Lanjut di background",
    cancelButtonText: "Tetap tunggu",
    reverseButtons: true,
    customClass: {
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
      confirmButton: "swal-confirm",
      denyButton: "swal-cancel",
      cancelButton: "swal-cancel",
    },
    buttonsStyling: false,
  });

  if (result.isConfirmed) {
    return "save-local" as const;
  }

  if (result.isDenied) {
    return "background" as const;
  }

  return "wait" as const;
}

export async function askDraftUploadConfirmation(options: {
  title: string;
  text: string;
  confirmText?: string;
}) {
  const checkboxId = "delete-draft-after-upload";
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Lanjut upload",
    cancelButtonText: "Batal",
    reverseButtons: true,
    input: "checkbox",
    inputValue: 0,
    inputPlaceholder: "Hapus draft ini setelah upload",
    inputAttributes: { id: checkboxId },
    customClass: {
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
      confirmButton: "swal-confirm",
      cancelButton: "swal-cancel",
    },
    buttonsStyling: false,
  });

  return {
    confirmed: result.isConfirmed,
    deleteAfterUpload: Boolean(result.value),
  };
}

export function showSuccess(title: string, text: string) {
  playSound("success");
  return fireToast("success", title, text);
}

export function showError(title: string, text: string) {
  playSound("fail");
  return fireToast("error", title, text);
}

export function showInfo(title: string, text: string) {
  return fireToast("info", title, text);
}

export function openProgressToast(title: string, stages: ProgressToastStage[]) {
  const stageStates = Object.fromEntries(
    stages.map((stage) => [stage.id, "pending" as ProgressToastStageState]),
  );
  const stageTexts = Object.fromEntries(stages.map((stage) => [stage.id, ""]));

  void Swal.fire({
    toast: true,
    position: "top",
    icon: "info",
    title,
    html: renderProgressToastHtml(stages, stageStates, stageTexts),
    showConfirmButton: false,
    showCloseButton: false,
    timer: undefined,
    timerProgressBar: false,
    customClass: {
      popup: `${toastPopupClass} ${progressToastPopupClass}`,
      title: "swal-toast-title",
      htmlContainer: "swal-toast-text",
      icon: "swal-toast-icon",
    },
    buttonsStyling: false,
  });

  return {
    update(stageId: string, detail?: string) {
      const popup = Swal.getPopup();
      if (!popup?.classList.contains("swal-progress-toast")) {
        return;
      }

      const activeIndex = stages.findIndex((stage) => stage.id === stageId);
      if (activeIndex === -1) {
        return;
      }

      stages.forEach((stage, index) => {
        stageStates[stage.id] =
          index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
      });

      if (detail !== undefined) {
        stageTexts[stageId] = detail;
      }

      const titleElement = popup.querySelector(".swal-toast-title");
      if (titleElement) {
        titleElement.textContent = title;
      }

      const htmlContainer = popup.querySelector(".swal2-html-container");
      if (htmlContainer) {
        htmlContainer.innerHTML = renderProgressToastHtml(
          stages,
          stageStates,
          stageTexts,
        );
      }
    },
    close() {
      const popup = Swal.getPopup();
      if (popup?.classList.contains("swal-progress-toast")) {
        Swal.close();
      }
    },
  };
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
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
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
