import { defineConfig } from "vite";
export default defineConfig({base:"./",optimizeDeps:{exclude:["@classcad/smlibwasm"]},build:{outDir:"build",emptyOutDir:true,target:"esnext"},worker:{format:"es"}});
