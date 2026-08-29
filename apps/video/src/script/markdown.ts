/**
 * A human-readable companion to `script.json`, written alongside it so a
 * script can be reviewed — for voice, for pacing, for whether it sounds like
 * the reference episode — without parsing JSON by eye.
 */

import type { Script, SlideSpec } from "@/types";

function slideSummary(slide: SlideSpec): string {
  switch (slide.type) {
    case "title":
      return `title — "${slide.title}" / "${slide.subtitle}" (${slide.periodLabel})`;
    case "stat":
      return `stat — ${slide.stats.map((s) => `${s.label}: ${s.value}`).join(", ")}`;
    case "picksChart":
      return `picksChart — "${slide.heading}"${slide.caption ? ` (${slide.caption})` : ""}`;
    case "periodBars":
      return `periodBars — "${slide.heading}"${slide.caption ? ` (${slide.caption})` : ""}`;
    case "holdings":
      return `holdings — "${slide.heading}"${slide.caption ? ` (${slide.caption})` : ""}`;
    case "sectors":
      return `sectors — "${slide.heading}"${slide.caption ? ` (${slide.caption})` : ""}`;
    case "events":
      return `events — "${slide.heading}" (${slide.items.length} item${slide.items.length === 1 ? "" : "s"})`;
    case "bullets":
      return `bullets — "${slide.heading}" (${slide.items.length} item${slide.items.length === 1 ? "" : "s"})`;
    case "quote":
      return `quote${slide.attribution ? ` — ${slide.attribution}` : ""}`;
    case "outro":
      return `outro — "${slide.heading}"`;
  }
}

export function renderScriptMarkdown(script: Script): string {
  const lines: string[] = [`# ${script.title}`, "", script.subtitle, ""];

  let lastChapter: string | null = null;
  for (const scene of script.scenes) {
    if (scene.chapter !== lastChapter) {
      lines.push(`## ${scene.chapter}`, "");
      lastChapter = scene.chapter;
    }
    lines.push(`### ${scene.id} — ${slideSummary(scene.slide)}`, "");
    lines.push(`_accent: ${scene.accent}_`, "");
    lines.push(scene.narration, "");
  }

  return lines.join("\n");
}
