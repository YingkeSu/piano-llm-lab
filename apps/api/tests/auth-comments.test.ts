import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/db/database.js";

function clearDb(): void {
  db.exec("DELETE FROM comments;");
  db.exec("DELETE FROM users;");
}

describe("auth + comments api", () => {
  beforeEach(() => {
    clearDb();
  });

  it("register/login/me/logout flow", async () => {
    const agent = request.agent(app);

    const csrfRes = await agent.get("/api/csrf");
    expect(csrfRes.body.success).toBe(true);
    const csrf = csrfRes.body.data as string;

    const registerRes = await agent.post("/api/auth/register").send({
      username: "tester",
      password: "pass1234",
      nickname: "Tester",
      _csrf: csrf,
    });
    expect(registerRes.body.success).toBe(true);

    const me1 = await agent.get("/api/auth/me");
    expect(me1.body.data.loggedIn).toBe(true);

    const csrf2 = (await agent.get("/api/csrf")).body.data;
    const logoutRes = await agent.post("/api/auth/logout").send({ _csrf: csrf2 });
    expect(logoutRes.body.success).toBe(true);

    const me2 = await agent.get("/api/auth/me");
    expect(me2.body.data.loggedIn).toBe(false);
  });

  it("supports anonymous publish and admin delete", async () => {
    const admin = request.agent(app);
    const anonymous = request.agent(app);

    const csrfA = (await admin.get("/api/csrf")).body.data;
    await admin.post("/api/auth/register").send({
      username: "admin",
      password: "pass1234",
      nickname: "Admin",
      _csrf: csrfA,
    });

    const csrfAnon = (await anonymous.get("/api/csrf")).body.data;
    const publish = await anonymous.post("/api/pinlun/publish").send({
      id: "piano",
      text: "anonymous comment",
      nickname: "anon",
      anonymous: true,
      _csrf: csrfAnon,
    });
    expect(publish.body.success).toBe(true);

    const csrfList = (await admin.get("/api/csrf")).body.data;
    const list = await admin.post("/api/pinlun/list").send({
      id: "piano",
      pageIndex: 1,
      q: "",
      _csrf: csrfList,
    });
    expect(list.body.success).toBe(true);
    expect(list.body.data.list.length).toBe(1);

    const commentId = list.body.data.list[0].id;
    const csrfDel = (await admin.get("/api/csrf")).body.data;
    const del = await admin.post("/api/pinlun/del").send({ id: commentId, _csrf: csrfDel });
    expect(del.body.success).toBe(true);
  });

  it("rejects write without valid csrf", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({
      username: "u1",
      password: "pass1234",
      nickname: "u1",
      _csrf: "wrong",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_INVALID");
  });
});
