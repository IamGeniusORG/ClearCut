# ClearCut — Enter. Cut. Leave.

A custom-built, batch AI background removal studio powered by **Next.js**, **Tailwind CSS**, and **on-device neural segmentation** (`@imgly/background-removal` + `onnxruntime-web`), designed for zero-sleep deployment on **Vercel**.

## Why Browser-Based AI on Vercel?

- **Never Sleeps**: Static/Edge-ready Next.js frontend on Vercel with zero cold-start sleeping screens.
- **100% Private & Unlimited Batch Size**: Images are processed locally in your browser using WebGPU (with automatic WASM CPU fallback)—no files are uploaded to a backend server.
- **Zero Backend GPU Costs**: Neural inference runs directly on the user's device.

## Tech Stack

- **Next.js (App Router)** & **React 19**
- **TypeScript** & **Tailwind CSS v4**
- **`@imgly/background-removal`** + **`onnxruntime-web`** (ISNet ONNX models via WebGPU / WASM)
- **`jszip`** for client-side batch `.zip` packaging
- **`lucide-react`** for studio iconography

## Features

- **Drag-and-Drop, Multi-Select & Clipboard Paste (`Ctrl+V`)** for JPG, PNG, and WebP images
- **3 AI Model Tiers**: Fast (`isnet_quint8`, ~40 MB), Balanced (`isnet_fp16`, ~80 MB), and Max Quality (`isnet`, ~160 MB)
- **Compute Selection**: WebGPU hardware acceleration with automatic WASM CPU fallback
- **Instant Backdrop & Format Switching**: Switch between Transparent, Solid Color presets, or a custom color picker—and export as PNG, WebP, or JPG—without re-running AI inference
- **Interactive Before/After Split Inspector**: Drag-to-compare original vs. cutout at high resolution
- **Batch ZIP & Single-Image Downloads**: Deduplicated filenames (`_no_bg.png`, `_no_bg_2.png`, etc.)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> Note: On the first run for a selected model tier, the browser downloads and caches the ONNX model weights and WASM runtime files locally.

## Deploying to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the project in [Vercel](https://vercel.com/new) (framework preset: **Next.js**).
3. Click **Deploy** — no environment variables or Python build steps are required.

Or deploy directly via CLI:

```bash
npx vercel --prod
```

## Project Structure

- `src/app/icon.svg` — ClearCut minimal monogram badge favicon
- `src/app/layout.tsx` & `src/app/globals.css` — App shell, typography, and dark studio styling
- `src/app/page.tsx` — Entry page rendering the studio workspace
- `src/components/ClearCutLogo.tsx` — Minimal monogram badge logo component
- `src/components/StudioWorkspace.tsx` — Custom batch processing UI, queue grid, and controls
- `src/components/CompareSlider.tsx` — Interactive before/after split comparison modal
- `src/lib/bg-remover.ts` — Browser AI segmentation runner and canvas backdrop compositor
- `src/lib/zip-export.ts` — Deduplicated batch ZIP generator and formatting helpers
- `next.config.ts` — Configures `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy: credentialless` headers for multi-threaded WASM performance
