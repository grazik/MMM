import { describe, expect, it } from "vitest";
import {
  getTodaysFetchTime,
  isStale,
  shouldCatchUp,
} from "@/scheduler/fetch-time";

const CONFIG = { fetchCron: "0 6 * * *", timezone: "Europe/Warsaw" };

// Summer time in Warsaw is UTC+2, so 06:00 local is 04:00Z.
const BEFORE_FETCH = new Date("2026-09-23T03:59:00Z");
const AT_FETCH = new Date("2026-09-23T04:00:00Z");
const AFTER_FETCH = new Date("2026-09-23T15:00:00Z");

describe("getTodaysFetchTime", () => {
  it("derives 06:00 local from the cron in summer time", () => {
    expect(getTodaysFetchTime(AFTER_FETCH, CONFIG)?.toISOString()).toBe(
      "2026-09-23T04:00:00.000Z",
    );
  });

  it("derives 06:00 local in winter time", () => {
    expect(
      getTodaysFetchTime(
        new Date("2026-12-01T12:00:00Z"),
        CONFIG,
      )?.toISOString(),
    ).toBe("2026-12-01T05:00:00.000Z");
  });

  it("uses the Warsaw date when UTC is still on the previous day", () => {
    expect(
      getTodaysFetchTime(
        new Date("2026-09-22T23:30:00Z"),
        CONFIG,
      )?.toISOString(),
    ).toBe("2026-09-23T04:00:00.000Z");
  });

  it("follows a custom cron", () => {
    expect(
      getTodaysFetchTime(AFTER_FETCH, {
        ...CONFIG,
        fetchCron: "30 7 * * *",
      })?.toISOString(),
    ).toBe("2026-09-23T05:30:00.000Z");
  });

  it("returns null when the cron does not fire that day", () => {
    // 2026-09-23 is a Wednesday.
    expect(
      getTodaysFetchTime(AFTER_FETCH, { ...CONFIG, fetchCron: "0 6 * * 1" }),
    ).toBeNull();
  });
});

describe("isStale", () => {
  it("is not stale without any set", () => {
    expect(isStale(null, AFTER_FETCH, CONFIG)).toBe(false);
  });

  it("is not stale before 06:00 with yesterday's set", () => {
    expect(isStale("2026-09-22", BEFORE_FETCH, CONFIG)).toBe(false);
  });

  it("is stale at exactly 06:00 with yesterday's set", () => {
    expect(isStale("2026-09-22", AT_FETCH, CONFIG)).toBe(true);
  });

  it("is stale later in the day with yesterday's set", () => {
    expect(isStale("2026-09-22", AFTER_FETCH, CONFIG)).toBe(true);
  });

  it("is not stale before 06:00 even with a set older than yesterday", () => {
    // The spec defines staleness only from today's fetch time on.
    expect(isStale("2026-09-20", BEFORE_FETCH, CONFIG)).toBe(false);
  });

  it("is stale after 06:00 with an older set", () => {
    expect(isStale("2026-09-20", AFTER_FETCH, CONFIG)).toBe(true);
  });

  it("is not stale with today's set", () => {
    expect(isStale("2026-09-23", AT_FETCH, CONFIG)).toBe(false);
    expect(isStale("2026-09-23", AFTER_FETCH, CONFIG)).toBe(false);
  });

  it("uses the Warsaw date, not the UTC date, around midnight", () => {
    // 00:30 on 2026-09-24 in Warsaw, still 2026-09-23 in UTC.
    const afterLocalMidnight = new Date("2026-09-23T22:30:00Z");
    expect(isStale("2026-09-23", afterLocalMidnight, CONFIG)).toBe(false);
    expect(isStale("2026-09-22", afterLocalMidnight, CONFIG)).toBe(false);
  });

  it("uses the Warsaw date late in the day", () => {
    // 23:30 on 2026-09-23 in Warsaw is 21:30Z.
    expect(
      isStale("2026-09-22", new Date("2026-09-23T21:30:00Z"), CONFIG),
    ).toBe(true);
  });

  describe("on the day summer time ends (2026-10-25, 06:00 is 05:00Z)", () => {
    it("is not stale at 05:59 local, which is after 04:00Z", () => {
      expect(
        isStale("2026-10-24", new Date("2026-10-25T04:59:00Z"), CONFIG),
      ).toBe(false);
    });

    it("is stale at 06:00 local", () => {
      expect(
        isStale("2026-10-24", new Date("2026-10-25T05:00:00Z"), CONFIG),
      ).toBe(true);
    });
  });

  describe("on the day summer time starts (2026-03-29, 06:00 is 04:00Z)", () => {
    it("is not stale at 05:59 local", () => {
      expect(
        isStale("2026-03-28", new Date("2026-03-29T03:59:00Z"), CONFIG),
      ).toBe(false);
    });

    it("is stale at 06:00 local", () => {
      expect(
        isStale("2026-03-28", new Date("2026-03-29T04:00:00Z"), CONFIG),
      ).toBe(true);
    });
  });
});

describe("shouldCatchUp", () => {
  it("fetches after 06:00 when today's set is missing", () => {
    expect(shouldCatchUp(["2026-09-22"], AFTER_FETCH, CONFIG)).toBe(true);
    expect(shouldCatchUp(["2026-09-22"], AT_FETCH, CONFIG)).toBe(true);
  });

  it("fetches after 06:00 on a fresh install", () => {
    expect(shouldCatchUp([], AFTER_FETCH, CONFIG)).toBe(true);
  });

  it("waits for the cron before 06:00", () => {
    expect(shouldCatchUp(["2026-09-22"], BEFORE_FETCH, CONFIG)).toBe(false);
    expect(shouldCatchUp([], BEFORE_FETCH, CONFIG)).toBe(false);
  });

  it("does nothing when today's set exists", () => {
    expect(
      shouldCatchUp(["2026-09-22", "2026-09-23"], AFTER_FETCH, CONFIG),
    ).toBe(false);
  });

  it("uses the Warsaw date around midnight", () => {
    // 00:30 on 2026-09-24 in Warsaw: before that day's fetch time.
    expect(
      shouldCatchUp(["2026-09-22"], new Date("2026-09-23T22:30:00Z"), CONFIG),
    ).toBe(false);
  });
});
