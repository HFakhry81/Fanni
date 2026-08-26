import * as Sentry from "@sentry/node";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { isCorsOriginAllowed } from "./lib/corsOrigins";

const app: Express = express();

// 1. الـ Middlewares الأساسية
app.use(
  pinoHttp({
    logger,
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

// 🟢 2. Health Check Endpoint
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is healthy and running",
    timestamp: new Date().toISOString(),
  });
});

// 📝 3. Ping Endpoint
app.get("/ping", (req, res) => {
  console.log("سيرفر Node بيسجل أول Console Log بنجاح! 📝");
  Sentry.captureMessage("Fanni Server Log Activated Successfully!", "info");
  res.send("pong");
});

// 4. المسارات الأساسية للتطبيق
app.use("/api", router);

// 👈 5. معالج الأخطاء الخاص بـ Sentry (يجب أن يكون دائماً بعد كل الـ Routes)
Sentry.setupExpressErrorHandler(app);

// Ensure API clients always get JSON errors (not HTML) after Sentry
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(status).json({ error: message });
});

export default app;