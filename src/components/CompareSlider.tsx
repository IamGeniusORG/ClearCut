"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Layers, MoveHorizontal, X } from "lucide-react";
import type { BackgroundSettings, ImageJob, OutputFormat } from "@/types/studio";
import {
  buildOutputFilename,
  formatBytes,
  formatDuration,
} from "@/lib/zip-export";

interface CompareSliderProps {
  job: ImageJob | null;
  background: BackgroundSettings;
  format: OutputFormat;
  onClose: () => void;
  onDownload: (job: ImageJob) => void;
}

type ViewMode = "split" | "original" | "cutout";

export function CompareSlider({
  job,
  background,
  format,
  onClose,
  onDownload,
}: CompareSliderProps) {
  const [splitPercent, setSplitPercent] = useState(50);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!job) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [job, onClose]);

  if (!job || !job.resultUrl) return null;

  const updateSplitFromClientX = (clientX: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(0, Math.min(100, raw)));
  };

  const cutoutBackdropStyle =
    background.mode === "color"
      ? { backgroundColor: background.color }
      : undefined;

  const outputFilename = buildOutputFilename(job.name, format);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${job.name}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-zinc-100">
              {outputFilename}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {job.width && job.height ? `${job.width} × ${job.height} px • ` : ""}
              {job.resultBlob ? `${formatBytes(job.resultBlob.size)} output` : ""}
              {job.durationMs !== undefined
                ? ` • Processed in ${formatDuration(job.durationMs)}`
                : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
              {(["split", "original", "cutout"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-2.5 py-1 font-medium capitalize transition ${
                    viewMode === mode
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onDownload(job)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Comparison Canvas */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-950 p-4 sm:p-6">
          <div
            ref={stageRef}
            onPointerDown={(e) => {
              if (viewMode !== "split") return;
              draggingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              updateSplitFromClientX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current || viewMode !== "split") return;
              updateSplitFromClientX(e.clientX);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
            }}
            style={cutoutBackdropStyle}
            className={`relative select-none overflow-hidden rounded-xl border border-zinc-800 ${
              background.mode === "transparent" ? "checkerboard" : ""
            } ${viewMode === "split" ? "cursor-ew-resize" : ""}`}
          >
            {/* Base layer: Processed cutout */}
            <img
              src={viewMode === "original" ? job.originalUrl : job.resultUrl}
              alt={viewMode === "original" ? `Original ${job.name}` : `Processed ${job.name}`}
              draggable={false}
              className="block max-h-[68vh] max-w-full object-contain"
            />

            {/* Clipped Original overlay in Split mode */}
            {viewMode === "split" && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden bg-zinc-950"
                  style={{
                    clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                  }}
                >
                  <img
                    src={job.originalUrl}
                    alt={`Original ${job.name}`}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* Divider Line + Handle */}
                <div
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.8)]"
                  style={{ left: `${splitPercent}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-zinc-950/90 text-white shadow-lg">
                    <MoveHorizontal className="h-4 w-4" />
                  </div>
                </div>

                {/* Corner Labels */}
                <span className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-sm">
                  Original
                </span>
                <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-950">
                  <Layers className="h-3 w-3" />
                  Cutout
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
