import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { fail } from "./response.js";

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  return req.session.csrfToken;
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "POST") {
    next();
    return;
  }

  const token = req.body?._csrf;
  if (!token || token !== req.session.csrfToken) {
    fail(res, "Invalid CSRF token", "CSRF_INVALID", 403);
    return;
  }

  next();
}
