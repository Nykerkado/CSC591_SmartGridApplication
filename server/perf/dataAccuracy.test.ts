/**
 * Data Accuracy Tests
 *
 * Validates that the analytics computation layer produces correct KPI values.
 * Ground-truth values for the full dataset (50 000 rows, data/Smart Grid Data Team 3.csv):
 *
 *   totalSolar    : 1 253 767.84 kW
 *   totalWind     :   750 415.58 kW
 *   totalGrid     :     2 359.90 kW
 *   totalEnergy   : 2 006 543.33 kW
 *   solarShare    :       62.48 %
 *   windShare     :       37.40 %
 *   gridShare     :        0.12 %
 *   renewableShare:       99.88 %
 *   overloadCount :       4 956
 *   transformerFaults:    1 460
 *   lastPrice     :        0.361 USD/kWh
 *
 * Unit-level tests use hand-crafted fixtures derived from the first rows of the
 * CSV so that expected values can be verified independently.
 *
 * Integration-level tests read the actual CSV file and confirm the analytics
 * functions produce values within acceptable tolerance of the ground truth.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  buildSummaryKpis,
  buildEnergyDistributionSeries,
  buildFluctuationSeries,
  buildRiskIndexSeries,
  buildPowerConsumptionSeries,
  buildRenewableEnergySeries,
  buildGridLoadSeries,
} from "../analytics/smartGridAnalytics.js";
import type { RawMeasurementRecord } from "../storage/repositories.js";

console.log("\n=== Accuracy - Data Validation ===");

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/Smart Grid Data Team 3.csv");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Builds a RawMeasurementRecord from partial fields.
 * Defaults match the first CSV row (1/1/2024 0:00).
 */
