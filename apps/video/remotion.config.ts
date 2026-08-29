/**
 * Remotion CLI config. Sets the entry point so `pnpm studio`, `npx remotion
 * still`, and `npx remotion render` all work without repeating
 * `src/remotion/index.ts` on every invocation.
 */

import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/remotion/index.ts");
Config.setVideoImageFormat("jpeg");
