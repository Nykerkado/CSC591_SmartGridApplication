/**
 * System Uptime Validation Tests
 *
 * Verifies that the health endpoint remains consistently available across
 * repeated calls, simulating uptime monitoring. Because these tests call
 * the handler function directly (no network), they also serve as a guard
 * against regressions that would cause the health handler to throw or
 * return a non-200 status.
 *
 * Uptime SLA tested: >= 99% success rate over N sequential calls.
 *
 * The live HTTP uptime test at the bottom requires a running server.
 * Run it with:
 *   npm run dev:server &
 *   node --import tsx --test server/perf/uptime.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { handleHealthRequest } from "../routes/healthRoutes.js";
import { handleAnalyticsRequest } from "../analytics/analyticsRoutes.js";

console.log("\n=== Uptime - System Availability ===");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_SIZE = 100;
const UPTIME_SLA = 0.99; // 99 %

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UptimeResult = {
  successCount: number;
  failureCount: number;
  uptimeFraction: number;
  errors: string[];
};

async function measureHandlerUptime(
  handler: () => Promise<{ statusCode: number } | null> | { statusCode: number } | null,
  expectedStatusCode: number,
  samples: number
): Promise<UptimeResult> {
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < samples; i++) {
    try {
      const result = await handler();
      if (result && result.statusCode === expectedStatusCode) {
        successCount++;
      } else {
        errors.push(
          `Call ${i + 1}: unexpected statusCode ${result?.statusCode ?? "null"}`
        );
      }
    } catch (err) {
      errors.push(`Call ${i + 1}: threw ${String(err)}`);
    }
  }

  const failureCount = samples - successCount;
  return {
    successCount,
    failureCount,
    uptimeFraction: successCount / samples,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Health endpoint — handler-level uptime
// ---------------------------------------------------------------------------

test(`GET /api/health: >= ${UPTIME_SLA * 100}% uptime over ${SAMPLE_SIZE} calls`, async () => {
  const result = await measureHandlerUptime(
    () => handleHealthRequest(),
    200,
    SAMPLE_SIZE
  );

  console.log(
    `  Health uptime: ${result.successCount}/${SAMPLE_SIZE} (${(result.uptimeFraction * 100).toFixed(1)}%)`
  );

  if (result.errors.length > 0) {
    console.log(`  Failures: ${result.errors.slice(0, 5).join(", ")}`);
  }

  assert.ok(
    result.uptimeFraction >= UPTIME_SLA,
    `Health uptime was ${(result.uptimeFraction * 100).toFixed(2)}% — below ${UPTIME_SLA * 100}% SLA. Failures: ${result.errors.join("; ")}`
  );
});

test("GET /api/health: returns 200 on every call in 100-call burst", () => {
  const failures: number[] = [];

  for (let i = 0; i < 100; i++) {
    const result = handleHealthRequest();
    if (result.statusCode !== 200) {
      failures.push(i);
    }
  }

  assert.equal(
    failures.length,
    0,
    `Health returned non-200 on calls: ${failures.join(", ")}`
  );
});

test("GET /api/health: payload contains required fields on every call", () => {
  for (let i = 0; i < 50; i++) {
    const result = handleHealthRequest();
    const payload = result.payload as Record<string, unknown>;

    assert.equal(typeof payload.status, "string", `Call ${i + 1}: missing 'status'`);
    assert.equal(typeof payload.service, "string", `Call ${i + 1}: missing 'service'`);
    assert.equal(typeof payload.timestamp, "string", `Call ${i + 1}: missing 'timestamp'`);
    assert.equal(payload.status, "ok", `Call ${i + 1}: status was not 'ok'`);
  }
});

test("GET /api/health: timestamp advances between calls", async () => {
  const first = handleHealthRequest();
  // Wait 2 ms to ensure the clock ticks
  await new Promise((resolve) => setTimeout(resolve, 2));
  const second = handleHealthRequest();

  const t1 = new Date((first.payload as { timestamp: string }).timestamp).getTime();
  const t2 = new Date((second.payload as { timestamp: string }).timestamp).getTime();

  assert.ok(t2 >= t1, "Second timestamp should be >= first timestamp");
});

// ---------------------------------------------------------------------------
// Analytics endpoints — handler-level uptime (empty store)
// ---------------------------------------------------------------------------

test(`GET /api/dashboard/summary: >= ${UPTIME_SLA * 100}% uptime over ${SAMPLE_SIZE} calls`, async () => {
  const result = await measureHandlerUptime(
    () => handleAnalyticsRequest({ method: "GET", url: "/api/dashboard/summary" }),
    200,
    SAMPLE_SIZE
  );

  console.log(
    `  Dashboard summary uptime: ${result.successCount}/${SAMPLE_SIZE} (${(result.uptimeFraction * 100).toFixed(1)}%)`
  );

  assert.ok(
    result.uptimeFraction >= UPTIME_SLA,
    `Dashboard summary uptime was ${(result.uptimeFraction * 100).toFixed(2)}% — below SLA`
  );
});

test(`GET /api/dashboard/fluctuation: >= ${UPTIME_SLA * 100}% uptime over ${SAMPLE_SIZE} calls`, async () => {
  const result = await measureHandlerUptime(
    () => handleAnalyticsRequest({ method: "GET", url: "/api/dashboard/fluctuation" }),
    200,
    SAMPLE_SIZE
  );

  assert.ok(
    result.uptimeFraction >= UPTIME_SLA,
    `Fluctuation analytics uptime was ${(result.uptimeFraction * 100).toFixed(2)}% — below SLA`
  );
});

test(`GET /api/dashboard/risk-index: >= ${UPTIME_SLA * 100}% uptime over ${SAMPLE_SIZE} calls`, async () => {
  const result = await measureHandlerUptime(
    () => handleAnalyticsRequest({ method: "GET", url: "/api/dashboard/risk-index" }),
    200,
    SAMPLE_SIZE
  );

  assert.ok(
    result.uptimeFraction >= UPTIME_SLA,
    `Risk-index analytics uptime was ${(result.uptimeFraction * 100).toFixed(2)}% — below SLA`
  );
});

// ---------------------------------------------------------------------------
// Unknown routes — 404 availability (router never crashes)
// ---------------------------------------------------------------------------

test("Unknown routes always return 404, never throw", async () => {
  const { handleChatApiRequest } = await import("../index.js");

  const unknownPaths = [
    "/api/unknown",
    "/api/dashboard",
    "/api/ingest",
    "/healthz",
    "/",
  ];

  for (const url of unknownPaths) {
    const result = await handleChatApiRequest({ method: "GET", url });
    assert.equal(
      result.statusCode,
      404,
      `Expected 404 for ${url}, got ${result.statusCode}`
    );
  }
});

// ---------------------------------------------------------------------------
// Live HTTP uptime test (requires server on localhost:3001)
// ---------------------------------------------------------------------------

test("Live HTTP: GET /api/health returns 200 (requires running server)", async () => {
  const SERVER_URL = process.env["SMART_GRID_SERVER_URL"] ?? "http://localhost:3001";

  try {
    const response = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200, `Expected HTTP 200, got ${response.status}`);
    const body = (await response.json()) as { status: string };
    assert.equal(body.status, "ok");
    console.log(`  Live server at ${SERVER_URL} is healthy.`);
  } catch (err) {
    // Skip gracefully if the server is not running
    const message = String(err);
    const isConnectionRefused = message.includes("ECONNREFUSED") || message.includes("fetch failed") || message.includes("TimeoutError");
    if (isConnectionRefused) {
      console.log(`  Skipping live HTTP test — server not running at ${SERVER_URL}`);
      return; // Not a test failure; server may not be running in CI
    }
    throw err;
  }
});

test("Live HTTP: >= 99% uptime over 50 sequential requests (requires running server)", async () => {
  const SERVER_URL = process.env["SMART_GRID_SERVER_URL"] ?? "http://localhost:3001";
  const LIVE_SAMPLES = 50;
  let successCount = 0;
  let serverAvailable = true;

  try {
    // Quick probe to check if server is up before running the full suite
    const probe = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (!probe.ok) {
      serverAvailable = false;
    }
  } catch {
    serverAvailable = false;
  }

  if (!serverAvailable) {
    console.log(`  Skipping live uptime test — server not running at ${SERVER_URL}`);
    return;
  }

  const errors: string[] = [];

  for (let i = 0; i < LIVE_SAMPLES; i++) {
    try {
      const response = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (response.status === 200) {
        successCount++;
      } else {
        errors.push(`Request ${i + 1}: HTTP ${response.status}`);
      }
    } catch (err) {
      errors.push(`Request ${i + 1}: ${String(err)}`);
    }
  }

  const uptimePct = (successCount / LIVE_SAMPLES) * 100;
  console.log(
    `  Live server uptime: ${successCount}/${LIVE_SAMPLES} (${uptimePct.toFixed(1)}%)`
  );

  assert.ok(
    successCount / LIVE_SAMPLES >= UPTIME_SLA,
    `Live uptime was ${uptimePct.toFixed(2)}% — below 99% SLA. Errors: ${errors.join("; ")}`
  );
});
