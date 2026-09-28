import { vi } from "vitest";

export function stubDatafastBrowser(datafast = vi.fn()) {
  const storage: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
  });
  vi.stubGlobal("window", { datafast });
  return { datafast, storage };
}
