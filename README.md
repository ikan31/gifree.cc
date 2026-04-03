# gifree

A simple and local GIF editor that runs entirely in your browser. No uploads, no accounts, no servers — your files never leave your device.

<div align="center">

![gifree demo](https://github.com/user-attachments/assets/60e7f514-ce87-4737-80ad-43f4d1b09a33)

</div>

---

## Features

- **Video to GIF** — convert video to GIF with clip range and fps controls
- **Trim** — cut to any frame range
- **Crop** — drag to select a region
- **Resize** — scale to preset widths or custom dimensions
- **Speed** — slow down or speed up (0.25× – 4×)
- **Transform** — flip horizontally/vertically, rotate 90°/180°, reverse
- **Effects** — grayscale or deep fry
- **Text** — overlay text with font, size, and color options
- **Undo** — step back through edits

## How it works

gifree compiles the GIF processing library to [WebAssembly](https://webassembly.org/) using Go's built-in WASM target. When you open the site, the browser downloads a ~4MB `.wasm` binary once. After that, every edit runs locally on your machine.

Video conversion uses the browser's native `<video>` + `<canvas>` APIs to extract frames — no ffmpeg, no server, no extra binary size. Go receives raw RGBA frames and builds the GIF.

```
Your browser
  └── gif.worker.ts (Web Worker)
        └── gifree.wasm (Go, compiled to WebAssembly)
```

## Running locally

**Requirements:** Go 1.21+, Node 18+

```bash
git clone https://github.com/ikan31/gifree.cc
cd gifree.cc
make dev
```

Opens at `http://localhost:5173`.

`make dev` compiles the Go WASM binary and starts the Vite dev server. If you only change frontend code you can just run `cd web && npm run dev` on subsequent runs — only re-run `make dev` if you edit anything in `gif/` or `cmd/wasm/`.

## Project structure

```
gif/              Go GIF processing library (trim, crop, text, speed, effects, resize)
cmd/wasm/         Go WASM entry point — exposes processing functions to JavaScript
web/
  src/
    gif.worker.ts   Web Worker: loads WASM, owns blob store
    wasmApi.ts      Main-thread Promise API
    App.tsx         Root component
    components/     Dropzone, Preview, Toolbar, ExportBar, CropOverlay, TextOverlay
  public/           gifree.wasm + wasm_exec.js (generated at build time, gitignored)
```

## Contributing

PRs are welcome. A few things to know:

- The GIF processing logic lives entirely in `gif/` — pure Go, no browser dependencies, easy to test
- The WASM entry point in `cmd/wasm/main.go` is thin glue — it just unpacks JS arguments and calls `gif/`
- Frontend is React + TypeScript + Tailwind v4

To add a new operation:
1. Implement it in `gif/` as a function `Foo(g *GIFFile, ...) (*GIFFile, error)`
2. Add any new sentinel errors to `gif/errors.go`
3. Register it in `cmd/wasm/main.go` as a JS global (`gifFoo`)
4. Add it to the worker dispatch in `gif.worker.ts`
5. Expose it via `wasmApi.ts`
6. Add a tab in `Toolbar.tsx`

**Debugging:** All ops are logged to the browser console with a `[gifree]` prefix — useful for bug reports. Open DevTools → Console before reproducing an issue and paste the output.

## License

MIT
