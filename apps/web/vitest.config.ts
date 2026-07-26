import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json. Set explicitly rather than via
    // vite-tsconfig-paths: that plugin wants a `baseUrl`, and Next resolves
    // `paths` relative to the tsconfig without one, so the two disagree.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Everything worth testing first is a pure function, so the default node
    // environment is enough — no jsdom, no React transform, no Next runtime.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
