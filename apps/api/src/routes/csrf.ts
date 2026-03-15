import { Router } from "express";

import { ensureCsrfToken } from "../middleware/csrf.js";
import { ok } from "../middleware/response.js";

export const csrfRouter = Router();

csrfRouter.get("/csrf", (req, res) => {
  const token = ensureCsrfToken(req);
  ok(res, token);
});
