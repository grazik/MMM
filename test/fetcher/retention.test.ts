import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyRetention, getExpiredDates } from "@/fetcher/retention";
import { listSetDates } from "@/storage/sets";

describe("getExpiredDates", () => {
  it("keeps dates newer than target minus retention days", () => {
    const dates = [
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ];
    expect(getExpiredDates(dates, "2026-09-23", 3)).toEqual([
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it("handles month boundaries", () => {
    expect(
      getExpiredDates(
        ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"],
        "2026-03-02",
        3,
      ),
    ).toEqual(["2026-02-27"]);
  });

  it("never expires the newest set", () => {
    expect(
      getExpiredDates(["2026-09-01", "2026-09-10"], "2026-09-23", 3),
    ).toEqual(["2026-09-01"]);
  });
});

describe("applyRetention", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mmm-retention-"));
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const createSets = async (dates: string[]) => {
    for (const date of dates) {
      const dir = path.join(dataDir, "sets", date);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "manifest.json"), "{}");
    }
  };

  it("deletes set directories older than the retention window", async () => {
    await createSets([
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
    const deleted = await applyRetention(dataDir, "2026-09-23", 3);
    expect(deleted).toEqual(["2026-09-19", "2026-09-20"]);
    expect(await listSetDates(dataDir)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
  });

  it("keeps the newest set even when it is outside the window", async () => {
    await createSets(["2026-09-01", "2026-09-02"]);
    await applyRetention(dataDir, "2026-09-23", 3);
    expect(await listSetDates(dataDir)).toEqual(["2026-09-02"]);
  });

  it("does nothing without a sets directory", async () => {
    expect(await applyRetention(dataDir, "2026-09-23", 3)).toEqual([]);
  });
});
