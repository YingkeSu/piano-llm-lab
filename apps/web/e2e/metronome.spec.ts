import { expect, test } from "@playwright/test";

test("metronome start stop and bpm", async ({ page }) => {
  await page.goto("/metronome");

  await page.getByTestId("metronome-bpm").fill("140");
  await page.getByTestId("metronome-start").click();

  await expect(page.getByTestId("metronome-status")).toContainText("140 BPM");

  await page.getByTestId("metronome-stop").click();
  await expect(page.getByTestId("metronome-status")).toContainText("Stopped");
});
