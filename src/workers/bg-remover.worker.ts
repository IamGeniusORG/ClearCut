import type { Config } from "@imgly/background-removal";
import type { ComputeDevice, ModelQuality } from "@/types/studio";

type WorkerRequest =
  | {
      type: "preload";
      id: string;
      model: ModelQuality;
      device: ComputeDevice;
    }
  | {
      type: "segment";
      id: string;
      file: Blob;
      model: ModelQuality;
      device: ComputeDevice;
    };

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

function formatStageLabel(key: string): string {
  if (key.startsWith("fetch:")) {
    return "Loading AI model";
  }
  if (key.startsWith("compute:")) {
    return "Removing background";
  }
  return "Processing";
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;

  if (payload.type === "preload") {
    try {
      await configureOnnxLogging(payload.device);
      const { preload } = await import("@imgly/background-removal");
      await preload({
        model: payload.model,
        device: payload.device,
        output: {
          format: "image/png",
          quality: 1,
        },
      });
      self.postMessage({ type: "preloaded", id: payload.id });
    } catch (err) {
      if (payload.device === "gpu") {
        try {
          await configureOnnxLogging("cpu");
          const { preload } = await import("@imgly/background-removal");
          await preload({
            model: payload.model,
            device: "cpu",
            output: {
              format: "image/png",
              quality: 1,
            },
          });
          self.postMessage({ type: "preloaded", id: payload.id });
          return;
        } catch {
          // Ignore preload failure; segment will handle and report if needed
        }
      }
      const message =
        err instanceof Error ? err.message : "Preload failed.";
      self.postMessage({ type: "preload-error", id: payload.id, message });
    }
    return;
  }

  if (payload.type === "segment") {
    const startedAt = performance.now();
    try {
      await configureOnnxLogging(payload.device);
      const { removeBackground } = await import("@imgly/background-removal");

      const makeConfig = (device: ComputeDevice): Config => ({
        model: payload.model,
        device,
        output: {
          format: "image/png",
          quality: 1,
        },
        progress: (key: string, current: number, total: number) => {
          const percent =
            total > 0
              ? Math.min(99, Math.max(1, Math.round((current / total) * 100)))
              : 0;
          self.postMessage({
            type: "progress",
            id: payload.id,
            percent,
            stage: formatStageLabel(key),
          });
        },
      });

      try {
        const blob = await removeBackground(
          payload.file,
          makeConfig(payload.device)
        );
        self.postMessage({
          type: "done",
          id: payload.id,
          blob,
          usedDevice: payload.device,
          durationMs: performance.now() - startedAt,
        });
      } catch (err) {
        if (payload.device === "gpu") {
          self.postMessage({
            type: "progress",
            id: payload.id,
            percent: 5,
            stage: "Switching to CPU engine",
          });
          await configureOnnxLogging("cpu");
          const blob = await removeBackground(payload.file, makeConfig("cpu"));
          self.postMessage({
            type: "done",
            id: payload.id,
            blob,
            usedDevice: "cpu",
            durationMs: performance.now() - startedAt,
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove background.";
      self.postMessage({
        type: "error",
        id: payload.id,
        message,
      });
    }
  }
});
