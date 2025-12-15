import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chromium } from "playwright";
import { reverseGeocode } from "./geocode.js";
import { submitServiceRequest } from "./problem.js";
import options from "./options.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const browser = await chromium.launch({
  channel: "chromium",
  executablePath: options.chromiumPath,
});

const app = new Hono();

interface ProblemRequest {
  timestamp: string;
  latitude: number;
  longitude: number;
  "image[]": File[];
  problemDetail?: string;
  description?: string;
  address?: string;
}

app.get("/ping", async (c) => {
  return c.text("Hello world", 200);
})

app.post("/problem", async (c) => {
  // TODO validate request body
  const body = (await c.req.parseBody()) as unknown as ProblemRequest;

  // Generate unique identifier from request body and submission time
  const identifierData = {
    timestamp: body.timestamp,
    latitude: body.latitude,
    longitude: body.longitude
  };
  const uniqueIdentifier = crypto
    .createHash("sha256")
    .update(JSON.stringify(identifierData))
    .digest("hex")
    .substring(0, 16);

  function logWithId(message: any, ...optionalParams: any[]): void {
    console.info("[" + uniqueIdentifier + "]", message, ...optionalParams);
  }

  const { "image[]": images, ...bodyExceptImages } = body;
  logWithId("POST /problem", JSON.stringify({ ...bodyExceptImages, imageCount: images.length }));

  // Continue processing in the background without blocking the response
  (async () => {
    try {
      let address = body.address;
      if (address == null) {
        address = await reverseGeocode(body.latitude, body.longitude);
        logWithId(`Reverse geocode: (${body.latitude},${body.longitude}) -> ${address}`);
      }

      // TODO UUIDv7 PIMBL id?
      const requestDatetime = Date.now();

      const imagePaths = await Promise.all(
        images.slice(0, 3).map(async (file, i) => {
          const filename = `${requestDatetime}-${i}-${file.name}`;
          const filepath = path.join(options.stateDir, filename);

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

      const srNumber = await submitServiceRequest(page, problem, logWithId);
      logWithId("SR Number", srNumber);

      if (!options.linger) {
        await page.close();
        await context.close();
      }
    } catch (error) {
      logWithId("Error processing request:", error);
    }
  })();

  // Return immediately
  return c.json({
    success: true,
    message: "Request received and processing",
    submittedAt: new Date().toISOString(),
  });
});

const server = serve({ fetch: app.fetch, port: options.port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});

const shutdown = async () => {
  console.log("\nShutting down gracefully...");

  // Set a timeout to force kill if shutdown takes too long
  const forceKillTimeout = setTimeout(() => {
    console.error("Shutdown timeout - forcing exit");
    process.exit(1);
  }, 10000);

  try {
    await browser.close();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    clearTimeout(forceKillTimeout);
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    clearTimeout(forceKillTimeout);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
