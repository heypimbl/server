import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chromium } from "playwright";
import { reverseGeocode } from "./geocode.ts";
import { submitServiceRequest } from "./problem.ts";
import fs from "fs";
import path from "path";

const browser = await chromium.launch({ headless: false });

const app = new Hono();

const UPLOAD_DIR = "./state";

interface ProblemRequest {
  timestamp: string;
  latitude: number;
  longitude: number;
  "image[]": File[];
  problemDetail?: string;
  description?: string;
  address?: string;
}

app.post("/problem", async (c) => {
  // TODO validate request body
  const body = (await c.req.parseBody()) as unknown as ProblemRequest;

  console.log(body);

  let address = body.address;
  if (address == null) {
    address = await reverseGeocode(body.latitude, body.longitude);
  }

  // TODO UUIDv7 PIMBL id?
  const requestDatetime = Date.now();

  const imageFiles = body["image[]"].slice(0, 3);
  const imagePaths = await Promise.all(
    imageFiles.map(async (file, i) => {
      const filename = `${requestDatetime}-${i}-${file.name}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      const arrayBuffer = await file.arrayBuffer();
      await fs.promises.writeFile(filepath, Buffer.from(arrayBuffer));

      return filepath;
    }),
  );

  const context = await browser.newContext();
  const page = await context.newPage();

  const problem = {
    problemDetail: body.problemDetail || "Blocked Bike Lane",
    observedDatetime: new Date(body.timestamp),
    description: body.description || "Vehicle parked in bike lane",
    address,
    imagePaths,
  };

  const srNumber = await submitServiceRequest(page, problem);

  await page.close();
  await context.close();

  console.log("Service request submitted:", srNumber);

  return c.json({
    success: true,
    serviceRequestNumber: srNumber,
    submittedAt: new Date().toISOString(),
    imagesUploaded: imagePaths.length,
  });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT || 4000) }, (info) => {
  console.log(`Server running on ${info.address}:${info.port}`);
});
