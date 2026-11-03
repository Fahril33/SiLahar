const MAX_IMAGE_FILE_SIZE_BYTES = 300 * 1024; // Target maksimal <= 300 KB per gambar

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

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Universal canvas blob exporter:
 * 1. Mencoba canvas.toBlob()
 * 2. Mencegah browser (terutama Safari/iOS/Webview) diam-diam menghasilkan PNG besar saat meminta WebP
 * 3. Fallback ke canvas.toDataURL() jika toBlob gagal atau tidak didukung pada perangkat mobile
 * 4. Menjamin hasil BUKAN image/png
 */
async function exportCanvasBlob(
  canvas: HTMLCanvasElement,
  preferredMimeType: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob | null> {
  // 1. Coba canvas.toBlob
  let blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, preferredMimeType, quality);
    } catch {
      resolve(null);
    }
  });

  // Jika browser menghasilkan MIME type yang valid dan BUKAN PNG
  if (blob && blob.type === preferredMimeType) {
    return blob;
  }

  // 2. Jika meminta WebP dan browser fallback ke PNG atau gagal, coba JPEG via toBlob
  if (preferredMimeType === "image/webp") {
    blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, "image/jpeg", quality);
      } catch {
        resolve(null);
      }
    });
    if (blob && blob.type === "image/jpeg") {
      return blob;
    }
  }

  // 3. Fallback universal via toDataURL (didukung 100% di semua browser mobile / desktop)
  try {
    let dataUrl = canvas.toDataURL(preferredMimeType, quality);
    // Jika browser diam-diam mengonversi ke image/png, paksa ke image/jpeg
    if (!dataUrl.startsWith(`data:${preferredMimeType}`)) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/webp")) {
      const converted = dataUrlToBlob(dataUrl);
      if (converted.type !== "image/png") {
        return converted;
      }
    }
  } catch {
    // Canvas tainted atau kehabisan memori
  }

  return null;
}

type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

/**
 * Mendekode gambar menggunakan createImageBitmap (lebih cepat, off-thread, mendukung orientasi EXIF kamera mobile)
 * dengan fallback ke HTMLImageElement.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        close: () => bitmap.close(),
      };
    } catch {
      // Fallback ke HTMLImageElement jika createImageBitmap gagal (misal format tertentu)
    }
  }

  const img = await loadImageFromFile(file);
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    close: () => {},
  };
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
    quality: 0.75,
  });

  const outputBlob: Blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpeg";

  return new File([outputBlob], newName, {
    type: "image/jpeg",
    lastModified: file.lastModified || Date.now(),
  });
}

export type OptimizeImageOptions = {
  forceMimeType?: "image/jpeg" | "image/webp";
};

/**
 * Optimasi gambar laporan:
 * 1. Otomatis deteksi & konversi HEIC/HEIF dari kamera ponsel (dengan prioritas decode native Safari/iOS)
 * 2. Menghindari konversi ulang jika file sudah JPEG/WebP dan ukurannya sudah <= 300 KB
 * 3. Menggunakan createImageBitmap untuk akselerasi grafis & orientasi EXIF mobile
 * 4. Mencegah bug canvas fallback yang diam-diam menghasilkan PNG 2.9 MB+
 * 5. Kompresi adaptif multi-tahap (1280px -> 1080px -> 900px -> 750px -> 640px)
 *    hingga ukuran file dijamin <= 300 KB dengan kualitas visual tetap tajam
 * 6. Menjaga kompatibilitas ekstensi berkas (JPEG tidak diubah menjadi WebP binary jika file adalah .jpg)
 */
