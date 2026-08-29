/**
 * Remotion entry point. Registered as the bundle root by `remotion.config.ts`
 * (`Config.setEntryPoint`) and by every `npx remotion <cmd> src/remotion/index.ts`
 * invocation in DESIGN.md / PROGRESS.md.
 */

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
