import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chromium } from "playwright";
import { submitServiceRequest } from "./problem.ts";

const browser = await chromium.launch({ headless: false });

const app = new Hono();

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  if (browser) await browser.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  if (browser) await browser.close();
  process.exit(0);
});

app.post("/problem", async (c) => {
  // const { imagePath } = await c.req.json();

  const context = await browser.newContext();
  const page = await context.newPage();

  const problem = {
    problemDetail: "Blocked Bike Lane",
    observedDatetime: new Date(),
    description: "Vehicle parked in bike lane",
    address: "382 Bridge St",
    // imagePath,
  };

  const srNumber = await submitServiceRequest(page, problem);

  await page.close();
  await context.close();

  console.log("Service request submitted:", srNumber);

  return c.json({
    success: true,
    serviceRequestNumber: srNumber,
    submittedAt: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 4000;

console.log(`Server running on port ${PORT}`);
console.log(`Submit endpoint: POST http://localhost:${PORT}/problem`);

serve({
  fetch: app.fetch,
  port: Number(PORT),
});
