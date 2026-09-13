import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The production build lands directly in the backend's static directory, so a
// single FastAPI process serves both the API and the UI from one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../backend/app/static",
    emptyOutDir: true,
  },
  server: {
    // During development Vite serves the UI and forwards API calls to uvicorn,
    // so the frontend code always talks to a same-origin "/api".
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
