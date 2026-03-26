import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Serve .wasm files with the correct MIME type in dev
function wasmContentType(): Plugin {
  return {
    name: 'wasm-content-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), wasmContentType()],
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
