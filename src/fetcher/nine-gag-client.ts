import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ValueResult } from "@/types/result.types";
import { API_TIMEOUT_MS, FETCH_ERRORS } from "./constants/fetcher.constants";
import {
  GUEST_TOKEN_RESPONSE_SCHEMA,
  HOT_PAGE_RESPONSE_SCHEMA,
} from "./nine-gag-schema";
import type { FetchHotPage, HotPage } from "./types/fetcher.types";

const API_BASE_URL = "https://api.9gag.com";
const APP_ID = "com.ninegag.android.app";
const HOT_PATH = "/v2/post-list/group/default/type/hot/count/10";

// The real app keeps one device id per install; one per process mimics that.
const DEVICE_UUID = randomBytes(16).toString("hex");

export const signRequest = (
  timestampMs: number,
  appId: string,
  deviceUuid: string,
): string =>
  createHash("sha1")
    .update(`*${timestampMs}_._${appId}._.${deviceUuid}9GAG`)
    .digest("hex");

const buildHeaders = (token: string): Record<string, string> => {
  const timestampMs = Date.now();
  return {
    "9GAG-APP_ID": APP_ID,
    "X-Package-ID": APP_ID,
    "9GAG-DEVICE_UUID": DEVICE_UUID,
    "X-Device-UUID": DEVICE_UUID,
    "9GAG-DEVICE_TYPE": "android",
    "9GAG-BUCKET_NAME": "MAIN_RELEASE",
    "9GAG-TIMESTAMP": String(timestampMs),
    "9GAG-REQUEST-SIGNATURE": signRequest(timestampMs, APP_ID, DEVICE_UUID),
    "9GAG-9GAG_TOKEN": token,
  };
};

const requestJson = async (
  path: string,
  token: string,
  errorMessage: string,
): Promise<ValueResult<unknown>> => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: buildHeaders(token),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok)
      return {
        ok: false,
        message: `${errorMessage}: HTTP ${response.status} for ${path}`,
      };
    const body: unknown = await response.json();
    return { ok: true, value: body };
  } catch (err) {
    return { ok: false, message: `${errorMessage}: ${String(err)}` };
  }
};

export const parseHotPage = (raw: unknown): ValueResult<HotPage> => {
  const parsed = HOT_PAGE_RESPONSE_SCHEMA.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: `${FETCH_ERRORS.invalidResponse}: ${z.prettifyError(parsed.error)}`,
    };
  return {
    ok: true,
    value: {
      posts: parsed.data.data.posts,
      isEndOfList: Boolean(parsed.data.data.didEndOfList),
    },
  };
};

export const getGuestToken = async (): Promise<ValueResult<string>> => {
  const response = await requestJson(
    "/v2/guest-token",
    "",
    FETCH_ERRORS.guestToken,
  );
  if (!response.ok) return response;
  const parsed = GUEST_TOKEN_RESPONSE_SCHEMA.safeParse(response.value);
  if (!parsed.success)
    return {
      ok: false,
      message: `${FETCH_ERRORS.invalidResponse}: ${z.prettifyError(parsed.error)}`,
    };
  return { ok: true, value: parsed.data.data.userToken };
};

export const createHotPageFetcher =
  (token: string): FetchHotPage =>
  async (olderThan) => {
    const path = olderThan
      ? `${HOT_PATH}/olderThan/${encodeURIComponent(olderThan)}`
      : HOT_PATH;
    const response = await requestJson(path, token, FETCH_ERRORS.hotPage);
    if (!response.ok) return response;
    return parseHotPage(response.value);
  };
