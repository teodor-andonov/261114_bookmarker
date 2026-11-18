import { defineConfig } from "vite";
export default defineConfig({base:"./",build:{outDir:"build",emptyOutDir:true,target:"esnext"},worker:{format:"es"}});
