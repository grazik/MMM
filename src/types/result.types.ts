export type Result = { ok: true } | { ok: false; message: string };

export type ValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };
