import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

function buildRevision() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "local"; }
}

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_REVISION__: JSON.stringify(buildRevision()),
  },
  build: { outDir: "build", emptyOutDir: true, target: "es2022" },
  worker: { format: "es" },
});
