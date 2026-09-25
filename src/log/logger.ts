type Fields = Record<string, unknown>;

const write = (
  level: "info" | "warn" | "error",
  module: string,
  message: string,
  fields?: Fields,
) => {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      module,
      message,
      ...fields,
    }),
  );
};

const serializeError = (err: unknown) =>
  err instanceof Error
    ? { error: err.message, stack: err.stack }
    : { error: String(err) };

// One JSON line per event on stdout, so `docker logs` stays greppable.
export const createLogger = (module: string) => ({
  info: (message: string, fields?: Fields) =>
    write("info", module, message, fields),
  warn: (message: string, fields?: Fields) =>
    write("warn", module, message, fields),
  error: (message: string, err?: unknown, fields?: Fields) =>
    write("error", module, message, {
      ...(err === undefined ? {} : serializeError(err)),
      ...fields,
    }),
});

export type Logger = ReturnType<typeof createLogger>;
