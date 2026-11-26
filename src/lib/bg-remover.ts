import type { Config } from "@imgly/background-removal";
import type {
  BackgroundSettings,
  ComputeDevice,
  ModelQuality,
  OutputFormat,
} from "@/types/studio";

export interface SegmentationOptions {
  model: ModelQuality;
  device?: ComputeDevice;
  onProgress?: (percent: number, stage: string) => void;
}

const MAX_MOBILE_DIMENSION = 1600;
const MAX_DESKTOP_DIMENSION = 2048;

// WeakMap automatically frees cached format blobs when a cutoutBlob is garbage collected
const compositeCache = new WeakMap<Blob, Map<string, Blob>>();

export function isLikelyMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const coarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent
  );
  return coarsePointer || mobileUa;
}

export function getDefaultModelQuality(): ModelQuality {
  return isLikelyMobileDevice() ? "isnet_quint8" : "isnet_fp16";
}

export function getPreferredComputeDevice(): ComputeDevice {
  // Mobile WebGPU drivers often stall on shader compilation; WASM CPU is faster and more reliable on phones
  if (isLikelyMobileDevice()) {
    return "cpu";
  }
  return "gpu";
}

function formatStageLabel(key: string): string {
  if (key.startsWith("fetch:")) {
    return "Loading AI model";
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

/**
 * Downscales oversized camera photos (e.g. 12MP-48MP mobile shots) to a fast
 * working resolution while keeping smaller images untouched.
 */
export async function prepareImageForProcessing(file: File): Promise<{
  processingFile: File;
  width: number;
  height: number;
}> {
  const maxDim = isLikelyMobileDevice()
    ? MAX_MOBILE_DIMENSION
    : MAX_DESKTOP_DIMENSION;

  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    const longestSide = Math.max(width, height);

    if (longestSide <= maxDim) {
      return { processingFile: file, width, height };
    }

    const scale = maxDim / longestSide;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { processingFile: file, width, height };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const preserveAlpha =
      file.type === "image/png" || file.type === "image/webp";
    const mime = preserveAlpha ? "image/png" : "image/jpeg";
    const scaledBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, 0.94);
    });

    if (!scaledBlob) {
      return { processingFile: file, width, height };
    }

    const scaledFile = new File([scaledBlob], file.name, { type: mime });
    return {
      processingFile: scaledFile,
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    bitmap.close();
  }
}

// --- Background Web Worker management (prevents UI thread freeze during AI inference) ---
type WorkerResponse =
  | { type: "preloaded"; id: string }
  | { type: "preload-error"; id: string; message: string }
  | { type: "progress"; id: string; percent: number; stage: string }
  | {
      type: "done";
      id: string;
      blob: Blob;
      usedDevice: ComputeDevice;
      durationMs: number;
    }
  | { type: "error"; id: string; message: string };

interface PendingTask {
  onProgress?: (percent: number, stage: string) => void;
  resolve: (value: {
    blob: Blob;
    usedDevice: ComputeDevice;
    durationMs: number;
  }) => void;
  reject: (reason?: unknown) => void;
}

let sharedWorker: Worker | null = null;
let workerUnavailable = false;
const pendingSegments = new Map<string, PendingTask>();

