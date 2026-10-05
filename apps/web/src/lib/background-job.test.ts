import { describe, expect, it } from "vitest";
import { jobStatus, startJob } from "./background-job";

describe("background jobs", () => {
  it("runs to done and keeps the result", async () => {
    expect(jobStatus("t1")).toEqual({ state: "idle" });
    expect(startJob("t1", async () => 42)).toBe(true);
    expect(jobStatus("t1").state).toBe("running");
    await new Promise((r) => setTimeout(r, 5));
    expect(jobStatus("t1")).toMatchObject({ state: "done", result: 42 });
  });

  it("does not start a second run while one is going", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    expect(startJob("t2", () => gate)).toBe(true);
    expect(startJob("t2", async () => 1)).toBe(false);
    release();
    await new Promise((r) => setTimeout(r, 5));
    expect(jobStatus("t2").state).toBe("done");
  });

  it("records a failure", async () => {
    startJob("t3", async () => {
      throw new Error("boom");
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(jobStatus("t3")).toMatchObject({ state: "error", error: "boom" });
  });
});
