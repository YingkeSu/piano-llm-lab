import type {
  CommentListRequest,
  CommentListResponse,
  CommentRecord,
  DeleteCommentRequest,
  PublishCommentRequest,
} from "@piano-llm-lab/shared-types";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/database.js";
import { fail, ok } from "../middleware/response.js";

const listSchema = z.object({
  id: z.string().min(1),
  pageIndex: z.coerce.number().int().min(1).default(1),
  q: z.string().max(100).optional().default(""),
  _csrf: z.string().min(8),
});

const publishSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(600),
  nickname: z.string().max(30).optional(),
  anonymous: z.boolean().optional().default(false),
  _csrf: z.string().min(8),
});

const delSchema = z.object({
  id: z.coerce.number().int().positive(),
  _csrf: z.string().min(8),
});

const PAGE_SIZE = 20;

export const commentRouter = Router();

commentRouter.post("/pinlun/list", (req, res) => {
  const parsed = listSchema.safeParse(req.body as CommentListRequest & { _csrf: string });
  if (!parsed.success) {
    fail(res, parsed.error.issues[0]?.message ?? "Invalid payload", "BAD_REQUEST");
    return;
  }

  const { id: pageId, pageIndex, q } = parsed.data;
  const offset = (pageIndex - 1) * PAGE_SIZE;

  const whereBase = `page_id = ? AND deleted_at IS NULL`;
  const where = q ? `${whereBase} AND content LIKE ?` : whereBase;
  const params = q ? [pageId, `%${q}%`] : [pageId];

  const rows = db
    .prepare(
      `SELECT c.id, c.content, c.created_at, c.status,
      c.user_id, c.nickname, u.username, u.nickname as user_nickname, u.role
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
    )
    .all(...params, PAGE_SIZE, offset) as Array<{
      id: number;
      content: string;
      created_at: string;
      status: "approved" | "pending";
      user_id: number | null;
      nickname: string | null;
      username: string | null;
      user_nickname: string | null;
      role: "user" | "admin" | null;
    }>;

  const totalRow = db
    .prepare(`SELECT COUNT(*) as total FROM comments WHERE ${where}`)
    .get(...params) as { total: number };

  const me = req.session.user;
  const list: CommentRecord[] = rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    status: row.status,
    user: {
      id: row.user_id,
      username: row.username ?? undefined,
      nickname: row.user_nickname ?? row.nickname ?? "匿名用户",
      self: !!me && row.user_id === me.id,
      isAdmin: row.role === "admin",
    },
  }));

  const data: CommentListResponse = {
    list,
    total: totalRow.total,
    pageIndex,
    pageSize: PAGE_SIZE,
  };

  ok(res, data);
});

commentRouter.post("/pinlun/publish", (req, res) => {
  const parsed = publishSchema.safeParse(req.body as PublishCommentRequest & { _csrf: string });
  if (!parsed.success) {
    fail(res, parsed.error.issues[0]?.message ?? "Invalid payload", "BAD_REQUEST");
    return;
  }

  const { id: pageId, text, anonymous, nickname } = parsed.data;
  const sessionUser = req.session.user;
  const isAnonymous = anonymous || !sessionUser;

  const status = isAnonymous ? "pending" : "approved";
  const commentNickname = isAnonymous ? nickname || "匿名用户" : sessionUser.nickname;
  const userId = isAnonymous ? null : sessionUser.id;

  const result = db
    .prepare(
      "INSERT INTO comments (page_id, user_id, nickname, content, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    )
    .run(pageId, userId, commentNickname, text, status);

  ok(res, {
    id: Number(result.lastInsertRowid),
    status,
  });
});

commentRouter.post("/pinlun/del", (req, res) => {
  const parsed = delSchema.safeParse(req.body as DeleteCommentRequest & { _csrf: string });
  if (!parsed.success) {
    fail(res, parsed.error.issues[0]?.message ?? "Invalid payload", "BAD_REQUEST");
    return;
  }

  const sessionUser = req.session.user;
  if (!sessionUser) {
    fail(res, "Please login first", "AUTH_REQUIRED", 401);
    return;
  }

  const row = db.prepare("SELECT id, user_id FROM comments WHERE id = ? AND deleted_at IS NULL").get(parsed.data.id) as
    | { id: number; user_id: number | null }
    | undefined;

  if (!row) {
    fail(res, "Comment not found", "COMMENT_NOT_FOUND", 404);
    return;
  }

  const own = row.user_id === sessionUser.id;
  const admin = sessionUser.role === "admin";
  if (!own && !admin) {
    fail(res, "No permission", "FORBIDDEN", 403);
    return;
  }

  db.prepare("UPDATE comments SET deleted_at = datetime('now') WHERE id = ?").run(row.id);
  ok(res, { id: row.id });
});
