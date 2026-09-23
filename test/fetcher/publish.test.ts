import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireLock, getLockPath } from "@/fetcher/lock";
import { cleanTmpDir, createBuildDir, publishSet } from "@/fetcher/publish";
import { decodeHtmlEntities } from "@/fetcher/title";

let dataDir: string;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mmm-publish-"));
});

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

const buildWithFile = async (date: string, content: string) => {
  const buildDir = await createBuildDir(dataDir, date);
  await fs.writeFile(path.join(buildDir, "manifest.json"), content);
  return buildDir;
};

describe("publishSet", () => {
  it("moves the build directory into sets/<date>", async () => {
    const buildDir = await buildWithFile("2026-09-23", "new");
    await publishSet(dataDir, "2026-09-23", buildDir);
    expect(
      await fs.readFile(
        path.join(dataDir, "sets", "2026-09-23", "manifest.json"),
        "utf8",
      ),
    ).toBe("new");
    expect(await fs.readdir(path.join(dataDir, "tmp"))).toEqual([]);
  });

  it("replaces an existing set for the same date", async () => {
    await publishSet(
      dataDir,
      "2026-09-23",
      await buildWithFile("2026-09-23", "old"),
    );
    await publishSet(
      dataDir,
      "2026-09-23",
      await buildWithFile("2026-09-23", "new"),
    );
    expect(
      await fs.readFile(
        path.join(dataDir, "sets", "2026-09-23", "manifest.json"),
        "utf8",
      ),
    ).toBe("new");
    expect(await fs.readdir(path.join(dataDir, "tmp"))).toEqual([]);
  });
});

describe("cleanTmpDir", () => {
  it("removes leftovers but keeps the lock file", async () => {
    await createBuildDir(dataDir, "2026-09-22");
    const release = await acquireLock(dataDir);
    expect(await cleanTmpDir(dataDir)).toHaveLength(1);
    expect(await fs.readdir(path.join(dataDir, "tmp"))).toEqual(["fetch.lock"]);
    await release?.();
  });
});

describe("acquireLock", () => {
  it("refuses a second lock held by a live process", async () => {
    await fs.mkdir(path.join(dataDir, "tmp"), { recursive: true });
    await fs.writeFile(
      getLockPath(dataDir),
      JSON.stringify({ pid: process.ppid }),
    );
    expect(await acquireLock(dataDir)).toBeNull();
  });

  it("takes over a lock older than an hour", async () => {
    await fs.mkdir(path.join(dataDir, "tmp"), { recursive: true });
    await fs.writeFile(
      getLockPath(dataDir),
      JSON.stringify({ pid: process.ppid }),
    );
    const release = await acquireLock(
      dataDir,
      Date.now() + 2 * 60 * 60 * 1_000,
    );
    expect(release).not.toBeNull();
    await release?.();
    await expect(fs.stat(getLockPath(dataDir))).rejects.toThrow();
  });

  it("releases so the next run can lock again", async () => {
    const release = await acquireLock(dataDir);
    expect(release).not.toBeNull();
    await release?.();
    expect(await acquireLock(dataDir)).not.toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities once", () => {
    expect(decodeHtmlEntities("a &amp;lt; b &#39;c&#x27; &unknown; &#0;")).toBe(
      "a &lt; b 'c' &unknown; &#0;",
    );
  });
});
