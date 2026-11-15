import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "build", emptyOutDir: true, target: "es2022" },
  worker: { format: "es" },
});
