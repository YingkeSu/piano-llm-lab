import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ApiResult } from "@piano-llm-lab/shared-types";
import connectSqlite3 from "connect-sqlite3";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";

import { requireCsrf } from "./middleware/csrf.js";
import { authRouter } from "./routes/auth.js";
import { commentRouter } from "./routes/comments.js";
import { csrfRouter } from "./routes/csrf.js";

const SQLiteStore = connectSqlite3(session);
const __filename = fileURLToPath(import.meta.url);
const apiRoot = path.resolve(path.dirname(__filename), "..");
const sessionStore = new SQLiteStore({
  db: "sessions.db",
  dir: path.resolve(apiRoot, "data"),
  table: "sessions",
  concurrentDB: "true",
}) as unknown as session.Store;

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "piano-llm-lab-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    store: sessionStore,
  }),
);

app.get("/api/health", (_req, res) => {
  const body: ApiResult<{ ok: boolean }> = { success: true, data: { ok: true } };
  res.json(body);
});

app.use("/api", csrfRouter);
app.use(requireCsrf);
app.use("/api/auth", authRouter);
app.use("/api", commentRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const body: ApiResult<never> = {
    success: false,
    msg: error.message,
    code: "INTERNAL_ERROR",
  };
  res.status(500).json(body);
});

export default app;
