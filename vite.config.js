import path from "path";
import { defineConfig } from "vite";

module.exports = defineConfig({
  build: {
    target: "es2020",
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["cjs", "es"],
      fileName: (format) => `${format}/index.js`,
    },
  },
});
