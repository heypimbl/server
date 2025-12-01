import { defineConfig } from "vitest/config.js";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
});
