# DropCutDone

A working, browser-local background remover for product photos. Free beta: no account, checkout, image upload server, or per-image inference API bill.

## Run

Serve `dist/` with any static HTTP server, for example `python -m http.server 8000 --directory dist`. Production should use HTTPS. No install or build step is needed: versioned runtime assets and the verified model are included.

```sh
npm test
npm run check
```

`npm test` uses Node's test runner and Python 3 (for independent ZIP validation). The app itself has no Python dependency.

## Features

- JPG, PNG, and WebP input; up to 10 files, 12 MB per file, 16 megapixels.
- U2NetP inference in a worker, with WebAssembly for cross-device operation.
- Transparent or white PNGs, original proportions, centered square and portrait canvases.
- Single PNG and batch ZIP downloads, before/after preview, retry, clear, and sequential processing.
- Photos stay in browser memory. No third-party requests during processing; all runtime assets are self-hosted.
- Responsive, accessible interface, metadata, sitemap, privacy page, and license credits.

## Important product limits

This is a free acquisition beta, not a fully autonomous revenue-generating business. U2NetP is a lightweight baseline. Fine hair, glass, reflections, busy scenes, and similar foreground/background colors need quality evaluation before charging. It segments the existing photo rather than inventing product details. Original images larger than 4096 px on the longest side are downscaled for export.

There is no billing, server-side API, customer account system, email support automation, or aggregated analytics yet. Local event hooks are available but no customer data is transmitted. No revenue or SEO ranking is guaranteed.

## Agent integration

See [docs/agent-api.md](docs/agent-api.md). Browser agents can use the visible controls or `window.dropcutdone`. The interface exposes every operation in this beta. It is not an HTTP API. Site code is managed here in GitHub; preview publishing uses the project in `.openai/hosting.json`.

## Deployment

The deployable directory is `dist/`. `.openai/hosting.json` points to the private review Site. Keep GitHub `origin` as the source of truth; the Sites source helper pushes the same commit to its hosting remote without changing `origin`.

For the custom-domain launch, verify the exact domain and DNS access, attach the domain, add the returned records, and confirm TLS. Switch canonical, sitemap, and robots URLs to the verified primary domain. Make the Site public only when requested. Do not add fictitious conversion numbers, reviews, working checkout buttons, or customer logos.

## Dependencies and credits

- ONNX Runtime Web 1.20.1 (MIT), self-hosted under `dist/vendor`.
- U2NetP, Apache 2.0, mirrored from the rembg release by `edgetools/u2netp` on Hugging Face. Model SHA-256 is checked at runtime and by `npm run check`.
- JS SHA-256 0.11.1 (MIT), local HTTP fallback for model verification when Web Crypto is unavailable.
- Sample photo: REVOLT / Unsplash. Attribution and upstream licenses are linked on `/credits.html`.

Do not replace the model with weights that forbid commercial use. Include full upstream notices when updating vendored assets. The app's own source has no open-source license grant at this time.
