const MAX_IMAGE_EDGE_PX = 1280;
const TARGET_QUALITY = 0.75;
const MAX_FILE_SIZE_BYTES = 350 * 1024; // Target maksimal ~350 KB per gambar

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

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, mimeType, quality);
    } catch {
      resolve(null);
    }
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
 * 2. Downscale jika resolusi di atas 1280px
 * 3. Kompresi ke WebP atau JPEG berkualitas optimal dengan target ukuran < 350 KB
 * 4. Mencegah bug fallback canvas browser yang diam-diam menghasilkan PNG 2MB+
 */
export async function optimizeReportImage(file: File): Promise<File> {
  let workingFile = file;

  // 1. Konversi HEIC / HEIF jika dari iPhone
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

  // Jika file sudah WebP/JPEG dan ukurannya sudah sangat ringan (< 150 KB), tidak perlu kompresi ulang
  if (
    workingFile.size < 150 * 1024 &&
    (workingFile.type === "image/webp" || workingFile.type === "image/jpeg")
  ) {
    return workingFile;
  }

  try {
    const image = await loadImageFromFile(workingFile);

    const renderCanvas = (maxEdge: number): { canvas: HTMLCanvasElement; width: number; height: number } => {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight, 1));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });

      if (context) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
      }

      return { canvas, width, height };
    };

    // Pass 1: Maksimal 1280px pada sisi terpanjang dengan quality 0.75
    let { canvas } = renderCanvas(MAX_IMAGE_EDGE_PX);
    let quality = TARGET_QUALITY;

    // Coba WebP terlebih dahulu
    let bestBlob = await canvasToBlob(canvas, "image/webp", quality);

    // KRITIKAL: Banyak browser (Safari/iOS/Webview) jika tidak mendukung encoding WebP pada canvas
    // akan secara diam-diam menghasilkan "image/png" tanpa kompresi yang ukurannya 2MB - 3MB!
    // Deteksi jika tipe yang dihasilkan adalah PNG atau bukan WebP, lalu fallback ke JPEG:
    if (!bestBlob || bestBlob.type === "image/png" || bestBlob.type !== "image/webp") {
      bestBlob = await canvasToBlob(canvas, "image/jpeg", quality);
    } else {
      // Jika WebP berhasil, bandingkan dengan JPEG untuk memilih ukuran paling efisien
      const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (jpegBlob && jpegBlob.size < bestBlob.size) {
        bestBlob = jpegBlob;
      }
    }

    // Pass 2: Jika ukuran file masih lebih besar dari 350 KB, lakukan kompresi adaptif lanjutan (1024px, 0.70)
    if (bestBlob && bestBlob.size > MAX_FILE_SIZE_BYTES) {
      const secondPass = renderCanvas(1024);
      const secondWebp = await canvasToBlob(secondPass.canvas, "image/webp", 0.70);
      const secondJpeg = await canvasToBlob(secondPass.canvas, "image/jpeg", 0.70);

      if (secondWebp && secondWebp.type === "image/webp" && secondWebp.size <= (secondJpeg?.size || Infinity)) {
        bestBlob = secondWebp;
      } else if (secondJpeg && secondJpeg.type !== "image/png") {
        bestBlob = secondJpeg;
      }
    }

    if (!bestBlob) {
      return workingFile;
    }

    // Tentukan ekstensi yang benar sesuai format riil blob
    const isWebp = bestBlob.type === "image/webp";
    const extension = isWebp ? ".webp" : ".jpg";
    const baseName = workingFile.name.replace(/\.[^.]+$/, "");
    const finalFileName = `${baseName}${extension}`;

    return new File([bestBlob], finalFileName, {
      type: bestBlob.type,
      lastModified: workingFile.lastModified || Date.now(),
    });
  } catch (error) {
    console.error("Gagal melakukan kompresi gambar:", error);
    return workingFile;
  }
}

export async function optimizeReportImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => optimizeReportImage(file)));
}