function canUseBackgroundWorker(): boolean {
  return (
    !workerUnavailable &&
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

function getOrCreateWorker(): Worker | null {
  if (!canUseBackgroundWorker()) return null;
  if (sharedWorker) return sharedWorker;

  try {
    const worker = new Worker(
      new URL("../workers/bg-remover.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.addEventListener(
      "message",
      (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "preloaded" || msg.type === "preload-error") {
          return;
        }
        const task = pendingSegments.get(msg.id);
        if (!task) return;

        if (msg.type === "progress") {
          task.onProgress?.(msg.percent, msg.stage);
        } else if (msg.type === "done") {
          pendingSegments.delete(msg.id);
          task.resolve({
            blob: msg.blob,
            usedDevice: msg.usedDevice,
            durationMs: msg.durationMs,
          });
        } else if (msg.type === "error") {
          pendingSegments.delete(msg.id);
          task.reject(new Error(msg.message));
        }
      }
    );

    worker.addEventListener("error", () => {
      workerUnavailable = true;
      sharedWorker = null;
      for (const [id, task] of pendingSegments.entries()) {
        pendingSegments.delete(id);
        task.reject(new Error("WORKER_FAILED"));
      }
    });

    sharedWorker = worker;
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

// --- Main-thread fallback (used only if Worker / OffscreenCanvas is unsupported) ---
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

export async function preloadSegmentationModel(
  model: ModelQuality
): Promise<void> {
  const device = getPreferredComputeDevice();
  const worker = getOrCreateWorker();
  if (worker) {
    worker.postMessage({
      type: "preload",
      id: crypto.randomUUID(),
      model,
      device,
    });
    return;
  }

  await configureOnnxLogging(device);
  const { preload } = await import("@imgly/background-removal");

  try {
    await preload({
      model,
      device,
      output: {
        format: "image/png",
        quality: 1,
      },
    });
  } catch {
    if (device === "gpu") {
      try {
        await preload({
          model,
          device: "cpu",
          output: {
            format: "image/png",
            quality: 1,
          },
        });
      } catch {
        // Non-fatal
      }
    }
  }
}

async function runSegmentationOnMainThread(
  file: File,
  targetDevice: ComputeDevice,
  options: SegmentationOptions
): Promise<{ blob: Blob; usedDevice: ComputeDevice; durationMs: number }> {
  await configureOnnxLogging(targetDevice);
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
        total > 0
          ? Math.min(99, Math.max(1, Math.round((current / total) * 100)))
          : 0;
      options.onProgress(percent, formatStageLabel(key));
    },
  });

  try {
    const blob = await removeBackground(file, makeConfig(targetDevice));
    return {
      blob,
      usedDevice: targetDevice,
      durationMs: performance.now() - startedAt,
    };
  } catch (err) {
    if (targetDevice === "gpu") {
      options.onProgress?.(5, "Switching to CPU engine");
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

export async function runSegmentation(
  file: File,
  options: SegmentationOptions
): Promise<{ blob: Blob; usedDevice: ComputeDevice; durationMs: number }> {
  const targetDevice = options.device ?? getPreferredComputeDevice();
  const worker = getOrCreateWorker();

  if (worker) {
    try {
      return await new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingSegments.set(id, {
          onProgress: options.onProgress,
          resolve,
          reject,
        });
        worker.postMessage({
          type: "segment",
          id,
          file,
          model: options.model,
          device: targetDevice,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "WORKER_FAILED") {
        // Fall through cleanly to main-thread fallback if browser blocks module worker
      } else {
        throw err;
      }
    }
  }

  return runSegmentationOnMainThread(file, targetDevice, options);
}

function getCacheKey(
  background: BackgroundSettings,
  format: OutputFormat,
  quality: number
): string {
  const effectiveBg =
    background.mode === "color" || format === "image/jpeg"
      ? `color:${background.mode === "color" ? background.color.toLowerCase() : "#ffffff"}`
      : "transparent";
  return `${effectiveBg}|${format}|${quality}`;
}

export async function renderCompositeBlob(
  cutoutBlob: Blob,
  background: BackgroundSettings,
  format: OutputFormat,
  quality = 0.9
): Promise<Blob> {
  if (background.mode === "transparent" && format === "image/png") {
    return cutoutBlob;
  }

  const cacheKey = getCacheKey(background, format, quality);
  let perCutoutCache = compositeCache.get(cutoutBlob);
  const cached = perCutoutCache?.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bitmap = await createImageBitmap(cutoutBlob);
  try {
    let encoded: Blob | null = null;

    if (typeof OffscreenCanvas !== "undefined") {
      const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        if (background.mode === "color" || format === "image/jpeg") {
          ctx.fillStyle =
            background.mode === "color" ? background.color : "#ffffff";
          ctx.fillRect(0, 0, offscreen.width, offscreen.height);
        }
        ctx.drawImage(bitmap, 0, 0);
        encoded = await offscreen.convertToBlob({ type: format, quality });
      }
    }

    if (!encoded) {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas 2D context unavailable.");
      }

      if (background.mode === "color" || format === "image/jpeg") {
        ctx.fillStyle =
          background.mode === "color" ? background.color : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(bitmap, 0, 0);

      encoded = await new Promise<Blob>((resolve, reject) => {
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
    }

    if (!perCutoutCache) {
      perCutoutCache = new Map<string, Blob>();
      compositeCache.set(cutoutBlob, perCutoutCache);
    }
    perCutoutCache.set(cacheKey, encoded);

    return encoded;
  } finally {
    bitmap.close();
  }
}
