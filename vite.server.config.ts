import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": fromRoot("./src") },
  },
  build: {
    ssr: true,
    target: "node24",
    outDir: fromRoot("./dist"),
    // The web build lands in dist/web first; wiping dist here would delete it.
    emptyOutDir: false,
    rolldownOptions: {
      input: {
        main: fromRoot("./src/main.ts"),
        fetch: fromRoot("./src/fetch.ts"),
      },
      output: { entryFileNames: "[name].js" },
    },
  },
});
