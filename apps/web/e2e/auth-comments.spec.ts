import { expect, test } from "@playwright/test";

test("register login publish and delete comment", async ({ page }) => {
  await page.goto("/");

  const suffix = Date.now();
  await page.getByTestId("switch-register").click();
  await page.getByTestId("auth-username").fill(`user_${suffix}`);
  await page.getByTestId("auth-password").fill("pass1234");
  await page.getByTestId("auth-nickname").fill("Tester");
  await page.getByTestId("auth-submit").click();

  await page.getByTestId("comment-content").fill(`comment-${suffix}`);
  await page.getByTestId("comment-publish").click();
  await expect(page.getByText(`comment-${suffix}`)).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByText(`comment-${suffix}`)).toHaveCount(0);
});

test("anonymous comment flow", async ({ page }) => {
  await page.goto("/");
  const suffix = Date.now();

  const logout = page.getByRole("button", { name: "Logout" });
  if (await logout.count()) {
    await logout.first().click();
  }

  await page.getByRole("checkbox", { name: "anonymous" }).check();
  await page.getByTestId("comment-content").fill(`anon-${suffix}`);
  await page.getByPlaceholder("anonymous nickname").fill("guest");
  await page.getByTestId("comment-publish").click();

  await expect(page.getByText(`anon-${suffix}`)).toBeVisible();
});
