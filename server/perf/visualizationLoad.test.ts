/**
 * Visualization Load Performance Test
 *
 * Validates that all dashboard visualization data can be computed from the
 * full 50 000-row Smart Grid dataset in under 5 seconds.
 *
 * Why not test through the HTTP ingest pipeline?
 * The ingest service deliberately processes one row every 250 ms (a simulation
 * of a streaming pipeline). Waiting for all 50 000 rows would take ~3.5 hours.
 * The meaningful performance question is: once data is in memory, how fast can
 * the analytics layer build the visualization payloads that the frontend renders?
 * This test answers that question directly.
 *
 * The test pipeline mirrors exactly what happens in production:
 *   readFileSync  →  parseFullCsv  →  build*Series / buildSummaryKpis
 *
 * Run:
 *   npm run test:perf
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  buildSummaryKpis,
  buildEnergyDistributionSeries,
  buildFluctuationSeries,
  buildGridLoadSeries,
  buildPowerConsumptionSeries,
  buildRenewableEnergySeries,
  buildRiskIndexSeries,
  buildAssistantContextFromMeasurements,
} from "../analytics/smartGridAnalytics.js";
import type { RawMeasurementRecord } from "../storage/repositories.js";

console.log("\n=== Performance - Visualization Load ===");

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/Smart Grid Data Team 3.csv");

// ---------------------------------------------------------------------------
// CSV parser — mirrors the column mapping in csvIngestService.ts
// ---------------------------------------------------------------------------

function parseFullCsv(): RawMeasurementRecord[] {
  const csvText = readFileSync(CSV_PATH, "utf8");
  const normalized = csvText.replace(/\r/g, "").trim();
  const [headerLine, ...rows] = normalized.split("\n");
  const headers = headerLine.split(",").map((h) => h.trim());
  const col = (name: string) => headers.indexOf(name);

  const num = (c: string[], idx: number) => {
    const parsed = Number(c[idx] ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return rows
    .filter((row) => row.trim().length > 0)
    .map((row, i) => {
      const c = row.split(",").map((v) => v.trim());
      return {
        id: `csv-${i}`,
        ingestionJobId: "viz-load-test-job",
        sourceId: null,
        timestamp: c[col("Timestamp")] ?? "",
        voltage: num(c, col("Voltage (V)")),
        current: num(c, col("Current (A)")),
        powerConsumption: num(c, col("Power Consumption (kW)")),
        reactivePower: num(c, col("Reactive Power (kVAR)")),
        powerFactor: num(c, col("Power Factor")),
        solarPower: num(c, col("Solar Power (kW)")),
        windPower: num(c, col("Wind Power (kW)")),
        gridSupply: num(c, col("Grid Supply (kW)")),
        voltageFluctuation: num(c, col("Voltage Fluctuation (%)")),
        overloadCondition: num(c, col("Overload Condition")),
        transformerFault: num(c, col("Transformer Fault")),
        temperature: num(c, col("Temperature (°C)")),
        humidity: num(c, col("Humidity (%)")),
        electricityPrice: num(c, col("Electricity Price (USD/kWh)")),
        predictedLoad: num(c, col("Predicted Load (kW)")),
        createdAt: new Date().toISOString(),
      };
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOTAL_BUDGET_MS = 5_000; // 5-second SLA for the full pipeline

type TimedResult<T> = { result: T; elapsed: number };

async function timed<T>(fn: () => T): Promise<TimedResult<T>> {
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  return { result, elapsed };
}

// ---------------------------------------------------------------------------
// Phase 1 — CSV parsing (disk read + string processing)
// ---------------------------------------------------------------------------

let records: RawMeasurementRecord[] = [];
let csvParseMs = 0;

test("Phase 1 — CSV disk read + parse: 50 000 rows under 1 500 ms", async () => {
  const { result, elapsed } = await timed(() => parseFullCsv());
  records = result;
  csvParseMs = elapsed;

  console.log(`  CSV parse: ${records.length} rows in ${elapsed.toFixed(1)} ms`);

  assert.equal(records.length, 50_000, `Expected 50 000 rows, got ${records.length}`);
  assert.ok(
    elapsed < 1_500,
    `CSV parse took ${elapsed.toFixed(1)} ms — exceeded 1 500 ms budget`
  );
});

// ---------------------------------------------------------------------------
// Phase 2 — Individual visualization builder timings
// ---------------------------------------------------------------------------

test("Phase 2a — buildSummaryKpis (50 000 rows) under 500 ms", async () => {
  const { result: kpis, elapsed } = await timed(() => buildSummaryKpis(records));

  console.log(`  buildSummaryKpis: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 500, `buildSummaryKpis took ${elapsed.toFixed(1)} ms — exceeded 500 ms`);

  // Sanity-check output
  assert.equal(typeof kpis.renewableShare, "number");
  assert.ok(kpis.renewableShare >= 0 && kpis.renewableShare <= 100);
  assert.equal(typeof kpis.overloadEvents, "number");
  assert.equal(typeof kpis.transformerFaults, "number");
  assert.equal(typeof kpis.latestPrice, "number");
});

test("Phase 2b — buildEnergyDistributionSeries (50 000 rows) under 500 ms", async () => {
  const { result: series, elapsed } = await timed(() => buildEnergyDistributionSeries(records));

  console.log(`  buildEnergyDistributionSeries: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 500, `buildEnergyDistributionSeries took ${elapsed.toFixed(1)} ms — exceeded 500 ms`);

  assert.equal(series.length, 3, "Expected 3 energy sources (Solar, Wind, Grid Supply)");
  const total = series.reduce((sum, s) => sum + s.value, 0);
  assert.ok(Math.abs(total - 100) < 0.1, `Shares summed to ${total.toFixed(2)}%, expected ~100%`);
});

test("Phase 2c — buildPowerConsumptionSeries (50 000 rows) under 100 ms", async () => {
  const { result: series, elapsed } = await timed(() => buildPowerConsumptionSeries(records));

  console.log(`  buildPowerConsumptionSeries: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 100, `buildPowerConsumptionSeries took ${elapsed.toFixed(1)} ms — exceeded 100 ms`);

  // Returns last 24 records
  assert.ok(series.length > 0 && series.length <= 24, `Expected 1–24 points, got ${series.length}`);
  assert.ok(typeof series[0].consumption === "number");
  assert.ok(typeof series[0].forecast === "number");
});

test("Phase 2d — buildRenewableEnergySeries (50 000 rows) under 500 ms", async () => {
  const { result: series, elapsed } = await timed(() => buildRenewableEnergySeries(records));

  console.log(`  buildRenewableEnergySeries: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 500, `buildRenewableEnergySeries took ${elapsed.toFixed(1)} ms — exceeded 500 ms`);

  assert.ok(series.length > 0, "Expected at least one daily bucket");
  assert.ok(typeof series[0].solar === "number");
  assert.ok(typeof series[0].wind === "number");
  assert.ok(typeof series[0].date === "string");
});

test("Phase 2e — buildGridLoadSeries (50 000 rows) under 500 ms", async () => {
  const { result: series, elapsed } = await timed(() => buildGridLoadSeries(records));

  console.log(`  buildGridLoadSeries: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 500, `buildGridLoadSeries took ${elapsed.toFixed(1)} ms — exceeded 500 ms`);

  assert.ok(series.length > 0, "Expected at least one grid-load bucket");
  for (const point of series) {
    assert.ok(point.load >= 0, `Negative load: ${point.load}`);
    assert.ok(point.capacity >= 0, `Negative capacity: ${point.capacity}`);
  }
});

test("Phase 2f — buildFluctuationSeries (50 000 rows) under 500 ms", async () => {
  const { result: series, elapsed } = await timed(() => buildFluctuationSeries(records));

  console.log(`  buildFluctuationSeries: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 500, `buildFluctuationSeries took ${elapsed.toFixed(1)} ms — exceeded 500 ms`);

  assert.ok(series.length > 0, "Expected at least one fluctuation bucket");
  for (const point of series) {
    assert.ok(
      point.fluctuationScore >= 0 && point.fluctuationScore <= 100,
      `fluctuationScore ${point.fluctuationScore} out of [0, 100]`
    );
  }
});

test("Phase 2g — buildRiskIndexSeries (50 000 rows) under 500 ms", async () => {
  const { result: series, elapsed } = await timed(() => buildRiskIndexSeries(records));

  console.log(`  buildRiskIndexSeries: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 500, `buildRiskIndexSeries took ${elapsed.toFixed(1)} ms — exceeded 500 ms`);

  assert.ok(series.length > 0, "Expected at least one risk-index point");
  const validLevels = new Set(["low", "medium", "high"]);
  for (const point of series) {
    assert.ok(validLevels.has(point.riskLevel), `Invalid riskLevel: ${point.riskLevel}`);
    assert.ok(point.riskIndex >= 0 && point.riskIndex <= 100,
      `riskIndex ${point.riskIndex} out of [0, 100]`);
  }
});

// ---------------------------------------------------------------------------
// Phase 3 — Full pipeline (CSV → all visualizations) end-to-end under 5 s
// ---------------------------------------------------------------------------

test("Phase 3 — Full pipeline: parse + all visualizations under 5 000 ms", async () => {
  const pipelineStart = performance.now();

  // Re-parse from disk to measure the real cold-path cost
  const freshRecords = parseFullCsv();

  // Build every visualization payload the dashboard renders
  const kpis = buildSummaryKpis(freshRecords);
  const energyDistribution = buildEnergyDistributionSeries(freshRecords);
  const powerConsumption = buildPowerConsumptionSeries(freshRecords);
  const renewableEnergy = buildRenewableEnergySeries(freshRecords);
  const gridLoad = buildGridLoadSeries(freshRecords);
  const fluctuation = buildFluctuationSeries(freshRecords);
  const riskIndex = buildRiskIndexSeries(freshRecords);

  // buildAssistantContextFromMeasurements composes all of the above plus
  // additional summary metrics — this is the heaviest single call
  const assistantContext = buildAssistantContextFromMeasurements(
    "Smart Grid Data Team 3.csv",
    freshRecords,
    "completed"
  );

  const totalMs = performance.now() - pipelineStart;

  console.log(`\n  === Full Pipeline Summary ===`);
  console.log(`  Rows processed  : ${freshRecords.length.toLocaleString()}`);
  console.log(`  Total wall time : ${totalMs.toFixed(1)} ms`);
  console.log(`  SLA budget      : ${TOTAL_BUDGET_MS} ms`);
  console.log(`  Budget remaining: ${(TOTAL_BUDGET_MS - totalMs).toFixed(1)} ms`);
  console.log(`\n  KPIs computed:`);
  console.log(`    renewableShare   : ${kpis.renewableShare}%`);
  console.log(`    overloadEvents   : ${kpis.overloadEvents}`);
  console.log(`    transformerFaults: ${kpis.transformerFaults}`);
  console.log(`    latestPrice      : $${kpis.latestPrice}`);
  console.log(`\n  Series lengths:`);
  console.log(`    energyDistribution : ${energyDistribution.length} slices`);
  console.log(`    powerConsumption   : ${powerConsumption.length} points`);
  console.log(`    renewableEnergy    : ${renewableEnergy.length} days`);
  console.log(`    gridLoad           : ${gridLoad.length} buckets`);
  console.log(`    fluctuation        : ${fluctuation.length} buckets`);
  console.log(`    riskIndex          : ${riskIndex.length} points`);

  // All series must be non-empty for the dashboard to render
  assert.ok(energyDistribution.length > 0, "energyDistribution series is empty");
  assert.ok(powerConsumption.length > 0, "powerConsumption series is empty");
  assert.ok(renewableEnergy.length > 0, "renewableEnergy series is empty");
  assert.ok(gridLoad.length > 0, "gridLoad series is empty");
  assert.ok(fluctuation.length > 0, "fluctuation series is empty");
  assert.ok(riskIndex.length > 0, "riskIndex series is empty");
  assert.ok(assistantContext.kpis.renewableShare > 0, "assistantContext kpis missing");

  // Primary SLA: entire pipeline under 5 seconds
  assert.ok(
    totalMs < TOTAL_BUDGET_MS,
    `Full pipeline took ${totalMs.toFixed(1)} ms — exceeded ${TOTAL_BUDGET_MS} ms SLA`
  );
});
