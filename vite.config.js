import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["cjs", "es"],
      fileName: (format) => `${format}/index.js`,
    },
  },
});
