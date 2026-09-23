import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import type { MediaKind } from "@/types/api.types";
import type { ValueResult } from "@/types/result.types";
import { MEDIA_TIMEOUT_MS } from "./constants/fetcher.constants";
import type { DownloadMedia } from "./types/fetcher.types";

// The file extension decides the content type the server sends, so only known types are stored.
const EXTENSIONS_BY_KIND: Record<MediaKind, Record<string, string>> = {
  image: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  },
  video: {
    "video/mp4": "mp4",
    "video/webm": "webm",
  },
};

export const getExtensionForContentType = (
  contentType: string | null,
  kind: MediaKind,
): string | undefined => {
  const mimeType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (!mimeType) return undefined;
  return EXTENSIONS_BY_KIND[kind][mimeType];
};

const removeQuietly = async (filePath: string) => {
  await fs.rm(filePath, { force: true });
};

export const createDownloader =
  (dir: string): DownloadMedia =>
  async ({ url, kind, baseName }): Promise<ValueResult<string>> => {
    let filePath: string | undefined;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
      });
      if (!response.ok || !response.body)
        return { ok: false, message: `HTTP ${response.status} for ${url}` };
      const contentType = response.headers.get("content-type");
      const extension = getExtensionForContentType(contentType, kind);
      if (!extension) {
        await response.body.cancel();
        return {
          ok: false,
          message: `Unexpected content type ${contentType} for ${url}`,
        };
      }
      const fileName = `${baseName}.${extension}`;
      filePath = path.join(dir, fileName);
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
        createWriteStream(filePath),
      );
      const { size } = await fs.stat(filePath);
      if (size === 0) {
        await removeQuietly(filePath);
        return { ok: false, message: `Empty file for ${url}` };
      }
      return { ok: true, value: fileName };
    } catch (err) {
      if (filePath) await removeQuietly(filePath);
      return {
        ok: false,
        message: `Download failed for ${url}: ${String(err)}`,
      };
    }
  };
