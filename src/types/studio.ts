export type ModelQuality = "isnet_quint8" | "isnet_fp16" | "isnet";

export type ComputeDevice = "gpu" | "cpu";

export type OutputFormat = "image/png" | "image/webp" | "image/jpeg";

export type BackgroundMode = "transparent" | "color";

export type ImageJobStatus = "queued" | "processing" | "done" | "error";

export interface BackgroundSettings {
  mode: BackgroundMode;
  color: string;
}

export interface ImageJob {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  originalUrl: string;
  cutoutBlob?: Blob;
  resultBlob?: Blob;
  resultUrl?: string;
  status: ImageJobStatus;
  progress: number;
  progressLabel?: string;
  durationMs?: number;
  error?: string;
}
