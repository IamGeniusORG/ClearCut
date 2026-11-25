<div align="center">

# ClearCut

**Enter. Cut. Leave.**

A fast, privacy-first batch AI background remover that runs directly in the browser—built with **Next.js** and **on-device neural segmentation** for zero-sleep deployment on **Vercel**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIamGeniusORG%2FBACKGROUND-REMOVER)

</div>

---

## Overview

**ClearCut** replaces slow, sleeping server apps with an instant, zero-backend studio. Drop one image or an entire batch, let the browser automatically isolate subjects using hardware-accelerated WebGPU (with automatic WASM CPU fallback), tweak backgrounds or formats in real time, and export everything as a single `.zip`.

- **Always Awake:** Static-first Next.js App Router architecture—no cold starts, no sleeping servers, no upload payload limits.
- **100% On-Device Privacy:** Your images never leave your browser. Cutouts and **Session History** live strictly in tab memory and clear automatically when you refresh or close the tab.
- **Zero-Jargon Workflow:** Automatic queue processing on drop/paste, smart hardware selection under the hood, and instant non-destructive backdrop/format switching.

---

## Key Features

- **Effortless Input:** Drag & drop, multi-file browse, or paste directly from clipboard (`Ctrl+V` / `Cmd+V`) for **JPG**, **PNG**, and **WebP** images.
- **Automatic Batch Queue:** Processing begins immediately upon adding files, with live per-image progress and queue stop/resume controls.
- **Instant Backdrop & Format Compositing:** Switch between **Transparent**, solid presets (**White**, **Black**, **Soft Gray**, **Cobalt**), or any **Custom Hex Color**, and export as **PNG**, **WebP**, or **JPG** without re-running AI inference.
- **Cutout Precision Presets:** Choose **Fast**, **Balanced** (default), or **High Detail** from the toolbar quality menu.
- **Interactive Split Inspector:** Click any processed card to compare **Original vs. Cutout** with a draggable split slider or toggle full-view modes.
- **In-Memory Session History:** Click **ClearCut** anytime to return to the main menu while keeping all processed cutouts accessible via **History** in the header until the tab is refreshed or closed.
- **Deduplicated Batch Export:** Download individual files or package all cutouts into `clearcut_batch.zip` / `clearcut_history.zip` with collision-safe filenames (`_no_bg.png`, `_no_bg_2.png`, etc.).
- **Built-In Social Previews:** Includes custom-rendered Open Graph (`/opengraph-image`) and Twitter (`/twitter-image`) cards plus SVG favicon (`/icon.svg`).

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| **Styling & Icons** | Tailwind CSS v4, `lucide-react` |
| **In-Browser AI** | `@imgly/background-removal` + `onnxruntime-web` (WebGPU / WASM) |
| **Archive Export** | `jszip` |
| **Social Cards** | `next/og` (`ImageResponse`) |

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**

### Local Development

```bash
git clone https://github.com/IamGeniusORG/BACKGROUND-REMOVER.git
cd BACKGROUND-REMOVER
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **First-Run Note:** The first time a precision tier runs in a browser, the ONNX model weights and WASM runtime are downloaded once and cached locally by the browser for subsequent runs.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server with Turbopack |
| `npm run build` | Typecheck, prerender routes & OG images, and build for production |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint across the codebase |

---

## Deploying to Vercel

### Option 1: GitHub Integration (Recommended)

1. Go to **[vercel.com/new](https://vercel.com/new)** and import **`IamGeniusORG/BACKGROUND-REMOVER`**.
2. Keep the default **Next.js** framework preset (no environment variables required).
3. Click **Deploy**.

### Option 2: Vercel CLI

```bash
npx vercel login
npx vercel --prod
```

---

## Project Structure

```text
├── next.config.ts                  # COOP & COEP (credentialless) headers for multi-threaded WASM
├── src/
│   ├── app/
│   │   ├── globals.css             # Tailwind v4 setup and transparency checkerboard utility
│   │   ├── icon.svg                # ClearCut monogram favicon
│   │   ├── layout.tsx              # Root layout, fonts, and Open Graph / Twitter metadata
│   │   ├── opengraph-image.tsx     # Static 1200x630 Open Graph social card route
│   │   ├── page.tsx                # Home entry rendering StudioWorkspace
│   │   └── twitter-image.tsx       # Static 1200x630 Twitter summary card route
│   ├── components/
│   │   ├── ClearCutLogo.tsx        # Minimal monogram squircle badge & wordmark
│   │   ├── CompareSlider.tsx       # Interactive before/after split comparison modal
│   │   └── StudioWorkspace.tsx     # Main menu, batch queue, controls, and Session History
│   ├── lib/
│   │   ├── bg-remover.ts           # ONNX logging setup, WebGPU/CPU segmentation, canvas compositor
│   │   ├── og-card.tsx             # Shared 1200x630 social preview card renderer
│   │   └── zip-export.ts           # Deduplicated ZIP builder and size/duration formatters
│   └── types/
│       ├── onnxruntime-web.d.ts    # Module declarations for onnxruntime-web & WebGPU entrypoint
│       └── studio.ts               # Shared TypeScript interfaces for jobs and settings
```

---

## Architecture Notes

- **Cross-Origin Isolation:** [next.config.ts](next.config.ts) sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` so `SharedArrayBuffer` accelerates WASM inference while still permitting cross-origin model fetches.
- **Privacy & Memory:** Uploaded files and output blobs use ephemeral `blob:` URLs revoked automatically when items are removed or the component unmounts. Nothing is persisted to disk or sent to external servers.

---

## License

This project uses [`@imgly/background-removal`](https://github.com/imgly/background-removal-js), which is distributed under the **AGPL** license. Review its licensing terms before redistributing or deploying in proprietary commercial offerings.
