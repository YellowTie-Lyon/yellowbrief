import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  publicDir: "public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 0, // pas de data: URI (CSP stricte)
    rollupOptions: { input: { index: resolve(import.meta.dirname, "src/index.html"), client: resolve(import.meta.dirname, "src/client.html") } },
  },
});
