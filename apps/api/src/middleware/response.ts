import type { ApiResult } from "@piano-llm-lab/shared-types";
import type { Response } from "express";

export function ok<T>(res: Response, data: T): void {
  const body: ApiResult<T> = { success: true, data };
  res.json(body);
}

export function fail(res: Response, msg: string, code: string, status = 400): void {
  const body: ApiResult<never> = { success: false, msg, code };
  res.status(status).json(body);
}
