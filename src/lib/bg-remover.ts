import type { Config } from "@imgly/background-removal";
import type {
  BackgroundSettings,
  ComputeDevice,
  ModelQuality,
  OutputFormat,
} from "@/types/studio";

export interface SegmentationOptions {
  model: ModelQuality;
  device: ComputeDevice;
  onProgress?: (percent: number, stage: string) => void;
}

function formatStageLabel(key: string): string {
  if (key.startsWith("fetch:")) {
    return "Downloading AI model";
  }
  if (key.startsWith("compute:")) {
    return "Removing background";
  }
  return "Processing";
}

export function getImageDimensions(
  file: Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image dimensions."));
    };
    img.src = objectUrl;
  });
}

let configuredCpuLogging = false;
let configuredGpuLogging = false;

function setOrtErrorLogLevel(mod: typeof import("onnxruntime-web")) {
  const env = mod.default?.env ?? mod.env;
  if (env) {
    env.logLevel = "error";
  }
}

async function configureOnnxLogging(device: ComputeDevice): Promise<void> {
  if (!configuredCpuLogging) {
    try {
      setOrtErrorLogLevel(await import("onnxruntime-web"));
      configuredCpuLogging = true;
    } catch {
      // Ignore if CPU runtime is unavailable
    }
  }

  if (
    !configuredGpuLogging &&
    device === "gpu" &&
    typeof navigator !== "undefined" &&
    "gpu" in navigator
  ) {
    try {
      setOrtErrorLogLevel(await import("onnxruntime-web/webgpu"));
      configuredGpuLogging = true;
    } catch {
      // Ignore if WebGPU runtime is unavailable
    }
  }
}

export async function runSegmentation(
  file: File,
  options: SegmentationOptions
): Promise<{ blob: Blob; usedDevice: ComputeDevice; durationMs: number }> {
  await configureOnnxLogging(options.device);
  const { removeBackground } = await import("@imgly/background-removal");
  const startedAt = performance.now();

  const makeConfig = (device: ComputeDevice): Config => ({
    model: options.model,
    device,
    output: {
      format: "image/png",
      quality: 1,
    },
    progress: (key: string, current: number, total: number) => {
      if (!options.onProgress) return;
      const percent =
        total > 0 ? Math.min(99, Math.max(1, Math.round((current / total) * 100))) : 0;
      options.onProgress(percent, formatStageLabel(key));
    },
  });

  try {
    const blob = await removeBackground(file, makeConfig(options.device));
    return {
      blob,
      usedDevice: options.device,
      durationMs: performance.now() - startedAt,
    };
  } catch (err) {
    // Gracefully fall back to WASM CPU if WebGPU fails on this browser/GPU
    if (options.device === "gpu") {
      options.onProgress?.(5, "WebGPU unavailable, falling back to CPU");
      const blob = await removeBackground(file, makeConfig("cpu"));
      return {
        blob,
        usedDevice: "cpu",
        durationMs: performance.now() - startedAt,
      };
    }
    throw err;
  }
}

export async function renderCompositeBlob(
  cutoutBlob: Blob,
  background: BackgroundSettings,
  format: OutputFormat,
  quality = 0.92
): Promise<Blob> {
  if (background.mode === "transparent" && format === "image/png") {
    return cutoutBlob;
  }

  const bitmap = await createImageBitmap(cutoutBlob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable.");
    }

    // JPEG does not support alpha transparency; fill with chosen color or white
    if (background.mode === "color" || format === "image/jpeg") {
      ctx.fillStyle = background.mode === "color" ? background.color : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Failed to encode output image."));
          }
        },
        format,
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}
