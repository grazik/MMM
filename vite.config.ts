import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const SERVER_URL = "http://localhost:3000";

export default defineConfig({
  root: "src/web",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/web", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    proxy: { "/api": SERVER_URL, "/media": SERVER_URL, "/healthz": SERVER_URL },
  },
});
