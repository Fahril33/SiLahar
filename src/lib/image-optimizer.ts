const MAX_IMAGE_EDGE_PX = 1600;
const TARGET_MIME_TYPE = "image/webp";
const TARGET_QUALITY = 0.82;
const MIN_SIZE_TO_OPTIMIZE_BYTES = 180 * 1024;

function toOptimizedFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") + ".webp";
}

function loadImageFromFile(file: File) {
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

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, TARGET_MIME_TYPE, TARGET_QUALITY);
  });
}

let heic2anyLoader: any = null;

async function convertHeicToJpeg(file: File): Promise<File> {
  if (typeof window === "undefined") {
    return file;
  }
  if (!heic2anyLoader) {
    const mod = await import("heic2any");
    heic2anyLoader = mod.default || mod;
  }
  const result = await heic2anyLoader({
    blob: file,
    toType: "image/jpeg",
    quality: 0.82,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpeg";
  return new File([blob], newName, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

export async function optimizeReportImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isHeic =
    extension === "heic" ||
    extension === "heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif";

  let workingFile = file;
  if (isHeic) {
    try {
      workingFile = await convertHeicToJpeg(file);
    } catch (e) {
      console.error("Gagal melakukan konversi HEIC ke JPEG:", e);
    }
  }

  if (!workingFile.type.startsWith("image/")) {
    return workingFile;
  }

  if (workingFile.size < MIN_SIZE_TO_OPTIMIZE_BYTES) {
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

    if (!optimizedBlob || optimizedBlob.size >= workingFile.size) {
      return workingFile;
    }

    return new File([optimizedBlob], toOptimizedFileName(workingFile.name), {
      type: optimizedBlob.type || TARGET_MIME_TYPE,
      lastModified: workingFile.lastModified,
    });
  } catch (error) {
    console.error(error);
    return workingFile;
  }
}

export async function optimizeReportImages(files: File[]) {
  return Promise.all(files.map((file) => optimizeReportImage(file)));
}
