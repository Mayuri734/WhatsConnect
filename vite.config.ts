import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/WhatsConnect/",

  plugins: [react()],

  server: {
    host: true,
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: "dist",
  },

  resolve: {
    alias: {
      "@": path.resolve("./client"),
    },
  },
});
