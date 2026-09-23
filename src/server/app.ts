import fs from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getSetDir } from "@/storage/paths";
import type { Config } from "@/types/config.types";
import { isValidMediaDate, isValidMediaFile } from "./media-path";
import { findNewestManifest, toTodayResponse } from "./today";

type AppOptions = {
  config: Config;
  webDir: string;
};

const NO_CACHE = "no-cache";
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const isFile = async (filePath: string) => {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
};

export const createApp = ({ config, webDir }: AppOptions) => {
  const app = new Hono();

  // Only successful file responses may be cached forever; errors and the SPA shell must revalidate.
  app.use("*", async (c, next) => {
    await next();
    const isCacheable =
      (c.res.status === 200 || c.res.status === 206) &&
      (c.req.path.startsWith("/media/") || c.req.path.startsWith("/assets/"));
    c.header("Cache-Control", isCacheable ? IMMUTABLE_CACHE : NO_CACHE);
  });

  app.get("/api/today", async (c) =>
    c.json(
      toTodayResponse(
        await findNewestManifest(config.dataDir),
        new Date(),
        config,
      ),
    ),
  );

  app.get("/healthz", async (c) => {
    const manifest = await findNewestManifest(config.dataDir);
    return c.json({ status: "ok", lastFetchedAt: manifest?.fetchedAt ?? null });
  });

  app.all("/api/*", (c) => c.notFound());

  // serveStatic answers Range requests with 206/416, which iOS Safari needs to play video.
  app.get("/media/:date/:file", async (c, next) => {
    const { date, file } = c.req.param();
    if (!isValidMediaDate(date) || !isValidMediaFile(file)) return c.notFound();
    const filePath = path.join(getSetDir(config.dataDir, date), file);
    if (!(await isFile(filePath))) return c.notFound();
    c.header("Accept-Ranges", "bytes");
    return serveStatic({ path: filePath })(c, next);
  });

  app.all("/media/*", (c) => c.notFound());

  app.use("*", serveStatic({ root: webDir }));

  // Missing hashed assets are real 404s; only app routes fall back to the SPA shell.
  app.all("/assets/*", (c) => c.notFound());

  app.get("*", serveStatic({ root: webDir, path: "index.html" }));

  return app;
};
