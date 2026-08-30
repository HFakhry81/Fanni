import * as Sentry from "@sentry/node";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { isQuietRequestPath } from "./lib/logNoise";
import { isCorsOriginAllowed } from "./lib/corsOrigins";

const app: Express = express();

// 1. الـ Middlewares الأساسية
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => isQuietRequestPath(req.url),
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin));
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Public metadata (reduces noisy 404s from browsers and uptime checks)
app.get("/", (_req, res) => {
  res.status(200).json({
    name: "Fanni API",
    status: "ok",
    message: "Fanni API is running successfully",
    health: "/healthz",
    api: "/api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

// Health Check Endpoint
app.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is healthy and running",
    timestamp: new Date().toISOString(),
  });
});

// Ping Endpoint (no console.log — PM2 error log should stay for real errors only)
app.get("/ping", (_req, res) => {
  res.send("pong");
});

// المسارات الأساسية للتطبيق
app.use("/api", router);

// Block common sensitive probes without a body leak
app.use((req, res, next) => {
  if (isQuietRequestPath(req.url) && req.method === "GET") {
    res.status(404).end();
    return;
  }
  next();
});

// 👈 معالج الأخطاء الخاص بـ Sentry (يجب أن يكون دائماً بعد كل الـ Routes)
Sentry.setupExpressErrorHandler(app);

// Ensure API clients always get JSON errors (not HTML) after Sentry
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  logger.error({ err }, "Unhandled request error");
  res.status(status).json({ error: message });
});

// JSON 404 for unknown API-style paths (still logged unless quiet)
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

export default app;