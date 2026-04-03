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

export async function optimizeReportImage(file: File) {
  if (!file.type.startsWith("image/") || file.size < MIN_SIZE_TO_OPTIMIZE_BYTES) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
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
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const optimizedBlob = await canvasToBlob(canvas);

    if (!optimizedBlob || optimizedBlob.size >= file.size) {
      return file;
    }

    return new File([optimizedBlob], toOptimizedFileName(file.name), {
      type: optimizedBlob.type || TARGET_MIME_TYPE,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error(error);
    return file;
  }
}

export async function optimizeReportImages(files: File[]) {
  return Promise.all(files.map((file) => optimizeReportImage(file)));
}
