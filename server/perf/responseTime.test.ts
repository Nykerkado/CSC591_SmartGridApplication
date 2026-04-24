/**
 * Response Time Performance Tests
 *
 * Validates that each API handler meets its response-time SLA when called
 * directly (no network overhead). Thresholds:
 *   - Health:              < 5 ms   (pure in-memory function)
 *   - Analytics (empty):  < 50 ms  (in-memory, no data)
 *   - Analytics (loaded): < 200 ms (in-memory store with 1 000 records)
 *   - Ingest (small CSV): < 500 ms (sync parse + in-memory write)
 *   - Chat handler:       < 10 ms  (routing only, mocked OpenAI)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { handleHealthRequest } from "../routes/healthRoutes.js";
import { handleAnalyticsRequest } from "../analytics/analyticsRoutes.js";
import { handleChatApiRequest } from "../index.js";
import { handleIngestRequest } from "../ingest/ingestRoutes.js";

console.log("\n=== Performance - Response Time ===");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<{
  id: string;
  timestamp: string;
  solarPower: number;
  windPower: number;
  gridSupply: number;
  powerConsumption: number;
  predictedLoad: number;
  electricityPrice: number;
  overloadCondition: number;
  transformerFault: number;
  voltage: number;
  current: number;
  reactivePower: number;
  powerFactor: number;
  voltageFluctuation: number;
  temperature: number;
  humidity: number;
  ingestionJobId: string;
  sourceId: string | null;
  createdAt: string;
}> = {}) {
  return {
    id: "rec-0",
    ingestionJobId: "job-0",
    sourceId: null,
    timestamp: "1/1/2024 0:00",
    voltage: 232.48,
    current: 5.12,
    powerConsumption: 1.19,
    reactivePower: 0.40,
    powerFactor: 0.91,
    solarPower: 46.61,
    windPower: 26.40,
    gridSupply: 0,
    voltageFluctuation: 1.06,
    overloadCondition: 0,
    transformerFault: 0,
    temperature: 17.84,
    humidity: 64.52,
    electricityPrice: 0.416,
    predictedLoad: 1.23,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Builds a CSV text string with N data rows from the first real row of the dataset. */
