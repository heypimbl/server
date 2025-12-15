import { test } from "vitest";
import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import { submitServiceRequest, type ProblemRequest } from "./problem.js";

test(
  "submitServiceRequest submits illegal parking complaint",
  async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const problem: ProblemRequest = {
      problemDetail: "Parking Permit Improper Use",
      observedDatetime: new Date("2025-11-03T11:51:00-0500"),
      description: "Parked in no standing zone",
      address: "382 Bridge St",
      imagePaths: [],
    };

    function logWithIdTesting(message: any, ...optionalParams: any[]): void {
      console.info("[" + "TESTING" + "]", message, ...optionalParams);
    }
    const srNumber = await submitServiceRequest(page, problem, logWithIdTesting);

    console.log("Service request submitted:", srNumber);

    assert.ok(srNumber, "Service request number should be returned");

    await page.close();
    await context.close();
    await browser.close();
  },
  5 * 60 * 1000,
);
