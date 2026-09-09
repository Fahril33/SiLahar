const MAX_IMAGE_EDGE_PX = 1600;
const TARGET_MIME_TYPE = "image/webp";
const TARGET_QUALITY = 0.82;
const MIN_SIZE_TO_OPTIMIZE_BYTES = 180 * 1024;

function toOptimizedFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") + ".webp";
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Gambar ${file.name} belum bisa diproses.`));
    };

    image.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, TARGET_MIME_TYPE, TARGET_QUALITY);
  });
}

let heic2anyLoader: any = null;

/**
 * Cek apakah file merupakan format HEIC / HEIF berdasarkan ekstensi, MIME type, atau magic bytes
 */
export async function isHeicImage(file: File): Promise<boolean> {
  if (!file) return false;
  const name = file.name || "";
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (extension === "heic" || extension === "heif") {
    return true;
  }

  const mime = (file.type || "").toLowerCase();
  if (
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime === "image/heic-sequence" ||
    mime === "image/heif-sequence" ||
    mime.includes("heic") ||
    mime.includes("heif")
  ) {
    return true;
  }

  // Cek magic bytes untuk header ISO Base Media File Format (ftyp box) jika mime type tidak diset oleh OS
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 12) {
      const ftyp = String.fromCharCode(...bytes.slice(4, 8));
      if (ftyp === "ftyp") {
        const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
        if (
          brand.includes("hei") ||
          brand.includes("mif") ||
          brand.includes("heic") ||
          brand.includes("heix") ||
          brand.includes("hevc") ||
          brand.includes("heim")
        ) {
          return true;
        }
      }
    }
  } catch {
    // Abaikan kegagalan baca magic byte
  }

  return false;
}

/**
 * Ekstrak file gambar dari DataTransfer clipboard (baik dari files maupun items/blobs)
 */
export function extractImageFilesFromClipboard(
  clipboardData: DataTransfer | null | undefined,
): File[] {
  if (!clipboardData) return [];

  const results: File[] = [];

  // 1. Cek dari clipboardData.files (file yang disalin langsung dari Finder/Explorer)
  if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      const isImg =
        file.type.startsWith("image/") ||
        /\.(heic|heif|png|jpe?g|webp|gif|bmp|tiff|svg)$/i.test(file.name);
      if (isImg) {
        results.push(file);
      }
    }
  }

  // 2. Cek dari clipboardData.items (screenshot, gambar dari browser, canvas blobs)
  if (results.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === "file" || item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const extension = item.type.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "png";
          const fileName =
            file.name && file.name !== "image.png" && file.name !== "blob"
              ? file.name
              : `pasted-image-${Date.now()}-${i + 1}.${extension}`;

          const namedFile = new File([file], fileName, {
            type: file.type || item.type || "image/png",
            lastModified: Date.now(),
          });
          results.push(namedFile);
        }
      }
    }
  }

  return results;
}

/**
 * Mengonversi file HEIC / HEIF menjadi JPEG menggunakan heic2any
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  if (typeof window === "undefined") {
    return file;
  }

  if (!heic2anyLoader) {
    const mod = await import("heic2any");
    heic2anyLoader = mod.default || mod;
  }

  // Salin buffer ke Blob murni dengan tipe eksplisit agar heic2any bekerja konsisten di seluruh browser
  const arrayBuffer = await file.arrayBuffer();
  const inputBlob = new Blob([arrayBuffer], {
    type: file.type || "image/heic",
  });

  const result = await heic2anyLoader({
    blob: inputBlob,
    toType: "image/jpeg",
    quality: 0.88,
  });

  const outputBlob: Blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpeg";

  return new File([outputBlob], newName, {
    type: "image/jpeg",
    lastModified: file.lastModified || Date.now(),
  });
}

/**
 * Optimasi gambar laporan:
 * 1. Otomatis deteksi & konversi HEIC/HEIF ke JPEG
 * 2. Downscale jika resolusi di atas batas piksel maksimal
 * 3. Konversi format output ke WebP berkualitas tinggi dengan kompresi optimal
 */
export async function optimizeReportImage(file: File): Promise<File> {
  let workingFile = file;

  const isHeic = await isHeicImage(file);
  if (isHeic) {
    try {
      workingFile = await convertHeicToJpeg(file);
    } catch (e) {
      console.error("Gagal melakukan konversi HEIC ke JPEG:", e);
    }
  }

  const isImageFile =
    workingFile.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(workingFile.name);

  if (!isImageFile) {
    return workingFile;
  }

  if (workingFile.size < MIN_SIZE_TO_OPTIMIZE_BYTES && workingFile.type === TARGET_MIME_TYPE) {
    return workingFile;
  }

  try {
    const image = await loadImageFromFile(workingFile);
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE_PX / Math.max(image.naturalWidth, image.naturalHeight, 1),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    if (!context) {
      return workingFile;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const optimizedBlob = await canvasToBlob(canvas);

    if (!optimizedBlob || (optimizedBlob.size >= workingFile.size && workingFile.type === TARGET_MIME_TYPE)) {
      return workingFile;
    }

    return new File([optimizedBlob], toOptimizedFileName(workingFile.name), {
      type: optimizedBlob.type || TARGET_MIME_TYPE,
      lastModified: workingFile.lastModified || Date.now(),
    });
  } catch (error) {
    console.error("Gagal melakukan kompresi canvas gambar:", error);
    return workingFile;
  }
}

export async function optimizeReportImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => optimizeReportImage(file)));
}

