"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  History,
  ImagePlus,
  Loader2,
  Plus,
  RotateCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { ClearCutLogo } from "@/components/ClearCutLogo";
import { CompareSlider } from "@/components/CompareSlider";
import {
  getImageDimensions,
  renderCompositeBlob,
  runSegmentation,
} from "@/lib/bg-remover";
import {
  buildOutputFilename,
  createResultsZip,
  formatBytes,
  formatDuration,
} from "@/lib/zip-export";
import type {
  BackgroundSettings,
  ImageJob,
  ModelQuality,
  OutputFormat,
} from "@/types/studio";

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const PRECISION_OPTIONS: Array<{
  id: ModelQuality;
  label: string;
  hint: string;
}> = [
  {
    id: "isnet_quint8",
    label: "Fast",
    hint: "Quickest processing for clean product shots",
  },
  {
    id: "isnet_fp16",
    label: "Balanced",
    hint: "Recommended default for everyday photos",
  },
  {
    id: "isnet",
    label: "High Detail",
    hint: "Extra edge precision for hair, fur, and fine textures",
  },
];

const COLOR_PRESETS = [
  { label: "White", hex: "#ffffff" },
  { label: "Black", hex: "#09090b" },
  { label: "Soft Gray", hex: "#e4e4e7" },
  { label: "Cobalt", hex: "#2563eb" },
];

type FilterTab = "all" | "done" | "queued" | "error";
type WorkspaceView = "home" | "workspace" | "history";

function isSupportedImageFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type.toLowerCase())) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function revokeJobUrls(job: ImageJob) {
  URL.revokeObjectURL(job.originalUrl);
  if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
}

