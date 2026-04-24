/**
 * HTTP Load Test — autocannon
 *
 * Fires sustained HTTP load against the running Smart Grid API server and
 * reports throughput, latency percentiles, and error rates.
 *
 * Prerequisites:
 *   npm run dev:server        (starts server on port 3001)
 *
 * Usage:
 *   npm run perf:load                          # default profile
 *   LOAD_PROFILE=stress npm run perf:load      # stress profile
 *   LOAD_PROFILE=soak   npm run perf:load      # soak profile
 *
 * Profiles:
 *   default  —  10 connections,  10 s, baseline throughput
 *   stress   —  50 connections,  30 s, peak concurrency
 *   soak     —  10 connections, 120 s, sustained uptime
 *
 * Pass-fail thresholds (checked at the end of each scenario):
 *   - p99 latency  < 500 ms
 *   - error rate   < 1 %
 *   - requests/sec > 50
 */

import autocannon from "autocannon";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SERVER_URL = process.env["SMART_GRID_SERVER_URL"] ?? "http://localhost:3001";

type Profile = { connections: number; duration: number; label: string };

const PROFILES: Record<string, Profile> = {
  default: { connections: 10, duration: 10, label: "Baseline (10 conn / 10 s)" },
  stress: { connections: 50, duration: 30, label: "Stress  (50 conn / 30 s)" },
  soak: { connections: 10, duration: 120, label: "Soak    (10 conn / 120 s)" },
};

const activeProfileKey = process.env["LOAD_PROFILE"] ?? "default";
const profile = PROFILES[activeProfileKey] ?? PROFILES["default"];

// Thresholds
const P99_LATENCY_MS = 500;
const MAX_ERROR_RATE = 0.01; // 1 %
const MIN_RPS = 50;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

type Scenario = {
  title: string;
  method: "GET" | "POST";
  path: string;
  body?: string;
  headers?: Record<string, string>;
};

const SCENARIOS: Scenario[] = [
  {
    title: "GET /api/health",
    method: "GET",
    path: "/api/health",
  },
  {
    title: "GET /api/dashboard/summary",
    method: "GET",
    path: "/api/dashboard/summary",
  },
  {
    title: "GET /api/dashboard/fluctuation",
    method: "GET",
    path: "/api/dashboard/fluctuation",
  },
  {
    title: "GET /api/dashboard/risk-index",
    method: "GET",
    path: "/api/dashboard/risk-index",
  },
  {
    title: "POST /api/ingest/csv (10-row payload)",
    method: "POST",
    path: "/api/ingest/csv",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: "load-test.csv",
      csvText: [
        "Timestamp,Voltage (V),Current (A),Power Consumption (kW),Reactive Power (kVAR)," +
          "Power Factor,Solar Power (kW),Wind Power (kW),Grid Supply (kW),Voltage Fluctuation (%)," +
          "Overload Condition,Transformer Fault,Temperature (°C),Humidity (%)," +
          "Electricity Price (USD/kWh),Predicted Load (kW)",
        ...Array.from(
          { length: 10 },
          (_, i) =>
            `1/1/2024 ${String(i).padStart(2, "0")}:00,232.48,5.12,1.19,0.40,0.91,46.61,26.40,0,1.06,0,0,17.84,64.52,0.416,1.23`
        ),
      ].join("\n"),
    }),
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

type PassResult = { passed: true };
type FailResult = { passed: false; reason: string };

function checkThresholds(
  result: autocannon.Result,
  scenarioTitle: string
): PassResult | FailResult {
  const p99 = result.latency.p99;
  const errors = result.errors + result.timeouts;
  const totalRequests = result.requests.total;
  const errorRate = totalRequests > 0 ? errors / totalRequests : 0;
  const rps = result.requests.average;

  if (p99 > P99_LATENCY_MS) {
    return { passed: false, reason: `p99 latency ${p99} ms exceeds ${P99_LATENCY_MS} ms` };
  }
  if (errorRate > MAX_ERROR_RATE) {
    return {
      passed: false,
      reason: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds ${MAX_ERROR_RATE * 100}%`,
    };
  }
  if (rps < MIN_RPS) {
    return { passed: false, reason: `${rps.toFixed(1)} req/s below minimum ${MIN_RPS} req/s` };
  }
  return { passed: true };
}

function printResult(scenario: Scenario, result: autocannon.Result): void {
  const errors = result.errors + result.timeouts;
  const errorRate =
    result.requests.total > 0 ? (errors / result.requests.total) * 100 : 0;

  console.log(`\n${"-".repeat(60)}`);
  console.log(`Scenario : ${scenario.title}`);
  console.log(`Requests : ${result.requests.total} total, avg ${result.requests.average.toFixed(1)} req/s`);
  console.log(`Latency  : p50=${result.latency.p50} ms  p95=${result.latency.p95} ms  p99=${result.latency.p99} ms  max=${result.latency.max} ms`);
  console.log(`Errors   : ${errors} (${errorRate.toFixed(2)}%)`);
  console.log(`Throughput: ${(result.throughput.average / 1024).toFixed(1)} KB/s`);
}

async function runScenario(scenario: Scenario): Promise<boolean> {
  const instance = autocannon({
    url: `${SERVER_URL}${scenario.path}`,
    connections: profile.connections,
    duration: profile.duration,
    method: scenario.method,
    ...(scenario.body && { body: scenario.body }),
    ...(scenario.headers && { headers: scenario.headers }),
    // Silence the progress bar when not running interactively
    silent: true,
  });

  // Show live progress in the terminal
  autocannon.track(instance, { renderProgressBar: process.stdout.isTTY });

  const result = await instance;

  printResult(scenario, result);

  const check = checkThresholds(result, scenario.title);
  if (check.passed) {
    console.log(`PASS - all thresholds met`);
  } else {
    console.error(`FAIL - ${check.reason}`);
  }

  return check.passed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nSmart Grid API - Load Test`);
  console.log(`Profile  : ${profile.label}`);
  console.log(`Target   : ${SERVER_URL}`);
  console.log(`Thresholds: p99 < ${P99_LATENCY_MS} ms, errors < ${MAX_ERROR_RATE * 100}%, rps > ${MIN_RPS}`);

  // Verify server is reachable before starting
  try {
    const probe = await fetch(`${SERVER_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!probe.ok) {
      console.error(`\nServer health check failed (HTTP ${probe.status}). Is the server running?`);
      process.exit(1);
    }
    console.log(`\nServer is healthy. Starting scenarios...`);
  } catch {
    console.error(
      `\nCannot reach server at ${SERVER_URL}.\nStart it with: npm run dev:server`
    );
    process.exit(1);
  }

  const results: boolean[] = [];

  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario));
  }

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} scenarios`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Load test failed with unexpected error:", err);
  process.exit(1);
});
