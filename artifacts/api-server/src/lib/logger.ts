import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

function serializeErr(err: unknown): { type: string; message: string; stack?: string; code?: string } {
  if (!(err instanceof Error)) {
    return { type: "Unknown", message: String(err) };
  }
  const pgCode =
    typeof err === "object" && err !== null && "code" in err && typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  return {
    type: err.name,
    message: err.message,
    ...(pgCode ? { code: pgCode } : {}),
    ...(isProduction ? {} : { stack: err.stack }),
  };
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "err.client",
    "err.connection",
  ],
  serializers: {
    err: serializeErr,
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