export function StudioWorkspace() {
  const [view, setView] = useState<WorkspaceView>("home");
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [history, setHistory] = useState<ImageJob[]>([]);
  const [model, setModel] = useState<ModelQuality>("isnet_fp16");
  const [background, setBackground] = useState<BackgroundSettings>({
    mode: "transparent",
    color: "#ffffff",
  });
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("image/png");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [inspectedJobId, setInspectedJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const abortRequestedRef = useRef(false);
  const queueRunningRef = useRef(false);

  // Synchronous ref mirrors for the background queue loop & unmount cleanup
  const jobsRef = useRef<ImageJob[]>([]);
  const historyRef = useRef<ImageJob[]>([]);
  const settingsRef = useRef({ model, background, outputFormat });

  useEffect(() => {
    settingsRef.current = { model, background, outputFormat };
  }, [model, background, outputFormat]);

  const updateJobs = useCallback(
    (updater: (prev: ImageJob[]) => ImageJob[]) => {
      const next = updater(jobsRef.current);
      jobsRef.current = next;
      setJobs(next);
    },
    []
  );

  const updateHistory = useCallback(
    (updater: (prev: ImageJob[]) => ImageJob[]) => {
      const next = updater(historyRef.current);
      historyRef.current = next;
      setHistory(next);
    },
    []
  );

  // Close precision popover on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [settingsOpen]);

  // Revoke all object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      for (const job of jobsRef.current) revokeJobUrls(job);
      for (const item of historyRef.current) revokeJobUrls(item);
    };
  }, []);

  const processSingleJob = useCallback(
    async (jobId: string) => {
      const target = jobsRef.current.find((j) => j.id === jobId);
      if (!target) return;

      const { model: activeModel } = settingsRef.current;

      updateJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "processing",
                progress: 4,
                progressLabel: "Preparing",
                error: undefined,
              }
            : j
        )
      );

      try {
        const { blob: cutoutBlob, durationMs } = await runSegmentation(
          target.file,
          {
            model: activeModel,
            device: "gpu",
            onProgress: (percent, stage) => {
              updateJobs((prev) =>
                prev.map((j) =>
                  j.id === jobId
                    ? { ...j, progress: percent, progressLabel: stage }
                    : j
                )
              );
            },
          }
        );

        const { background: latestBg, outputFormat: latestFormat } =
          settingsRef.current;

        const resultBlob = await renderCompositeBlob(
          cutoutBlob,
          latestBg,
          latestFormat
        );
        const resultUrl = URL.createObjectURL(resultBlob);

        updateJobs((prev) =>
          prev.map((j) => {
            if (j.id !== jobId) return j;
            if (j.resultUrl) URL.revokeObjectURL(j.resultUrl);
            return {
              ...j,
              cutoutBlob,
              resultBlob,
              resultUrl,
              status: "done",
              progress: 100,
              progressLabel: "Ready",
              durationMs,
            };
          })
        );

        // Save an independent copy in session History so clearing or navigating home preserves it
        const historyEntry: ImageJob = {
          id: crypto.randomUUID(),
          file: target.file,
          name: target.name,
          sizeBytes: target.sizeBytes,
          width: target.width,
          height: target.height,
          originalUrl: URL.createObjectURL(target.file),
          cutoutBlob,
          resultBlob,
          resultUrl: URL.createObjectURL(resultBlob),
          status: "done",
          progress: 100,
          progressLabel: "Ready",
          durationMs,
        };
        updateHistory((prev) => [historyEntry, ...prev]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not process this image.";
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "error",
                  progress: 0,
                  progressLabel: undefined,
                  error: message,
                }
              : j
          )
        );
      }
    },
    [updateHistory, updateJobs]
  );

  const ensureQueueRunning = useCallback(async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    abortRequestedRef.current = false;
    setIsProcessing(true);

    try {
      while (!abortRequestedRef.current) {
        const nextJob = jobsRef.current.find((j) => j.status === "queued");
        if (!nextJob) break;
        await processSingleJob(nextJob.id);
      }
    } finally {
      queueRunningRef.current = false;
      abortRequestedRef.current = false;
      setIsProcessing(false);
    }
  }, [processSingleJob]);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const valid = incoming.filter(isSupportedImageFile);
      const rejectedCount = incoming.length - valid.length;

      if (rejectedCount > 0) {
        setNotice(
          `Skipped ${rejectedCount} unsupported file(s). Please use JPG, PNG, or WebP.`
        );
      } else {
        setNotice(null);
      }

      if (valid.length === 0) return;

      const newJobs: ImageJob[] = await Promise.all(
        valid.map(async (file) => {
          const originalUrl = URL.createObjectURL(file);
          let width: number | undefined;
          let height: number | undefined;
          try {
            const dims = await getImageDimensions(file);
            width = dims.width;
            height = dims.height;
          } catch {
            // Non-fatal if browser delays dimension decode
          }
          return {
            id: crypto.randomUUID(),
            file,
            name: file.name || `image-${Date.now()}.png`,
            sizeBytes: file.size,
            width,
            height,
            originalUrl,
            status: "queued",
            progress: 0,
          };
        })
      );

      updateJobs((prev) => [...prev, ...newJobs]);
      setView("workspace");
      void ensureQueueRunning();
    },
    [ensureQueueRunning, updateJobs]
  );

  // Support Ctrl+V / Cmd+V clipboard paste anywhere
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items && items.length > 0) {
        void addFiles(items);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addFiles]);

  // Re-compose cutouts in both active workspace and History when backdrop or format changes
  const recomputeListOutputs = useCallback(
    async (
      list: ImageJob[],
      nextBg: BackgroundSettings,
      nextFormat: OutputFormat
    ): Promise<Map<string, { resultBlob: Blob; resultUrl: string }>> => {
      const updates = new Map<string, { resultBlob: Blob; resultUrl: string }>();
      for (const item of list) {
        if (item.status !== "done" || !item.cutoutBlob) continue;
        try {
          const resultBlob = await renderCompositeBlob(
            item.cutoutBlob,
            nextBg,
            nextFormat
          );
          const resultUrl = URL.createObjectURL(resultBlob);
          updates.set(item.id, { resultBlob, resultUrl });
        } catch {
          // Keep existing composite if encoding fails
        }
      }
      return updates;
    },
    []
  );

  const recomputeOutputs = useCallback(
    async (nextBg: BackgroundSettings, nextFormat: OutputFormat) => {
      const [jobUpdates, historyUpdates] = await Promise.all([
        recomputeListOutputs(jobsRef.current, nextBg, nextFormat),
        recomputeListOutputs(historyRef.current, nextBg, nextFormat),
      ]);

      if (jobUpdates.size > 0) {
        updateJobs((prev) =>
          prev.map((job) => {
            const updated = jobUpdates.get(job.id);
            if (!updated) return job;
            if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
            return {
              ...job,
              resultBlob: updated.resultBlob,
              resultUrl: updated.resultUrl,
            };
          })
        );
      }

      if (historyUpdates.size > 0) {
        updateHistory((prev) =>
          prev.map((item) => {
            const updated = historyUpdates.get(item.id);
            if (!updated) return item;
            if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
            return {
              ...item,
              resultBlob: updated.resultBlob,
              resultUrl: updated.resultUrl,
            };
          })
        );
      }
    },
    [recomputeListOutputs, updateHistory, updateJobs]
  );

  const handleBackgroundChange = (nextBg: BackgroundSettings) => {
    setBackground(nextBg);
    const nextFormat =
      nextBg.mode === "transparent" && outputFormat === "image/jpeg"
        ? "image/png"
        : outputFormat;
    if (nextFormat !== outputFormat) {
      setOutputFormat(nextFormat);
    }
    void recomputeOutputs(nextBg, nextFormat);
  };

  const handleFormatChange = (nextFormat: OutputFormat) => {
    setOutputFormat(nextFormat);
    let nextBg = background;
    if (nextFormat === "image/jpeg" && background.mode === "transparent") {
      nextBg = { mode: "color", color: background.color || "#ffffff" };
      setBackground(nextBg);
    }
    void recomputeOutputs(nextBg, nextFormat);
  };

  const handlePrecisionChange = (nextModel: ModelQuality) => {
    setModel(nextModel);
    setSettingsOpen(false);
  };

  const handleReprocessAll = () => {
    if (isProcessing || jobsRef.current.length === 0) return;
    updateJobs((prev) =>
      prev.map((j) => ({
        ...j,
        status: "queued",
        progress: 0,
        error: undefined,
      }))
    );
    void ensureQueueRunning();
  };

  const handleRetrySingle = (jobId: string) => {
    updateJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: "queued", progress: 0, error: undefined }
          : j
      )
    );
    void ensureQueueRunning();
  };

  const handleStopBatch = () => {
    abortRequestedRef.current = true;
  };

  const handleResumeBatch = () => {
    void ensureQueueRunning();
  };

  const handleGoHome = () => {
    // Stop any queued items and return cleanly to the main menu; completed cutouts stay in History
    abortRequestedRef.current = true;
    for (const job of jobsRef.current) {
      if (job.status !== "processing") {
        revokeJobUrls(job);
      }
    }
    updateJobs((prev) => prev.filter((j) => j.status === "processing"));
    setInspectedJobId(null);
    setSettingsOpen(false);
    setNotice(null);
    setFilterTab("all");
    setView("home");
  };

  const handleOpenHistory = () => {
    setInspectedJobId(null);
    setSettingsOpen(false);
    setNotice(null);
    setView("history");
  };

  const handleRemoveJob = (jobId: string) => {
    updateJobs((prev) => {
      const target = prev.find((j) => j.id === jobId);
      if (target) revokeJobUrls(target);
      return prev.filter((j) => j.id !== jobId);
    });
    if (inspectedJobId === jobId) {
      setInspectedJobId(null);
    }
  };

  const handleRemoveHistoryItem = (itemId: string) => {
    updateHistory((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (target) revokeJobUrls(target);
      return prev.filter((item) => item.id !== itemId);
    });
    if (inspectedJobId === itemId) {
      setInspectedJobId(null);
    }
  };

  const handleClearWorkspace = () => {
    if (isProcessing) return;
    for (const job of jobsRef.current) revokeJobUrls(job);
    updateJobs(() => []);
    setInspectedJobId(null);
    setNotice(null);
    setFilterTab("all");
    setView("home");
  };

  const handleClearHistory = () => {
    for (const item of historyRef.current) revokeJobUrls(item);
    updateHistory(() => []);
    setInspectedJobId(null);
  };

  const handleDownloadSingle = (job: ImageJob) => {
    const blob = job.resultBlob ?? job.cutoutBlob;
    if (!blob) return;
    triggerBlobDownload(blob, buildOutputFilename(job.name, outputFormat));
  };

  const handleDownloadZip = async (sourceJobs: ImageJob[], filename: string) => {
    const doneJobs = sourceJobs.filter((j) => j.status === "done");
    if (doneJobs.length === 0 || isZipping) return;
    setIsZipping(true);
    try {
      const zipBlob = await createResultsZip(doneJobs, outputFormat);
      triggerBlobDownload(zipBlob, filename);
    } finally {
      setIsZipping(false);
    }
  };

  const stats = useMemo(() => {
    let done = 0;
    let queued = 0;
    let processing = 0;
    let error = 0;

    for (const job of jobs) {
      if (job.status === "done") done += 1;
      else if (job.status === "queued") queued += 1;
      else if (job.status === "processing") processing += 1;
      else if (job.status === "error") error += 1;
    }

    const progressPct =
      jobs.length > 0 ? Math.round((done / jobs.length) * 100) : 0;

    return {
      total: jobs.length,
      done,
      queued,
      processing,
      error,
      progressPct,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (filterTab === "all") return jobs;
    return jobs.filter((j) => j.status === filterTab);
  }, [jobs, filterTab]);

  const inspectedJob = useMemo(
    () =>
      jobs.find((j) => j.id === inspectedJobId) ??
      history.find((item) => item.id === inspectedJobId) ??
      null,
    [jobs, history, inspectedJobId]
  );

  const activePrecisionLabel =
    PRECISION_OPTIONS.find((opt) => opt.id === model)?.label ?? "Balanced";

  const renderBackdropAndFormatControls = (includeQuality: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Left Group: Backdrop + Export Format */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Background</span>
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              disabled={outputFormat === "image/jpeg"}
              title="Transparent background"
              aria-label="Transparent background"
              onClick={() =>
                handleBackgroundChange({
                  mode: "transparent",
                  color: background.color,
                })
              }
              className={`checkerboard h-6 w-6 rounded-lg border transition ${
                background.mode === "transparent"
                  ? "border-emerald-400 ring-2 ring-emerald-400/30"
                  : "border-zinc-700 opacity-75 hover:opacity-100"
              } disabled:cursor-not-allowed disabled:opacity-30`}
            />

            {COLOR_PRESETS.map((preset) => {
              const selected =
                background.mode === "color" &&
                background.color.toLowerCase() === preset.hex;
              return (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.label}
                  aria-label={`${preset.label} background`}
                  onClick={() =>
                    handleBackgroundChange({
                      mode: "color",
                      color: preset.hex,
                    })
                  }
                  style={{ backgroundColor: preset.hex }}
                  className={`h-6 w-6 rounded-lg border transition ${
                    selected
                      ? "border-emerald-400 ring-2 ring-emerald-400/30"
                      : "border-zinc-700 hover:scale-105"
                  }`}
                />
              );
            })}

            <label
              title="Pick custom color"
              className="flex h-6 cursor-pointer items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-300 hover:border-zinc-500"
            >
              <input
                type="color"
                value={background.color}
                onChange={(e) =>
                  handleBackgroundChange({
                    mode: "color",
                    color: e.target.value,
                  })
                }
                className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="hidden font-mono uppercase sm:inline">
                Custom
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Format</span>
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
            {(
              [
                {
                  id: "image/png",
                  label: "PNG",
                  title: "Lossless with transparency",
                },
                {
                  id: "image/webp",
                  label: "WebP",
                  title: "Smaller file size with transparency",
                },
                {
                  id: "image/jpeg",
                  label: "JPG",
                  title: "Smallest file size with solid background",
                },
              ] as const
            ).map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                title={fmt.title}
                onClick={() => handleFormatChange(fmt.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  outputFormat === fmt.id
                    ? "bg-zinc-800 text-emerald-300 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Group: Workspace-only Controls */}
      {includeQuality && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative" ref={settingsPopoverRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
              Quality: {activePrecisionLabel}
            </button>

            {settingsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
                <p className="px-2 py-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Cutout Precision
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {PRECISION_OPTIONS.map((opt) => {
                    const selected = model === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handlePrecisionChange(opt.id)}
                        className={`flex items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                          selected
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-zinc-200 hover:bg-zinc-900"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            {opt.hint}
                          </p>
                        </div>
                        {selected && (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {stats.done > 0 && !isProcessing && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      handleReprocessAll();
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700"
                  >
                    <RotateCw className="h-3 w-3" />
                    Re-apply to All Images
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
            {(
              [
                { id: "all", label: `All (${stats.total})` },
                { id: "done", label: `Ready (${stats.done})` },
                ...(stats.queued > 0
                  ? [{ id: "queued", label: `Queued (${stats.queued})` }]
                  : []),
                ...(stats.error > 0
                  ? [{ id: "error", label: `Failed (${stats.error})` }]
                  : []),
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as FilterTab)}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  filterTab === tab.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isProcessing ? (
            <button
              type="button"
              onClick={handleStopBatch}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </button>
          ) : (
            stats.queued > 0 && (
              <button
                type="button"
                onClick={handleResumeBatch}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Resume ({stats.queued})
              </button>
            )
          )}
        </div>
      )}
    </div>
  );

  const showHome = view === "home" || (view === "workspace" && jobs.length === 0);

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
          void addFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Hidden shared file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void addFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Clickable Brand -> Main Menu */}
          <button
            type="button"
            onClick={handleGoHome}
            title="Return to main menu"
            className="group cursor-pointer rounded-xl text-left transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ClearCutLogo size={38} subtitle="Enter. Cut. Leave." />
          </button>

          {/* Right Header Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {view === "workspace" && jobs.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Images
                </button>

                <button
                  type="button"
                  onClick={handleClearWorkspace}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadZip(jobs, "clearcut_batch.zip")}
                  disabled={stats.done === 0 || isZipping}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {isZipping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="h-4 w-4" />
                  )}
                  Download All
                  {stats.done > 0 && (
                    <span className="rounded-md bg-zinc-950/20 px-1.5 py-0.5 text-[11px] font-bold">
                      {stats.done}
                    </span>
                  )}
                </button>
              </>
            )}

            {showHome && (
              <div className="hidden items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Private • Runs in your browser
              </div>
            )}

            {/* History Button on the Right Side of Header */}
            <button
              type="button"
              onClick={handleOpenHistory}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                view === "history"
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              <History className="h-3.5 w-3.5 text-emerald-400" />
              History
              {history.length > 0 && (
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {notice && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            {notice}
          </div>
        )}

        {view === "history" ? (
          /* Session History View */
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Main Menu
                  </button>
                  <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                    Session History
                  </h1>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  Cutouts are kept here in browser memory until you refresh or
                  close this tab.
                </p>
              </div>

              {history.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear History
                  </button>
                  <button
                    type="button"
                    disabled={isZipping}
                    onClick={() =>
                      handleDownloadZip(history, "clearcut_history.zip")
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {isZipping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileArchive className="h-4 w-4" />
                    )}
                    Download All ({history.length})
                  </button>
                </div>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/25 p-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
                  <History className="h-6 w-6" />
                </div>
                <h2 className="text-base font-semibold text-zinc-100">
                  No cutouts in history yet
                </h2>
                <p className="mt-1 max-w-sm text-xs text-zinc-400">
                  Processed images with removed backgrounds appear here
                  automatically during your session.
                </p>
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload Images
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 sm:p-4">
                  {renderBackdropAndFormatControls(false)}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {history.map((item) => {
                    const showCheckerboard = background.mode === "transparent";
                    const solidBgStyle =
                      background.mode === "color"
                        ? { backgroundColor: background.color }
                        : undefined;

                    return (
                      <article
                        key={item.id}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 transition hover:border-zinc-700"
                      >
                        <div
                          style={solidBgStyle}
                          onClick={() => setInspectedJobId(item.id)}
                          className={`relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-zinc-950 ${
                            showCheckerboard ? "checkerboard" : ""
                          }`}
                        >
                          <img
                            src={item.resultUrl ?? item.originalUrl}
                            alt={item.name}
                            className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.02]"
                          />

                          <div className="absolute top-2.5 left-2.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-950 shadow-sm">
                              <CheckCircle2 className="h-3 w-3" />
                              {item.durationMs !== undefined
                                ? formatDuration(item.durationMs)
                                : "Ready"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveHistoryItem(item.id);
                            }}
                            aria-label={`Remove ${item.name} from history`}
                            className="absolute top-2.5 right-2.5 rounded-lg border border-zinc-700/70 bg-zinc-950/80 p-1.5 text-zinc-400 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:border-rose-500/50 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
                          <div className="min-w-0">
                            <p
                              title={item.name}
                              className="truncate text-xs font-semibold text-zinc-100"
                            >
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-400">
                              {item.width && item.height
                                ? `${item.width}×${item.height} • `
                                : ""}
                              {formatBytes(item.sizeBytes)}
                              {item.resultBlob
                                ? ` → ${formatBytes(item.resultBlob.size)}`
                                : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectedJobId(item.id)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingle(item)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Save
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        ) : showHome ? (
          /* Clean Focused Main Menu / Hero Uploader */
          <section className="mx-auto flex max-w-3xl flex-col items-center pt-4 pb-10 text-center sm:pt-10">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Enter. <span className="text-emerald-400">Cut.</span> Leave.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
              Drop one photo or an entire batch. Cutouts happen automatically in
              your browser—no uploads, no waiting.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`mt-8 flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 transition sm:py-16 ${
                isDragging
                  ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.15)]"
                  : "border-zinc-800 bg-zinc-900/35 hover:border-zinc-600 hover:bg-zinc-900/60"
              }`}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <UploadCloud className="h-7 w-7" />
              </div>

              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200">
                <ImagePlus className="h-4 w-4" />
                Upload Images
              </span>

              <p className="mt-4 text-xs text-zinc-400">
                Drag &amp; drop JPG, PNG, or WebP files here — or press{" "}
                <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                  Ctrl+V
                </kbd>{" "}
                to paste
              </p>
            </div>

            <div className="mt-8 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                <UploadCloud className="mb-2 h-4 w-4 text-emerald-400" />
                <p className="text-xs font-semibold text-zinc-100">
                  1. Enter
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Drop, browse, or paste one photo or a full batch in seconds.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                <Sparkles className="mb-2 h-4 w-4 text-emerald-400" />
                <p className="text-xs font-semibold text-zinc-100">
                  2. Cut
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Automatic AI cutouts with instant transparent or solid
                  backdrops.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                <Download className="mb-2 h-4 w-4 text-emerald-400" />
                <p className="text-xs font-semibold text-zinc-100">
                  3. Leave
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Save individual cutouts or one clean ZIP—nothing stored on
                  servers.
                </p>
              </div>
            </div>
          </section>
        ) : (
          /* Active Batch Workspace */
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 sm:p-4">
              {renderBackdropAndFormatControls(true)}

              {(isProcessing || stats.done < stats.total) && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${stats.progressPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-400">
                    {stats.done}/{stats.total} ready
                  </span>
                </div>
              )}
            </div>

            {isDragging && (
              <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-500/10 py-6 text-center text-sm font-medium text-emerald-300">
                Drop images anywhere to add them to the queue
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredJobs.map((job) => {
                const previewUrl = job.resultUrl ?? job.originalUrl;
                const showCheckerboard =
                  job.status === "done" && background.mode === "transparent";
                const solidBgStyle =
                  job.status === "done" && background.mode === "color"
                    ? { backgroundColor: background.color }
                    : undefined;

                return (
                  <article
                    key={job.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 transition hover:border-zinc-700"
                  >
                    <div
                      style={solidBgStyle}
                      onClick={() => {
                        if (job.status === "done") setInspectedJobId(job.id);
                      }}
                      className={`relative aspect-[4/3] w-full overflow-hidden bg-zinc-950 ${
                        showCheckerboard ? "checkerboard" : ""
                      } ${job.status === "done" ? "cursor-zoom-in" : ""}`}
                    >
                      <img
                        src={previewUrl}
                        alt={job.name}
                        className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.02]"
                      />

                      <div className="absolute top-2.5 left-2.5">
                        {job.status === "done" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-950 shadow-sm">
                            <CheckCircle2 className="h-3 w-3" />
                            {job.durationMs !== undefined
                              ? formatDuration(job.durationMs)
                              : "Ready"}
                          </span>
                        )}
                        {job.status === "queued" && (
                          <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900/90 px-2 py-0.5 text-[11px] font-medium text-zinc-300 backdrop-blur-sm">
                            Queued
                          </span>
                        )}
                        {job.status === "error" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={job.status === "processing"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveJob(job.id);
                        }}
                        aria-label={`Remove ${job.name}`}
                        className="absolute top-2.5 right-2.5 rounded-lg border border-zinc-700/70 bg-zinc-950/80 p-1.5 text-zinc-400 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:border-rose-500/50 hover:text-rose-400 disabled:pointer-events-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      {job.status === "processing" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/75 px-4 text-center backdrop-blur-xs">
                          <Loader2 className="mb-2 h-6 w-6 animate-spin text-emerald-400" />
                          <p className="text-xs font-semibold text-white">
                            {job.progressLabel ?? "Processing"}
                          </p>
                          <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full bg-emerald-400 transition-all duration-200"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
                      <div className="min-w-0">
                        <p
                          title={job.name}
                          className="truncate text-xs font-semibold text-zinc-100"
                        >
                          {job.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {job.width && job.height
                            ? `${job.width}×${job.height} • `
                            : ""}
                          {formatBytes(job.sizeBytes)}
                          {job.resultBlob
                            ? ` → ${formatBytes(job.resultBlob.size)}`
                            : ""}
                        </p>
                        {job.error && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-rose-400">
                            {job.error}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {job.status === "done" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setInspectedJobId(job.id)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingle(job)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Save
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              isProcessing || job.status === "processing"
                            }
                            onClick={() => handleRetrySingle(job.id)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            {job.status === "error" ? "Retry" : "Waiting..."}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Before / After Comparison Modal */}
      <CompareSlider
        job={inspectedJob}
        background={background}
        format={outputFormat}
        onClose={() => setInspectedJobId(null)}
        onDownload={handleDownloadSingle}
      />
    </div>
  );
}
