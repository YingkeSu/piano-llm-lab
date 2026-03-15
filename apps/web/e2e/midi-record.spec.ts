import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("midi import play seek stop", async ({ page }) => {
  await page.goto("/");

  const midiPath = path.resolve(__dirname, "fixtures/sample.mid");
  await page.getByTestId("midi-file-input").setInputFiles(midiPath);

  await expect(page.getByTestId("status-message")).toContainText("MIDI loaded");

  await page.getByTestId("play-midi").click();
  await page.waitForTimeout(350);

  await page.getByTestId("seek-midi").evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "600";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.waitForTimeout(120);
  await page.getByTestId("stop-midi").click();
  await expect(page.getByText("Idle")).toBeVisible();
});

test("record then replay", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("record-start").click();
  await page.keyboard.down("z");
  await page.waitForTimeout(160);
  await page.keyboard.up("z");
  await page.waitForTimeout(160);
  await page.getByTestId("record-stop").click();

  await expect(page.getByText("recording-")).toBeVisible();
  await page.getByTestId("record-play").first().click();
  await expect(page.getByTestId("status-message")).toContainText("Playback recording");
});
