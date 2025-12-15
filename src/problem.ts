import type { Page } from "playwright";
import { expect } from "playwright/test";
import options from "./options.js";
import { solveCaptcha } from "./captcha.js";

export interface ProblemRequest {
  problemDetail: string;
  observedDatetime: Date;
  description: string;
  address: string;
  imagePaths: string[];
}

const ILLEGAL_PARKING_LANDING_URL = "https://portal.311.nyc.gov/article/?kanumber=KA-01986";

function formatDateTime(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, "0");

  return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(ILLEGAL_PARKING_LANDING_URL);

  await page.getByRole("link", { name: "Sign In" }).click();
  await page.locator("#logonIdentifier").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#next").click();
}

export async function submitServiceRequest(page: Page, req: ProblemRequest, logWithId: any): Promise<string> {
  logWithId("Visiting landing page:", ILLEGAL_PARKING_LANDING_URL);
  await page.goto(ILLEGAL_PARKING_LANDING_URL);

  if (req.imagePaths.length > 3) throw new Error("At most 3 images may be submitted");

  await page.getByRole("button", { name: "Report Illegally Parked Vehicles" }).click();
  // <a> not considered a link because it has no href.
  await page.getByText("Report illegal parking.").first().click();
  logWithId("Page 1 - What: Filling out problem details");

  // Page 1 - What
  await page.locator("#n311_problemdetailid_select").selectOption({ label: req.problemDetail });
  await page.getByLabel("Date/Time Observed").fill(formatDateTime(req.observedDatetime));
  await page.getByLabel("Describe the Problem").fill(req.description);

  for (const path of req.imagePaths) {
    await page.getByRole("button", { name: "Add Attachment" }).click();
    await page.locator('input[type="file"]').last().setInputFiles(path);
    await page.locator(".modal-dialog").getByRole("button", { name: "Add Attachment" }).click();
  }

  await page.waitForLoadState("domcontentloaded");
  // Wait for the Next button to be enabled
  // logWithId("Waiting for Next button to be enabled...");
  // await page.locator("#NextButton").waitFor({ state: "enabled", timeout: 10000 }).catch(() => {});
  logWithId("Page 1 complete, clicking Next...");
  await page.getByRole("button", { name: "Next" }).click();
  logWithId("Page 2 - Where: Selecting address");

  // Page 2 - Where
  // Wait for map to fully load - Esri/ArcGIS map on this page can intercept clicks
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector('[class*="esri-view-surface"]', { timeout: 10000 }).catch(() => {});
  await page.locator("#SelectAddressWhere").click();

  // Autocomplete is inconsistent (non-deterministic?) so retry a few times.
  for (let i = 0; i < 4; i++) {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('[class*="esri-view-surface"]', { timeout: 10000 }).catch(() => {});
    await page.locator("#address-search-box-input").pressSequentially(req.address, { delay: 100 });

    const timeout = 500 * Math.pow(2, i);
    try {
      await page.locator(".ui-autocomplete .ui-menu-item-wrapper").first().click({ timeout });
    } catch (e) {
      logWithId(e);
      logWithId(`Retry #${i + 1}`);
      // The search input becomes disabled (and unfillable) when an address has
      // been selected. Not sure how we get into this state, but let's just
      // assume an address has been selected and move on.
      if (await page.locator("#address-search-box-input").isDisabled()) break;
      continue;
    }

    // We seem to click Select Address before it's enabled without this sleep?
    await new Promise((resolve) => setTimeout(resolve, 100));

    break;
  }

  logWithId("Clicking Select Address button...");
  await page.getByRole("button", { name: "Select Address" }).click();

  await page.waitForLoadState("domcontentloaded");

  logWithId("Page 2 complete, waiting a few seconds to render before clicking Next...");
     await new Promise((resolve) => setTimeout(resolve, 10000));
  logWithId("Page 2 complete, clicking Next...");
  await page.getByRole("button", { name: "Next" }).click();
  logWithId("Page 3 - Who: Skipping details");

  // Page 3 - Who
  await page.waitForLoadState("domcontentloaded");
  logWithId("Page 3 complete, clicking Next...");
  await page.getByRole("button", { name: "Next" }).click();
  logWithId("Page 4 - Review: Solving captcha and submitting");

  // Page 4 - Review
  // Extract reCAPTCHA site key from the page
  const siteKey = await page.locator("[data-sitekey]").first().getAttribute("data-sitekey");
  if (!siteKey) {
    throw new Error("Could not find reCAPTCHA site key on page");
  }

  if (options.noSubmit) {
    logWithId("noSubmit option enabled, returning dummy SR number");
    return "dummy-service-request-number";
  }

  // Solve captcha using 2captcha
  logWithId("Solving reCAPTCHA using 2captcha...");
  const captchaToken = await solveCaptcha(siteKey, page.url(), options.twoCaptchaApiKey);
  logWithId("reCAPTCHA solved successfully");

  // Wait for the g-recaptcha-response field to be created by the widget
  logWithId("Waiting for g-recaptcha-response field to be created...");
  await page.waitForFunction(() => {
    return document.querySelector('textarea[name="g-recaptcha-response"]') !== null;
  }, { timeout: 5000 });
  logWithId("g-recaptcha-response field found");

  // Inject the token and trigger the callback
  logWithId("Injecting token into g-recaptcha-response...");
  await page.evaluate((token) => {
    // Set the token in the textarea
    const field = document.querySelector('textarea[name="g-recaptcha-response"]') as HTMLTextAreaElement;
    if (field) {
      field.value = token;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Find and trigger the reCAPTCHA callback if it exists
    // The callback is typically registered with the widget
    if ((window as any).___grecaptcha_cfg?.callbacks) {
      const callbacks = (window as any).___grecaptcha_cfg.callbacks;
      for (const key in callbacks) {
        if (callbacks[key] && typeof callbacks[key] === 'function') {
          try {
            callbacks[key](token);
            logWithId("Callback triggered successfully");
            return;
          } catch (e) {
            // Continue to next callback if this one fails
          }
        }
      }
    }
  }, captchaToken);
  logWithId("Token injection complete");

  logWithId("Clicking Complete and Submit button...");
  await page.getByRole("button", { name: "Complete and Submit" }).click();

  // Submission confirmation page
  logWithId("Extracting SR Number from confirmation page...");
  const srNumber = await page.getByLabel("SR Number").inputValue();
  logWithId("Service request submitted successfully:", srNumber);
  return srNumber;
}
