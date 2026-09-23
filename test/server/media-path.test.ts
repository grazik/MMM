import { describe, expect, it } from "vitest";
import {
  getMediaUrl,
  isValidMediaDate,
  isValidMediaFile,
} from "@/server/media-path";

describe("isValidMediaDate", () => {
  it("accepts a set date", () => {
    expect(isValidMediaDate("2026-09-23")).toBe(true);
  });

  it.each(["..", "2026-9-23", "2026-09-23x", "latest", ""])(
    "rejects %j",
    (date) => {
      expect(isValidMediaDate(date)).toBe(false);
    },
  );
});

describe("isValidMediaFile", () => {
  it.each(["a1B2c3.mp4", "01.jpg", "abc_def-poster.webp"])(
    "accepts %j",
    (file) => {
      expect(isValidMediaFile(file)).toBe(true);
    },
  );

  it.each([
    "..",
    "../manifest.json",
    "..%2Fsecret",
    ".hidden.mp4",
    "a/b.mp4",
    "a\\b.mp4",
    "noextension",
    "trailing.",
    "a..b",
    "manifest.json",
    "",
  ])("rejects %j", (file) => {
    expect(isValidMediaFile(file)).toBe(false);
  });
});

describe("getMediaUrl", () => {
  it("builds the media route", () => {
    expect(getMediaUrl("2026-09-23", "a1.mp4")).toBe(
      "/media/2026-09-23/a1.mp4",
    );
  });
});
