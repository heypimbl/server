import type { Page } from "playwright";

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

export async function submitServiceRequest(page: Page, req: ProblemRequest): Promise<string> {
  await page.goto(ILLEGAL_PARKING_LANDING_URL);

  if (req.imagePaths.length > 3) throw new Error("At most 3 images may be submitted");

  await page.getByRole("button", { name: "Report Illegally Parked Vehicles" }).click();
  // <a> not considered a link because it has no href.
  await page.getByText("Report illegal parking.").first().click();

  // Page 1 - What
  await page.locator("#n311_problemdetailid_select").selectOption({ label: req.problemDetail });
  await page.getByLabel("Date/Time Observed").fill(formatDateTime(req.observedDatetime));
  await page.getByLabel("Describe the Problem").fill(req.description);

  for (const path of req.imagePaths) {
    await page.getByRole("button", { name: "Add Attachment" }).click();
    await page.locator('input[type="file"]').last().setInputFiles(path);
    await page.getByRole("button", { name: "Add Attachment" }).click();
  }

  await page.getByRole("button", { name: "Next" }).click();

  // Page 2 - Where
  await page.locator("#SelectAddressWhere").click();

  await page.locator("#address-search-box-input").fill(req.address);
  await page.locator(".ui-autocomplete .ui-menu-item-wrapper").first().click();
  await page.getByRole("button", { name: "Select Address" }).click();

  await page.getByRole("button", { name: "Next" }).click();

  // Page 3 - Who
  await page.getByRole("button", { name: "Next" }).click();

  // Page 4 - Review
  await page.frameLocator("[title='reCAPTCHA']").locator(".recaptcha-checkbox").first().click();

  if (process.env.PIMBL_NO_SUBMIT ?? "" !== "") {
    return "dummy-service-request-number";
  } else {
    await page.getByRole("button", { name: "Complete and Submit" }).click();
    const srNumber = await page.locator("#n311_name").getAttribute("value");
    return srNumber || "";
  }
}
