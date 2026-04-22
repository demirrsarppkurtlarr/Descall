import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://descall-qzkg.onrender.com'),
  },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        format: "iife",
      },
    },
  },
});
