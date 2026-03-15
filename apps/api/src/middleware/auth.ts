import type { NextFunction, Request, Response } from "express";

import { fail } from "./response.js";

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    fail(res, "Please login first", "AUTH_REQUIRED", 401);
    return;
  }
  next();
}
