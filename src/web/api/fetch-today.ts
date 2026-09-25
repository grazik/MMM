import type { TodayItem, TodayResponse } from "@/types/api.types";
import type { ValueResult } from "@/types/result.types";

const TODAY_URL = "/api/today";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOptional = (value: unknown, type: "string" | "boolean") =>
  value === undefined || typeof value === type;

const isApiTodayItem = (value: unknown): value is TodayItem =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  (value.kind === "image" || value.kind === "video") &&
  typeof value.mediaUrl === "string" &&
  isOptional(value.posterUrl, "string") &&
  typeof value.width === "number" &&
  typeof value.height === "number" &&
  isOptional(value.hasAudio, "boolean");

const isApiTodayResponse = (value: unknown): value is TodayResponse =>
  isRecord(value) &&
  (value.date === null || typeof value.date === "string") &&
  typeof value.stale === "boolean" &&
  Array.isArray(value.items) &&
  value.items.every(isApiTodayItem);

export const fetchToday = async (): Promise<ValueResult<TodayResponse>> => {
  try {
    const response = await fetch(TODAY_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }
    const body: unknown = await response.json();
    if (!isApiTodayResponse(body)) {
      return { ok: false, message: "Unexpected response shape" };
    }
    return { ok: true, value: body };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
};
