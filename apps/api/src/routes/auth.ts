import type { LoginRequest, RegisterRequest, UserSession } from "@piano-llm-lab/shared-types";
import bcrypt from "bcryptjs";
import type { SessionData } from "express-session";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/database.js";
import { fail, ok } from "../middleware/response.js";

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(72),
  nickname: z.string().min(1).max(30),
  _csrf: z.string().min(8),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  _csrf: z.string().min(8),
});

function toSession(reqUser: NonNullable<SessionData["user"]> | undefined): UserSession {
  if (!reqUser) {
    return {
      id: 0,
      username: "",
      nickname: "",
      role: "user",
      loggedIn: false,
    };
  }
  return {
    ...reqUser,
    loggedIn: true,
  };
}

export const authRouter = Router();

authRouter.get("/me", (req, res) => {
  ok(res, toSession(req.session.user));
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body as RegisterRequest & { _csrf: string });
  if (!parsed.success) {
    fail(res, parsed.error.issues[0]?.message ?? "Invalid payload", "BAD_REQUEST");
    return;
  }

  const { username, password, nickname } = parsed.data;
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  if (exists) {
    fail(res, "Username already exists", "USERNAME_EXISTS");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const role = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  const nextRole = role.c === 0 ? "admin" : "user";
  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, nickname, role, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .run(username, passwordHash, nickname, nextRole);

  req.session.user = {
    id: Number(result.lastInsertRowid),
    username,
    nickname,
    role: nextRole,
  };

  ok(res, toSession(req.session.user));
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body as LoginRequest & { _csrf: string });
  if (!parsed.success) {
    fail(res, parsed.error.issues[0]?.message ?? "Invalid payload", "BAD_REQUEST");
    return;
  }

  const { username, password } = parsed.data;
  const user = db
    .prepare("SELECT id, username, nickname, role, password_hash FROM users WHERE username = ?")
    .get(username) as
    | {
        id: number;
        username: string;
        nickname: string;
        role: "user" | "admin";
        password_hash: string;
      }
    | undefined;

  if (!user) {
    fail(res, "Invalid credentials", "AUTH_INVALID", 401);
    return;
  }

  const okPassword = await bcrypt.compare(password, user.password_hash);
  if (!okPassword) {
    fail(res, "Invalid credentials", "AUTH_INVALID", 401);
    return;
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
  };

  ok(res, toSession(req.session.user));
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      fail(res, "Logout failed", "LOGOUT_FAILED", 500);
      return;
    }
    ok(res, { loggedIn: false });
  });
});