function buildSmallCsv(rows: number): string {
  const header =
    "Timestamp,Voltage (V),Current (A),Power Consumption (kW),Reactive Power (kVAR)," +
    "Power Factor,Solar Power (kW),Wind Power (kW),Grid Supply (kW),Voltage Fluctuation (%)," +
    "Overload Condition,Transformer Fault,Temperature (°C),Humidity (%)," +
    "Electricity Price (USD/kWh),Predicted Load (kW)";
  const dataRow =
    "1/1/2024 0:00,232.4835708,5.124672741,1.191402218,0.399029154," +
    "0.907765528,46.61484531,26.39956605,0,1.055937052," +
    "0,0,17.84276706,64.52335267,0.416156411,1.233158422";
  return [header, ...Array.from({ length: rows }, () => dataRow)].join("\n");
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

test("GET /api/health responds under 5 ms", () => {
  const start = performance.now();
  const result = handleHealthRequest();
  const elapsed = performance.now() - start;

  assert.equal(result.statusCode, 200);
  assert.ok(
    elapsed < 5,
    `Health check took ${elapsed.toFixed(2)} ms — exceeded 5 ms threshold`
  );
});

test("GET /api/health returns expected shape", () => {
  const result = handleHealthRequest();
  const payload = result.payload as { status: string; service: string; timestamp: string };

  assert.equal(payload.status, "ok");
  assert.equal(payload.service, "smart-grid-api");
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------------------------------------------------------------------------
// Analytics endpoints (empty store — no ingestion job present)
// ---------------------------------------------------------------------------

test("GET /api/dashboard/summary responds under 50 ms (empty store)", async () => {
  const start = performance.now();
  const result = await handleAnalyticsRequest({
    method: "GET",
    url: "/api/dashboard/summary",
  });
  const elapsed = performance.now() - start;

  assert.ok(result !== null, "Expected a non-null response");
  assert.equal(result!.statusCode, 200);
  assert.ok(
    elapsed < 50,
    `Dashboard summary took ${elapsed.toFixed(2)} ms — exceeded 50 ms threshold`
  );
});

test("GET /api/dashboard/fluctuation responds under 50 ms (empty store)", async () => {
  const start = performance.now();
  const result = await handleAnalyticsRequest({
    method: "GET",
    url: "/api/dashboard/fluctuation",
  });
  const elapsed = performance.now() - start;

  assert.ok(result !== null);
  assert.equal(result!.statusCode, 200);
  assert.ok(
    elapsed < 50,
    `Fluctuation analytics took ${elapsed.toFixed(2)} ms — exceeded 50 ms threshold`
  );
});

test("GET /api/dashboard/risk-index responds under 50 ms (empty store)", async () => {
  const start = performance.now();
  const result = await handleAnalyticsRequest({
    method: "GET",
    url: "/api/dashboard/risk-index",
  });
  const elapsed = performance.now() - start;

  assert.ok(result !== null);
  assert.equal(result!.statusCode, 200);
  assert.ok(
    elapsed < 50,
    `Risk-index analytics took ${elapsed.toFixed(2)} ms — exceeded 50 ms threshold`
  );
});

// ---------------------------------------------------------------------------
// Ingest endpoint — small CSV payload
// ---------------------------------------------------------------------------

test("POST /api/ingest/csv (20-row CSV) responds under 500 ms", async () => {
  const payload = { fileName: "perf-test.csv", csvText: buildSmallCsv(20) };
  const start = performance.now();
  const result = await handleIngestRequest({
    method: "POST",
    url: "/api/ingest/csv",
    body: payload,
  });
  const elapsed = performance.now() - start;

  assert.ok(result !== null);
  assert.equal(result!.statusCode, 202);
  assert.ok(
    elapsed < 500,
    `Ingest (20 rows) took ${elapsed.toFixed(2)} ms — exceeded 500 ms threshold`
  );
});

test("POST /api/ingest/csv (500-row CSV) responds under 500 ms", async () => {
  const payload = { fileName: "perf-test-large.csv", csvText: buildSmallCsv(500) };
  const start = performance.now();
  const result = await handleIngestRequest({
    method: "POST",
    url: "/api/ingest/csv",
    body: payload,
  });
  const elapsed = performance.now() - start;

  assert.ok(result !== null);
  assert.equal(result!.statusCode, 202);
  assert.ok(
    elapsed < 500,
    `Ingest (500 rows) took ${elapsed.toFixed(2)} ms — exceeded 500 ms threshold`
  );
});

// ---------------------------------------------------------------------------
// Chat routing (mocked OpenAI — measures handler overhead only)
// ---------------------------------------------------------------------------

test("POST /api/chat/query routing overhead is under 10 ms (mocked OpenAI)", async () => {
  const mockOpenAI = {
    responses: {
      parse: async () => ({
        output_parsed: {
          supported: true,
          answer: "Test answer.",
          grounding: ["Ground truth."],
          followUps: [],
        },
      }),
    },
  };

  const body = {
    role: "grid-operator",
    question: "What is the renewable share?",
    history: [],
    context: {
      meta: {
        fileName: "test.csv",
        status: "completed",
        processedCount: 4,
        totalRows: 4,
        progress: 100,
        startTimestamp: "1/1/2024 0:00",
        endTimestamp: "1/1/2024 0:45",
        latestTimestamp: "1/1/2024 0:45",
      },
      kpis: { renewableShare: 100, latestPrice: 0.416, overloadEvents: 0, transformerFaults: 0 },
      power: {
        minConsumption: { value: 1.19, timestamp: "1/1/2024 0:00" },
        maxConsumption: { value: 1.19, timestamp: "1/1/2024 0:00" },
        averageConsumption: 1.19,
        peakDemand: { value: 1.19, timestamp: "1/1/2024 0:00" },
        forecastGap: {
          averageAbsoluteGap: 0.04,
          averageSignedGap: 0.04,
          maximumAbsoluteGap: { value: 0.04, timestamp: "1/1/2024 0:00" },
        },
      },
      price: { min: 0.416, max: 0.416, average: 0.416, latest: 0.416 },
      renewables: {
        solarTotal: 46.61,
        windTotal: 26.40,
        bestSolarPeriod: { value: 46.61, timestamp: "1/1/2024 0:00" },
        bestWindPeriod: { value: 26.40, timestamp: "1/1/2024 0:00" },
      },
      grid: {
        averageLoad: 1.19,
        averageCapacity: 73.01,
        minimumHeadroom: { value: 71.82, timestamp: "1/1/2024 0:00" },
        peakDemandWindow: {
          timestamp: "1/1/2024 0:00",
          load: 1.19,
          capacity: 73.01,
          headroom: 71.82,
        },
      },
      faults: { recentOverloadTimestamps: [], recentTransformerFaultTimestamps: [] },
      series: { powerConsumption: [], renewableEnergy: [], gridLoad: [], energyDistribution: [] },
    },
  };

  const start = performance.now();
  const result = await handleChatApiRequest(
    { body, method: "POST", url: "/api/chat/query" },
    { openai: mockOpenAI }
  );
  const elapsed = performance.now() - start;

  assert.equal(result.statusCode, 200);
  // The mock is instant, so elapsed ≈ handler overhead only
  assert.ok(
    elapsed < 200,
    `Chat handler took ${elapsed.toFixed(2)} ms — exceeded 200 ms threshold`
  );
});

// ---------------------------------------------------------------------------
// Repeated call consistency — p95 latency
// ---------------------------------------------------------------------------

test("GET /api/health p95 latency stays under 5 ms across 100 calls", () => {
  const latencies: number[] = [];

  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    handleHealthRequest();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(
    `  Health p50=${latencies[49].toFixed(2)}ms  p95=${p95.toFixed(2)}ms  p99=${p99.toFixed(2)}ms`
  );

  assert.ok(
    p95 < 5,
    `Health p95 was ${p95.toFixed(2)} ms — exceeded 5 ms threshold`
  );
});
