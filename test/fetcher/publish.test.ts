import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireLock, getLockPath } from "@/fetcher/lock";
import { cleanTmpDir, createBuildDir, publishSet } from "@/fetcher/publish";

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
  const createForeignLock = async (mtime: Date) => {
    await fs.mkdir(getLockPath(dataDir), { recursive: true });
    await fs.utimes(getLockPath(dataDir), mtime, mtime);
  };

  it("refuses a second lock while this process holds it", async () => {
    const release = await acquireLock(dataDir);
    expect(release).not.toBeNull();
    expect(await acquireLock(dataDir)).toBeNull();
    await release?.();
  });

  it("refuses a lock another process keeps fresh", async () => {
    await createForeignLock(new Date());
    expect(await acquireLock(dataDir)).toBeNull();
  });

  it("takes over a lock whose holder stopped refreshing it", async () => {
    await createForeignLock(new Date(Date.now() - 60_000));
    const release = await acquireLock(dataDir);
    expect(release).not.toBeNull();
    await release?.();
    await expect(fs.stat(getLockPath(dataDir))).rejects.toThrow();
  });

  it("releases so the next run can lock again", async () => {
    const release = await acquireLock(dataDir);
    expect(release).not.toBeNull();
    await release?.();
    const next = await acquireLock(dataDir);
    expect(next).not.toBeNull();
    await next?.();
  });
});
