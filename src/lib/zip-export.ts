import JSZip from "jszip";
import type { ImageJob, OutputFormat } from "@/types/studio";

export function getExtensionForFormat(format: OutputFormat): string {
  switch (format) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
    default:
      return "png";
  }
}

export function buildOutputFilename(
  originalName: string,
  format: OutputFormat,
  usedNames?: Set<string>
): string {
  const dotIndex = originalName.lastIndexOf(".");
  const stem = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  const ext = getExtensionForFormat(format);

  let candidate = `${stem}_no_bg.${ext}`;
  if (!usedNames) {
    return candidate;
  }

  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}_no_bg_${counter}.${ext}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function createResultsZip(
  jobs: ImageJob[],
  format: OutputFormat
): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const job of jobs) {
    const blob = job.resultBlob ?? job.cutoutBlob;
    if (job.status !== "done" || !blob) continue;
    const filename = buildOutputFilename(job.name, format, usedNames);
    zip.file(filename, blob);
  }

  return zip.generateAsync({ type: "blob" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
