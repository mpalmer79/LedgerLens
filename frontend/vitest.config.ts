import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Use the modern JSX runtime so component tests can render JSX without
  // a manual `import React from "react"` line in every file.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // CSS modules in component imports — turn them into empty objects at
    // test time so importing a `.module.css` file from a component doesn't
    // explode the test runner.
    css: false,
  },
});
