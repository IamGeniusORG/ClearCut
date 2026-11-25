<div align="center">

<a href="https://clearcut-khaki.vercel.app/">
  <img src="src/app/icon.svg" alt="ClearCut Logo" width="76" height="76" />
</a>

<h1>ClearCut</h1>

<p><strong>Enter. Cut. Leave.</strong></p>

<p>
  A fast, privacy-first batch AI background remover that runs directly in your browser—built with <strong>Next.js</strong> and <strong>on-device neural segmentation</strong> for zero-sleep hosting on <strong>Vercel</strong>.
</p>

<p>
  <a href="https://clearcut-khaki.vercel.app/">
    <img src="https://img.shields.io/badge/Launch_ClearCut-Live_App-10b981?style=for-the-badge&logo=vercel&logoColor=white" alt="Launch ClearCut Live App" />
  </a>
</p>

<p>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-20232a?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Inference-WebGPU%20%2F%20WASM-10b981?style=flat-square" alt="On-Device WebGPU and WASM" />
</p>

</div>

---

## Quick Usage

Use the live app immediately with no sign-up or installation: **[https://clearcut-khaki.vercel.app/](https://clearcut-khaki.vercel.app/)**

1. **Enter** — Drag & drop, browse, or paste (`Ctrl+V` / `Cmd+V`) one photo or a full batch (`JPG`, `PNG`, `WebP`).
2. **Cut** — Background removal starts automatically in your browser. Swap **Transparent** or **Solid Color** backdrops, switch **PNG / WebP / JPG**, or inspect edges with the **Compare** slider.
3. **Leave** — Save individual cutouts or click **Download All** for a single `.zip`. Nothing is uploaded to any server.

---

## Why ClearCut?

- **Always Awake:** Static-first Next.js App Router architecture—no cold starts, no sleeping servers, and no upload size caps.
- **100% On-Device Privacy:** Images are processed locally via hardware-accelerated WebGPU (with automatic WASM CPU fallback). Cutouts and **Session History** live strictly in tab memory and clear automatically when you refresh or close the tab.
- **Zero-Jargon Studio:** Smart defaults handle compute selection automatically while giving power users **Fast**, **Balanced**, and **High Detail** precision presets when needed.

---

## Features

- **Automatic Batch Queue:** Processing starts immediately upon adding files, with live per-image progress and stop/resume controls.
- **Instant Backdrop & Format Compositing:** Switch between **Transparent**, solid presets (**White**, **Black**, **Soft Gray**, **Cobalt**), or a **Custom Hex Color**, and export as **PNG**, **WebP**, or **JPG** without re-running AI inference.
- **Interactive Split Inspector:** Click any processed card to compare **Original vs. Cutout** using a draggable split divider.
- **In-Memory Session History:** Click **ClearCut** anytime to return to the main menu while keeping processed cutouts accessible in **History** until the tab is refreshed or closed.
- **Deduplicated Batch Export:** Download single files or package everything into `clearcut_batch.zip` / `clearcut_history.zip` with collision-safe filenames (`_no_bg.png`, `_no_bg_2.png`, etc.).
- **Built-In Social Previews:** Custom-rendered Open Graph (`/opengraph-image`) and Twitter (`/twitter-image`) cards plus SVG favicon (`/icon.svg`).

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

## Local Development

### Prerequisites

- **Node.js 20+** and **npm**

### Run Locally

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

## Deploying Your Own Instance

1. Import **`IamGeniusORG/BACKGROUND-REMOVER`** in **[vercel.com/new](https://vercel.com/new)**.
2. Keep the default **Next.js** framework preset (no environment variables required).
3. Click **Deploy**, or run `npx vercel --prod` from the project root.

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