export async function optimizeReportImage(
  file: File,
  options?: OptimizeImageOptions,
): Promise<File> {
  if (typeof window === "undefined" && typeof document === "undefined") {
    return file;
  }
  let workingFile = file;

  // 1. Cek HEIC / HEIF dari kamera iPhone / iPad
  const isHeic = await isHeicImage(file);
  if (isHeic) {
    // Uji apakah browser sudah mendukung HEIC secara native (misal iOS 17+ Safari)
    let nativeWorks = false;
    try {
      const test = await decodeImage(file);
      test.close();
      nativeWorks = true;
    } catch {
      nativeWorks = false;
    }

    if (!nativeWorks) {
      try {
        workingFile = await convertHeicToJpeg(file);
      } catch (e) {
        console.error("Gagal melakukan konversi HEIC ke JPEG:", e);
      }
    }
  }

  const isImageFile =
    workingFile.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(workingFile.name);

  if (!isImageFile) {
    return workingFile;
  }

  // Tentukan apakah harus memaksa format JPEG untuk menjaga kompatibilitas berkas (.jpg / Excel)
  const isJpgExtension = /\.(jpe?g)$/i.test(workingFile.name);
  const preferredFormat: "image/jpeg" | "image/webp" =
    options?.forceMimeType || (isJpgExtension ? "image/jpeg" : "image/webp");

  // Jika file sudah berupa WebP/JPEG dan ukurannya sudah <= 300 KB serta format sesuai, tidak perlu kompresi ulang
  if (
    workingFile.size <= MAX_IMAGE_FILE_SIZE_BYTES &&
    (workingFile.type === preferredFormat ||
      (preferredFormat === "image/webp" && (workingFile.type === "image/webp" || workingFile.type === "image/jpeg")))
  ) {
    return workingFile;
  }

  try {
    const decoded = await decodeImage(workingFile);

    try {
      // Skema kompresi bertahap (adaptif):
      // Jika foto besar/penuh detail, turunkan resolusi dan kualitas secara bertahap sampai ukurannya <= 300 KB.
      const compressionPasses = [
        { maxEdge: 1280, quality: 0.75 },
        { maxEdge: 1080, quality: 0.65 },
        { maxEdge: 900,  quality: 0.55 },
        { maxEdge: 750,  quality: 0.45 },
        { maxEdge: 640,  quality: 0.38 },
      ];

      let bestBlob: Blob | null = null;

      for (const pass of compressionPasses) {
        const scale = Math.min(1, pass.maxEdge / Math.max(decoded.width, decoded.height, 1));
        const width = Math.max(1, Math.round(decoded.width * scale));
        const height = Math.max(1, Math.round(decoded.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const isTransparentFormat = preferredFormat === "image/webp" && (workingFile.type === "image/png" || /\.png$/i.test(workingFile.name));

        const context = canvas.getContext("2d", {
          alpha: isTransparentFormat,
          desynchronized: true,
        });

        if (!context) {
          canvas.width = 0;
          canvas.height = 0;
          continue;
        }

        if (!isTransparentFormat) {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
        }
        decoded.draw(context, width, height);

        let passBlob: Blob | null = null;

        if (preferredFormat === "image/jpeg") {
          // Jika format yang diminta adalah JPEG murni, kompresi hanya ke JPEG
          passBlob = await exportCanvasBlob(canvas, "image/jpeg", pass.quality);
        } else {
          // Coba WebP terlebih dahulu, lalu JPEG sebagai fallback
          const webpBlob = await exportCanvasBlob(canvas, "image/webp", pass.quality);
          const jpegBlob = await exportCanvasBlob(canvas, "image/jpeg", pass.quality);

          if (webpBlob && webpBlob.type === "image/webp" && (!jpegBlob || webpBlob.size <= jpegBlob.size)) {
            passBlob = webpBlob;
          } else if (jpegBlob && (jpegBlob.type === "image/jpeg" || jpegBlob.type === "image/webp")) {
            passBlob = jpegBlob;
          }
        }

        // Segera kosongkan buffer canvas untuk mencegah kebocoran memori grafis di mobile
        canvas.width = 0;
        canvas.height = 0;

        if (passBlob && passBlob.type !== "image/png") {
          if (!bestBlob || passBlob.size < bestBlob.size) {
            bestBlob = passBlob;
          }
          // Jika ukuran berkas sudah memenuhi target <= 300 KB, hentikan perulangan
          if (passBlob.size <= MAX_IMAGE_FILE_SIZE_BYTES) {
            break;
          }
        }
      }

      if (!bestBlob || bestBlob.type === "image/png") {
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
    } finally {
      decoded.close();
    }
  } catch (error) {
    console.error("Gagal melakukan kompresi gambar:", error);
    return workingFile;
  }
}

export async function optimizeReportImages(
  files: File[],
  options?: OptimizeImageOptions,
): Promise<File[]> {
  return Promise.all(files.map((file) => optimizeReportImage(file, options)));
}
