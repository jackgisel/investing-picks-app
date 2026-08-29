/**
 * Vitest does not read `tsconfig.json`'s `paths` on its own — `tsx` (this
 * package's CLI runtime) resolves the `@/*` alias natively, but Vitest needs
 * the same mapping declared here or a value import through `@/*` fails to
 * resolve at test time even though `tsc` and `tsx` both accept it. This
 * mirrors `tsconfig.json`'s `paths` exactly so `@/*` behaves identically
 * under every runner this package uses.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
