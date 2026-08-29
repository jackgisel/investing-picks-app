/**
 * Every user-visible string in a scene, in one place. `leaks.ts` and
 * `phrases.ts` both need to scan "narration plus everything a viewer could
 * read on screen" — a name that never gets said out loud but sits in a
 * caption is still a leak — so the walk over `SlideSpec`'s discriminated
 * union lives here once rather than twice. The switch is exhaustive on
 * purpose: a slide kind neither this file nor the Remotion composition
 * handles yet is a compiler error, not a silently unscanned field.
 */

import type { Scene } from "@/types";

export interface SceneField {
  field: string;
  value: string;
}

export function collectSceneStrings(scene: Scene): SceneField[] {
  const fields: SceneField[] = [{ field: "narration", value: scene.narration }];
  const slide = scene.slide;

  switch (slide.type) {
    case "title":
      fields.push({ field: "slide.title", value: slide.title });
      fields.push({ field: "slide.subtitle", value: slide.subtitle });
      fields.push({ field: "slide.periodLabel", value: slide.periodLabel });
      break;
    case "stat":
      fields.push({ field: "slide.heading", value: slide.heading });
      slide.stats.forEach((stat, i) => {
        fields.push({ field: `slide.stats[${i}].label`, value: stat.label });
        fields.push({ field: `slide.stats[${i}].value`, value: stat.value });
        if (stat.sub) fields.push({ field: `slide.stats[${i}].sub`, value: stat.sub });
      });
      break;
    case "picksChart":
    case "periodBars":
    case "sectors":
      fields.push({ field: "slide.heading", value: slide.heading });
      if (slide.caption) fields.push({ field: "slide.caption", value: slide.caption });
      break;
    case "holdings":
      fields.push({ field: "slide.heading", value: slide.heading });
      if (slide.caption) fields.push({ field: "slide.caption", value: slide.caption });
      break;
    case "events":
      fields.push({ field: "slide.heading", value: slide.heading });
      slide.items.forEach((item, i) => {
        fields.push({ field: `slide.items[${i}].label`, value: item.label });
        fields.push({ field: `slide.items[${i}].detail`, value: item.detail });
      });
      break;
    case "bullets":
      fields.push({ field: "slide.heading", value: slide.heading });
      slide.items.forEach((item, i) => fields.push({ field: `slide.items[${i}]`, value: item }));
      break;
    case "quote":
      fields.push({ field: "slide.text", value: slide.text });
      if (slide.attribution) fields.push({ field: "slide.attribution", value: slide.attribution });
      break;
    case "outro":
      fields.push({ field: "slide.heading", value: slide.heading });
      slide.lines.forEach((line, i) => fields.push({ field: `slide.lines[${i}]`, value: line }));
      break;
  }

  return fields;
}
