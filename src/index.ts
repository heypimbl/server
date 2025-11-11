import express from "express";
import { chromium } from "playwright";
import { submitServiceRequest } from "./problem.ts";

const browser = await chromium.launch({ headless: false });

const app = express();
app.use(express.json());

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  if (browser) await browser.close();
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  if (browser) await browser.close();
  process.exit(0);
});

app.post("/problem", async (req, res) => {
  // const { imagePath } = req.body;

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

  res.json({
    success: true,
    serviceRequestNumber: srNumber,
    submittedAt: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Submit endpoint: POST http://localhost:${PORT}/problem`);
});
