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

export async function askConfirmation(
  title: string,
  text: string,
  confirmText: string,
  options?: {
    icon?: "warning" | "error" | "success" | "info" | "question";
    html?: string;
    cancelButtonText?: string;
  },
) {
  const isHtml = Boolean(options?.html) || text.trim().startsWith("<") || text.includes("<div") || text.includes("<p");
  const result = await Swal.fire({
    title,
    ...(isHtml ? { html: options?.html || text } : { text }),
    icon: options?.icon || "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: options?.cancelButtonText || "Batal",
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

export interface AskPasswordConfirmationOptions {
  title: string;
  text: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  placeholder?: string;
  onValidate?: (password: string) => Promise<string | null | undefined> | (string | null | undefined);
}

export async function askPasswordConfirmation(
  options: AskPasswordConfirmationOptions,
): Promise<{ confirmed: boolean; password?: string }> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: "warning",
    input: "password",
    inputPlaceholder: options.placeholder || "Masukkan password administrator...",
    inputAttributes: {
      autocapitalize: "off",
      autocorrect: "off",
      autocomplete: "off",
      name: "silahar_verify_pwd_challenge",
      id: "silahar_verify_pwd_challenge",
      "data-lpignore": "true",
      "data-1p-ignore": "true",
      "data-form-type": "other",
      spellcheck: "false",
    },
    didOpen: () => {
      const input = Swal.getInput();
      if (input) {
        input.setAttribute("autocomplete", "off");
        input.setAttribute("data-lpignore", "true");
        input.setAttribute("data-1p-ignore", "true");
        input.setAttribute("data-form-type", "other");
        input.readOnly = true;
        setTimeout(() => {
          input.readOnly = false;
          input.focus();
        }, 120);
      }
    },
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText || "Konfirmasi & Lanjutkan",
    cancelButtonText: options.cancelButtonText || "Batal",
    reverseButtons: true,
    showLoaderOnConfirm: true,
    customClass: {
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
      input: "swal-password-input",
      confirmButton: "swal-confirm swal-btn-danger",
      cancelButton: "swal-cancel",
    },
    buttonsStyling: false,
    preConfirm: async (password: string) => {
      const trimmed = (password || "").trim();
      if (!trimmed) {
        Swal.showValidationMessage("Password tidak boleh kosong!");
        return false;
      }
      if (options.onValidate) {
        try {
          const err = await options.onValidate(password);
          if (err) {
            Swal.showValidationMessage(err);
            return false;
          }
        } catch (validationErr: any) {
          Swal.showValidationMessage(validationErr?.message || "Validasi password gagal.");
          return false;
        }
      }
      return password;
    },
    allowOutsideClick: () => !Swal.isLoading(),
  });

  if (result.isConfirmed && typeof result.value === "string") {
    return { confirmed: true, password: result.value };
  }
  return { confirmed: false };
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

export function isSlowSaveFallbackOpen(): boolean {
  const popup = Swal.getPopup();
  return Boolean(popup && popup.classList.contains("swal-slow-save-popup") && Swal.isVisible());
}

export function closeSlowSaveFallback(): void {
  if (isSlowSaveFallbackOpen()) {
    Swal.close();
  }
}

export async function askSlowSaveFallback(): Promise<"save-local" | "wait"> {
  const result = await Swal.fire({
    title: "Pengunggahan Sedang Berjalan",
    html: `
      <div class="swal-slow-save-content">
        <div class="swal-slow-save-status">
          <span class="swal-slow-save-spinner"></span>
          <span>Proses membutuhkan waktu lebih lama (koneksi lambat)</span>
        </div>
        <p class="swal-slow-save-desc">
          Dokumen dan foto Anda sedang diunggah ke server. Anda dapat <strong>tetap menunggu</strong> proses selesai, atau <strong>menyimpan cadangan ke draft</strong> perangkat agar aman.
        </p>
      </div>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Tetap Menunggu",
    cancelButtonText: "Cadangkan ke Draft",
    reverseButtons: true,
    allowOutsideClick: true,
    customClass: {
      popup: `${confirmPopupClass} swal-slow-save-popup`,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
      icon: "swal-dialog-icon",
      confirmButton: "swal-confirm swal-btn-wait",
      cancelButton: "swal-cancel swal-btn-draft",
    },
    buttonsStyling: false,
  });

  if (result.dismiss === Swal.DismissReason.cancel) {
    return "save-local";
  }

  return "wait";
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

function buildSaveErrorModalHtml(options: {
  explanation: string;
  action: string;
  technicalDetail?: string;
}) {
  return `
    <div class="text-left space-y-3 pt-1 text-slate-700 dark:text-slate-200">
      <div class="p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl">
        <div class="flex items-start gap-2.5">
          <span class="text-base select-none leading-none mt-0.5" aria-hidden="true">🛡️</span>
          <div class="space-y-0.5">
            <p class="font-semibold text-xs tracking-wider uppercase text-emerald-800 dark:text-emerald-300">Data Anda Tetap Aman</p>
            <p class="text-xs sm:text-sm text-emerald-950 dark:text-emerald-100 leading-relaxed font-normal">${options.explanation}</p>
          </div>
        </div>
      </div>

      <div class="p-3 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-xl">
        <div class="flex items-start gap-2.5">
          <span class="text-base select-none leading-none mt-0.5" aria-hidden="true">💡</span>
          <div class="space-y-0.5">
            <p class="font-semibold text-xs tracking-wider uppercase text-blue-800 dark:text-blue-300">Saran Tindakan</p>
            <p class="text-xs sm:text-sm text-blue-950 dark:text-blue-100 leading-relaxed font-normal">${options.action}</p>
          </div>
        </div>
      </div>

      ${
        options.technicalDetail
          ? `
        <details class="text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-800">
          <summary class="cursor-pointer hover:underline text-slate-600 dark:text-slate-300 select-none py-0.5">
            Rincian Teknis (Untuk Administrator)
          </summary>
          <div class="mt-1.5 p-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded text-slate-800 dark:text-slate-200 font-mono text-[10px] break-all leading-relaxed select-all">
            ${escapeHtml(options.technicalDetail)}
          </div>
        </details>
      `
          : ""
      }
    </div>
  `;
}

export interface SaveErrorContext {
  title: string;
  text: string;
  html: string;
  confirmText: string;
  isOffline: boolean;
  icon: "warning" | "error" | "info" | "question";
  explanation: string;
  rawMessage: string;
}

export function resolveSaveErrorContext(err: unknown): SaveErrorContext {
  const isBrowserOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
      ? err.message
      : typeof err === "string"
      ? err
      : "Terjadi kesalahan saat memproses data.";

  const lower = rawMsg.toLowerCase();

  let title = "Kendala Penyimpanan Laporan";
  let icon: "warning" | "error" | "info" | "question" = "warning";
  let explanation =
    "Terjadi kendala saat menyinkronkan laporan ke database pusat. Isian teks dan foto Anda tetap kami amankan di memori perangkat.";
  let action =
    "Klik <strong>Simpan ke Draf Lokal</strong> sekarang agar isian Anda tidak hilang, lalu coba kirimkan kembali setelah koneksi siap.";
  let confirmText = "Simpan ke Draf Lokal";
  let isOffline = false;

  if (isBrowserOffline) {
    title = "Perangkat Sedang Offline";
    icon = "warning";
    explanation =
      "Perangkat Anda sedang tidak terhubung ke jaringan internet. Seluruh data laporan dan foto yang telah Anda isi tetap terjaga di perangkat ini.";
    action =
      "Simpan ke <strong>Draf Lokal</strong> sekarang. Anda dapat mengirimkannya kembali saat sinyal internet sudah terhubung kembali.";
    confirmText = "Simpan ke Draf Lokal";
    isOffline = true;
  } else if (
    lower.includes("violates foreign key constraint") ||
    lower.includes("foreign key") ||
    lower.includes("23503") ||
    lower.includes("template_id_fkey") ||
    lower.includes("report_templates") ||
    lower.includes("report_template_approvers")
  ) {
    title = "Penyelarasan Format Sistem";
    icon = "info";
    explanation =
      "Data ketikan dan foto Anda aman. Server pusat baru saja memperbarui konfigurasi data template/database, sehingga browser/aplikasi Anda perlu menyelaraskan data terbaru.";
    action =
      "Klik <strong>Simpan ke Draf Lokal</strong> agar isian tidak hilang. Setelah itu, segarkan (refresh) halaman atau tutup-buka kembali aplikasi pada ponsel Anda untuk mengirim ulang.";
    confirmText = "Simpan ke Draf Lokal (Aman)";
  } else if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("net::err") ||
    lower.includes("timeout") ||
    lower.includes("abort") ||
    lower.includes("gateway") ||
    lower.includes("service unavailable") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  ) {
    title = "Koneksi Server Terkendala";
    icon = "warning";
    explanation =
      "Tidak dapat menjangkau server pusat saat ini. Hal ini biasanya terjadi akibat sinyal seluler yang tidak stabil atau server sedang sibuk.";
    action =
      "Data Anda tidak akan hilang. Simpan ke <strong>Draf Lokal</strong> terlebih dahulu dan Anda dapat mengirimkannya kembali saat sinyal sudah stabil.";
    confirmText = "Simpan ke Draf Lokal";
  } else if (
    lower.includes("row-level security") ||
    lower.includes("42501") ||
    lower.includes("permission denied") ||
    lower.includes("akses dibatasi") ||
    lower.includes("tanggal laporan")
  ) {
    title = "Akses Pengisian Dibatasi";
    icon = "warning";
    explanation =
      "Sistem membatasi pengisian atau perubahan laporan untuk tanggal yang dipilih sesuai kebijakan aturan tanggal operasional yang berlaku.";
    action =
      "Anda dapat menyimpan salinan laporan ini ke <strong>Draf Lokal</strong> sebagai arsip catatan di perangkat Anda.";
    confirmText = "Simpan ke Draf Lokal";
  } else if (
    lower.includes("duplicate key") ||
    lower.includes("23505") ||
    lower.includes("already exists")
  ) {
    title = "Laporan Sudah Tercatat";
    icon = "info";
    explanation =
      "Laporan dengan tanggal atau identitas ini sudah tercatat sebelumnya di server.";
    action =
      "Simpan ke <strong>Draf Lokal</strong> jika Anda ingin mengamankan catatan perubahan Anda, atau periksa kembali daftar laporan di menu Riwayat.";
    confirmText = "Simpan ke Draf Lokal";
  }

  const html = buildSaveErrorModalHtml({
    explanation,
    action,
    technicalDetail: rawMsg,
  });

  const plainText = `${explanation}\n\n${action.replace(/<[^>]+>/g, "")}\n\nIngin simpan laporan ini ke Draft Lokal sekarang agar data Anda tetap aman?`;

  return {
    title,
    text: plainText,
    html,
    confirmText,
    isOffline,
    icon,
    explanation,
    rawMessage: rawMsg,
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
  let isClosed = false;

  function mountToast() {
    if (isClosed) return;
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
  }

  mountToast();

  return {
    update(stageId: string, detail?: string) {
      if (isClosed) return;

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

      const popup = Swal.getPopup();
      if (popup?.classList.contains("swal-progress-toast")) {
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
      } else {
        // Jika tidak ada dialog slow save yang sedang aktif, re-mount toast dengan spinner aktif
        if (!Swal.isVisible() || !popup?.classList.contains("swal-slow-save-popup")) {
          mountToast();
        }
      }
    },
    resume() {
      if (isClosed) return;
      mountToast();
    },
    close() {
      isClosed = true;
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

export function showProcessingToast(title: string, text: string) {
  void Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    customClass: {
      popup: confirmPopupClass,
      title: "swal-dialog-title",
      htmlContainer: "swal-dialog-text",
    },
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

export function closeProcessingToast() {
  Swal.close();
}
