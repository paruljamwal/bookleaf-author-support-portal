import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { getEnv } from "./config/env.js";
import { requireCsrf } from "./middleware/csrf.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requestLogger } from "./middleware/request-logger.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { authorRouter } from "./routes/author.js";
import { healthRouter } from "./routes/health.js";
import { realtimeRouter } from "./routes/realtime.js";

export function createApp() {
  const env = getEnv();
  const app = express();
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true,
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => getEnv().NODE_ENV === "test",
    }),
  );
  app.use(requireCsrf);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => getEnv().NODE_ENV === "test",
    message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
  });
  const aiLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => getEnv().NODE_ENV === "test",
    message: { error: { code: "RATE_LIMITED", message: "Too many AI requests. Try again later." } },
  });

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth/login", loginLimiter);
  app.use("/api/v1/auth/register", loginLimiter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/author", authorRouter);
  app.use("/api/v1/admin/tickets/:ticketId/draft", aiLimiter);
  app.use("/api/v1/admin/tickets/:ticketId/classify", aiLimiter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/realtime", realtimeRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
