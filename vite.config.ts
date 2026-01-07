import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    ssr: true,
    target: "node20",
    outDir: "dist",
    rollupOptions: {
      input: resolve(__dirname, "src/index.ts"),
      output: {
        format: "esm",
        entryFileNames: "index.js",
      },
      // Playwright must remain external due to complex internal dependencies
      external: ["playwright", "playwright-core"],
    },
    minify: false,
    sourcemap: true,
  },
  ssr: {
    // Bundle Hono and other simple dependencies, keep Playwright external
    external: ["playwright", "playwright-core"],
    noExternal: ["hono", "@hono/node-server"],
  },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
