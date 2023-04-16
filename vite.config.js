import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    minify: false,
    lib: {
      entry: "src/index.ts",
      formats: ["cjs", "es"],
    },
  },
});
