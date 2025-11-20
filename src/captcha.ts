export async function solveCaptcha(siteKey: string, pageUrl: string, apiKey: string): Promise<string> {
  const createTaskUrl = "https://api.2captcha.com/createTask";
  const getResultUrl = "https://api.2captcha.com/getTaskResult";

  // Step 1: Submit captcha to 2captcha
  const submitResponse = await fetch(createTaskUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "RecaptchaV2TaskProxyless",
        websiteURL: pageUrl,
        websiteKey: siteKey,
      },
    }),
  });

  const submitData = await submitResponse.json();

  if (submitData.errorId !== 0) {
    throw new Error(`Failed to submit captcha to 2captcha: ${submitData.errorDescription || submitData.errorId}`);
  }

  const taskId = submitData.taskId;
  console.log(`Captcha submitted to 2captcha with task ID: ${taskId}`);

  // Step 2: Poll for the solution
  const maxAttempts = 300; // Poll up to 300 times
  const pollDelayMs = 1000; // Wait 1 second between polls

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    }

    const pollResponse = await fetch(getResultUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        taskId: taskId,
      }),
    });

    const pollData = await pollResponse.json();

    if (pollData.errorId !== 0) {
      throw new Error(`Error checking captcha status: ${pollData.errorDescription || pollData.errorId}`);
    }

    if (pollData.status === "processing") {
      console.log(`Captcha still processing, attempt ${attempt + 1}/${maxAttempts}`);
      continue;
    }

    if (pollData.status === "ready") {
      console.log("Captcha solved successfully");
      return pollData.solution.gRecaptchaResponse;
    }
  }

  throw new Error("Captcha solving timeout after 120 seconds");
}
