import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chromium } from "playwright";
import { reverseGeocode } from "./geocode";
import { submitServiceRequest } from "./problem";
import options from "./options";
import fs from "fs";
import path from "path";

const browser = await chromium.launch({ headless: true });

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

  const { "image[]": images, ...bodyExceptImages } = body;
  console.info("POST /problem", JSON.stringify({ ...bodyExceptImages, imageCount: images.length }));

  let address = body.address;
  if (address == null) {
    address = await reverseGeocode(body.latitude, body.longitude);
    console.info(`Reverse geocode: (${body.latitude},${body.longitude}) -> ${address}`);
  }

  // TODO UUIDv7 PIMBL id?
  const requestDatetime = Date.now();

  const imagePaths = await Promise.all(
    images.slice(0, 3).map(async (file, i) => {
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
  console.info("SR Number", srNumber);

  if (!options.linger) {
    await page.close();
    await context.close();
  }

  return c.json({
    success: true,
    serviceRequestNumber: srNumber,
    submittedAt: new Date().toISOString(),
    imagesUploaded: imagePaths.length,
  });
});

serve({ fetch: app.fetch, port: options.port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