function makeRecord(
  overrides: Partial<RawMeasurementRecord> = {},
  index = 0
): RawMeasurementRecord {
  return {
    id: `rec-${index}`,
    ingestionJobId: "job-fixture",
    sourceId: null,
    timestamp: "1/1/2024 0:00",
    voltage: 232.4835708,
    current: 5.124672741,
    powerConsumption: 1.191402218,
    reactivePower: 0.399029154,
    powerFactor: 0.907765528,
    solarPower: 46.61484531,
    windPower: 26.39956605,
    gridSupply: 0,
    voltageFluctuation: 1.055937052,
    overloadCondition: 0,
    transformerFault: 0,
    temperature: 17.84276706,
    humidity: 64.52335267,
    electricityPrice: 0.416156411,
    predictedLoad: 1.233158422,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * First four CSV rows as RawMeasurementRecord fixtures.
 * Used for deterministic unit assertions.
 */
const FOUR_ROW_FIXTURE: RawMeasurementRecord[] = [
  makeRecord({ id: "r0", timestamp: "1/1/2024 0:00", solarPower: 46.61484531, windPower: 26.39956605, gridSupply: 0, overloadCondition: 0, transformerFault: 0, electricityPrice: 0.416156411, powerConsumption: 1.191402218, predictedLoad: 1.233158422 }, 0),
  makeRecord({ id: "r1", timestamp: "1/1/2024 0:15", solarPower: 6.907169503, windPower: 18.55501127, gridSupply: 0, overloadCondition: 1, transformerFault: 0, electricityPrice: 0.492334365, powerConsumption: 5.093752614, predictedLoad: 5.24782424 }, 1),
  makeRecord({ id: "r2", timestamp: "1/1/2024 0:30", solarPower: 15.47763994, windPower: 12.90502503, gridSupply: 0, overloadCondition: 0, transformerFault: 0, electricityPrice: 0.427784995, powerConsumption: 10.75980649, predictedLoad: 10.5802783 }, 2),
  makeRecord({ id: "r3", timestamp: "1/1/2024 0:45", solarPower: 35.74639831, windPower: 28.93712894, gridSupply: 0, overloadCondition: 0, transformerFault: 0, electricityPrice: 0.487953058, powerConsumption: 11.32211752, predictedLoad: 11.22594596 }, 3),
];

// Pre-computed ground truth for FOUR_ROW_FIXTURE:
// totalSolar  = 46.61484531 + 6.907169503 + 15.47763994 + 35.74639831 = 104.74605306
// totalWind   = 26.39956605 + 18.55501127 + 12.90502503 + 28.93712894 =  86.79673129
// totalGrid   = 0
// totalEnergy = 191.54278435
// renewableShare = 100.00 % (all sources are renewable)
// latestPrice (toFixed 3) = "0.488"
// overloadEvents = 1
// transformerFaults = 0

// ---------------------------------------------------------------------------
// Unit tests — buildSummaryKpis
// ---------------------------------------------------------------------------

test("buildSummaryKpis: empty records returns all-zero KPIs", () => {
  const kpis = buildSummaryKpis([]);
  assert.equal(kpis.renewableShare, 0);
  assert.equal(kpis.overloadEvents, 0);
  assert.equal(kpis.transformerFaults, 0);
  assert.equal(kpis.latestPrice, 0);
});

test("buildSummaryKpis: single record with known values", () => {
  const record = makeRecord({
    solarPower: 50,
    windPower: 0,
    gridSupply: 50,
    overloadCondition: 1,
    transformerFault: 1,
    electricityPrice: 0.4567,
  });
  const kpis = buildSummaryKpis([record]);

  // renewableShare = 50 / 100 * 100 = 50.00 %
  assert.equal(kpis.renewableShare, 50);
  assert.equal(kpis.overloadEvents, 1);
  assert.equal(kpis.transformerFaults, 1);
  // toFixed(3) of 0.4567 = "0.457"
  assert.equal(kpis.latestPrice, 0.457);
});

test("buildSummaryKpis: four-row fixture matches pre-computed values", () => {
  const kpis = buildSummaryKpis(FOUR_ROW_FIXTURE);

  assert.equal(kpis.renewableShare, 100);
  assert.equal(kpis.overloadEvents, 1);
  assert.equal(kpis.transformerFaults, 0);
  assert.equal(kpis.latestPrice, 0.488);
});

test("buildSummaryKpis: pure-grid supply yields 0% renewable share", () => {
  const records = [
    makeRecord({ solarPower: 0, windPower: 0, gridSupply: 100, electricityPrice: 0.5 }),
  ];
  const kpis = buildSummaryKpis(records);
  assert.equal(kpis.renewableShare, 0);
});

// ---------------------------------------------------------------------------
// Unit tests — buildEnergyDistributionSeries
// ---------------------------------------------------------------------------

test("buildEnergyDistributionSeries: shares sum to 100%", () => {
  const series = buildEnergyDistributionSeries(FOUR_ROW_FIXTURE);
  const total = series.reduce((sum, s) => sum + s.value, 0);
  // Allow floating-point rounding up to 0.1 %
  assert.ok(
    Math.abs(total - 100) < 0.1,
    `Energy distribution shares summed to ${total.toFixed(4)} %, expected ~100 %`
  );
});

test("buildEnergyDistributionSeries: solar share is highest in four-row fixture", () => {
  const series = buildEnergyDistributionSeries(FOUR_ROW_FIXTURE);
  const solar = series.find((s) => s.name === "Solar");
  const wind = series.find((s) => s.name === "Wind");
  const grid = series.find((s) => s.name === "Grid Supply");

  assert.ok(solar, "Solar entry missing");
  assert.ok(wind, "Wind entry missing");
  assert.ok(grid, "Grid Supply entry missing");
  assert.ok(solar!.value > wind!.value, "Solar should be higher than wind");
  assert.equal(grid!.value, 0);
});

test("buildEnergyDistributionSeries: correct solar percentage in four-row fixture", () => {
  const series = buildEnergyDistributionSeries(FOUR_ROW_FIXTURE);
  const solar = series.find((s) => s.name === "Solar")!;

  // totalSolar / totalEnergy * 100
  // = 104.74605306 / 191.54278435 * 100 ≈ 54.68 %
  const expectedSolarShare = (104.74605306 / 191.54278435) * 100;
  assert.ok(
    Math.abs(solar.value - expectedSolarShare) < 0.01,
    `Solar share was ${solar.value.toFixed(4)} %, expected ~${expectedSolarShare.toFixed(4)} %`
  );
});

test("buildEnergyDistributionSeries: zero-supply records produce all-zero shares", () => {
  const records = [makeRecord({ solarPower: 0, windPower: 0, gridSupply: 0 })];
  const series = buildEnergyDistributionSeries(records);
  series.forEach((s) => assert.equal(s.value, 0));
});

// ---------------------------------------------------------------------------
// Unit tests — buildPowerConsumptionSeries
// ---------------------------------------------------------------------------

test("buildPowerConsumptionSeries: output length capped at 24 for large input", () => {
  const records = Array.from({ length: 50 }, (_, i) =>
    makeRecord({ id: `r${i}`, timestamp: `1/1/2024 ${String(i % 24).padStart(2, "0")}:00` }, i)
  );
  const series = buildPowerConsumptionSeries(records);
  assert.ok(series.length <= 24, `Expected <= 24 points, got ${series.length}`);
});

test("buildPowerConsumptionSeries: consumption values match fixture records", () => {
  const series = buildPowerConsumptionSeries(FOUR_ROW_FIXTURE);
  assert.equal(series.length, 4);
  assert.equal(series[0].consumption, 1.19);
  assert.equal(series[1].consumption, 5.09);
  assert.equal(series[2].consumption, 10.76);
  assert.equal(series[3].consumption, 11.32);
});

// ---------------------------------------------------------------------------
// Unit tests — buildRenewableEnergySeries
// ---------------------------------------------------------------------------

test("buildRenewableEnergySeries: groups all four fixture rows into one daily bucket", () => {
  const series = buildRenewableEnergySeries(FOUR_ROW_FIXTURE);
  // All timestamps are on 1/1/2024, so there should be exactly one daily bucket
  assert.equal(series.length, 1);
  assert.equal(series[0].date, "Jan 1");
});

test("buildRenewableEnergySeries: daily solar total matches sum of fixture", () => {
  const series = buildRenewableEnergySeries(FOUR_ROW_FIXTURE);
  const expectedSolar = 46.61484531 + 6.907169503 + 15.47763994 + 35.74639831;
  assert.ok(
    Math.abs(series[0].solar - Number(expectedSolar.toFixed(2))) < 0.01,
    `Solar total was ${series[0].solar}, expected ~${expectedSolar.toFixed(2)}`
  );
});

// ---------------------------------------------------------------------------
// Unit tests — buildFluctuationSeries and buildRiskIndexSeries
// ---------------------------------------------------------------------------

test("buildFluctuationSeries: fluctuationScore is between 0 and 100", () => {
  const series = buildFluctuationSeries(FOUR_ROW_FIXTURE);
  for (const point of series) {
    assert.ok(point.fluctuationScore >= 0 && point.fluctuationScore <= 100,
      `fluctuationScore ${point.fluctuationScore} is out of [0, 100] range`);
  }
});

test("buildRiskIndexSeries: riskLevel is one of low/medium/high", () => {
  const series = buildRiskIndexSeries(FOUR_ROW_FIXTURE);
  const validLevels = new Set(["low", "medium", "high"]);
  for (const point of series) {
    assert.ok(validLevels.has(point.riskLevel), `Unexpected riskLevel: ${point.riskLevel}`);
  }
});

test("buildGridLoadSeries: load and capacity are non-negative", () => {
  const series = buildGridLoadSeries(FOUR_ROW_FIXTURE);
  for (const point of series) {
    assert.ok(point.load >= 0, `Negative load: ${point.load}`);
    assert.ok(point.capacity >= 0, `Negative capacity: ${point.capacity}`);
  }
});

// ---------------------------------------------------------------------------
// Integration test — full CSV dataset accuracy
// ---------------------------------------------------------------------------

/**
 * Parses the real CSV file into RawMeasurementRecord[] using the same column
 * mapping as csvIngestService so the test exercises the actual data pipeline.
 */
function parseFullCsv(): RawMeasurementRecord[] {
  const csvText = readFileSync(CSV_PATH, "utf8");
  const normalized = csvText.replace(/\r/g, "").trim();
  const [headerLine, ...rows] = normalized.split("\n");
  const headers = headerLine.split(",").map((h) => h.trim());
  const col = (name: string) => headers.indexOf(name);

  return rows
    .filter((row) => row.trim().length > 0)
    .map((row, i) => {
      const c = row.split(",").map((v) => v.trim());
      const num = (idx: number) => {
        const parsed = Number(c[idx] ?? "0");
        return Number.isFinite(parsed) ? parsed : 0;
      };

      return {
        id: `csv-${i}`,
        ingestionJobId: "full-csv-job",
        sourceId: null,
        timestamp: c[col("Timestamp")] ?? "",
        voltage: num(col("Voltage (V)")),
        current: num(col("Current (A)")),
        powerConsumption: num(col("Power Consumption (kW)")),
        reactivePower: num(col("Reactive Power (kVAR)")),
        powerFactor: num(col("Power Factor")),
        solarPower: num(col("Solar Power (kW)")),
        windPower: num(col("Wind Power (kW)")),
        gridSupply: num(col("Grid Supply (kW)")),
        voltageFluctuation: num(col("Voltage Fluctuation (%)")),
        overloadCondition: num(col("Overload Condition")),
        transformerFault: num(col("Transformer Fault")),
        temperature: num(col("Temperature (°C)")),
        humidity: num(col("Humidity (%)")),
        electricityPrice: num(col("Electricity Price (USD/kWh)")),
        predictedLoad: num(col("Predicted Load (kW)")),
        createdAt: new Date().toISOString(),
      };
    });
}

test("Full CSV: row count is exactly 50 000", () => {
  const records = parseFullCsv();
  assert.equal(records.length, 50_000, `Expected 50 000 rows, got ${records.length}`);
});

test("Full CSV: renewableShare is within ±0.01% of ground truth (99.88%)", () => {
  const records = parseFullCsv();
  const kpis = buildSummaryKpis(records);
  const expected = 99.88;
  assert.ok(
    Math.abs(kpis.renewableShare - expected) <= 0.01,
    `renewableShare was ${kpis.renewableShare.toFixed(4)} %, expected ~${expected} %`
  );
});

test("Full CSV: overloadEvents matches ground truth (4 956)", () => {
  const records = parseFullCsv();
  const kpis = buildSummaryKpis(records);
  assert.equal(kpis.overloadEvents, 4_956);
});

test("Full CSV: transformerFaults matches ground truth (1 460)", () => {
  const records = parseFullCsv();
  const kpis = buildSummaryKpis(records);
  assert.equal(kpis.transformerFaults, 1_460);
});

test("Full CSV: energy distribution solar share is within ±0.01% of ground truth (62.48%)", () => {
  const records = parseFullCsv();
  const series = buildEnergyDistributionSeries(records);
  const solar = series.find((s) => s.name === "Solar")!;
  const expected = 62.48;
  assert.ok(
    Math.abs(solar.value - expected) <= 0.01,
    `Solar distribution share was ${solar.value.toFixed(4)} %, expected ~${expected} %`
  );
});

test("Full CSV: energy distribution wind share is within ±0.01% of ground truth (37.40%)", () => {
  const records = parseFullCsv();
  const series = buildEnergyDistributionSeries(records);
  const wind = series.find((s) => s.name === "Wind")!;
  const expected = 37.40;
  assert.ok(
    Math.abs(wind.value - expected) <= 0.01,
    `Wind distribution share was ${wind.value.toFixed(4)} %, expected ~${expected} %`
  );
});

test("Full CSV: energy distribution shares sum to 100%", () => {
  const records = parseFullCsv();
  const series = buildEnergyDistributionSeries(records);
  const total = series.reduce((sum, s) => sum + s.value, 0);
  assert.ok(
    Math.abs(total - 100) < 0.1,
    `Distribution shares summed to ${total.toFixed(4)} %, expected ~100 %`
  );
});
