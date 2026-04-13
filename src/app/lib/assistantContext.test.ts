import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildAssistantContext } from "./assistantContext";
import { parseSmartGridCsv } from "./smartGrid";

const csvPath = path.resolve(process.cwd(), "data/Smart Grid Data Team 3.csv");
const csvText = readFileSync(csvPath, "utf8");
const allRows = parseSmartGridCsv(csvText);

function assertApprox(actual: number, expected: number, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("buildAssistantContext returns empty analytics for no processed rows", () => {
  const context = buildAssistantContext({
    fileName: "empty.csv",
    processedRows: [],
    status: "idle",
    totalRows: 0,
  });

  assert.equal(context.meta.processedCount, 0);
  assert.equal(context.meta.totalRows, 0);
  assert.equal(context.meta.latestTimestamp, null);
  assert.equal(context.kpis.renewableShare, 0);
  assert.equal(context.series.powerConsumption.length, 0);
});

test("buildAssistantContext computes deterministic load, headroom, and price analytics", () => {
  const partialRows = allRows.slice(0, 12);
  const context = buildAssistantContext({
    fileName: "partial.csv",
    processedRows: partialRows,
    status: "running",
    totalRows: allRows.length,
  });

  const expectedPeak = partialRows.reduce((best, row) =>
    row.powerConsumption > best.powerConsumption ? row : best
  );
  const expectedMinHeadroom = partialRows.reduce((best, row) => {
    const headroom = row.solarPower + row.windPower + row.gridSupply - row.powerConsumption;
    return headroom < best.value ? { value: headroom, timestamp: row.timestamp } : best;
  }, {
    value: Number.POSITIVE_INFINITY,
    timestamp: "",
  });
  const totalPrice = partialRows.reduce((sum, row) => sum + row.electricityPrice, 0);
  const expectedMinPrice = Math.min(...partialRows.map((row) => row.electricityPrice));
  const expectedMaxPrice = Math.max(...partialRows.map((row) => row.electricityPrice));

  assert.equal(context.meta.processedCount, 12);
  assert.equal(context.meta.totalRows, allRows.length);
  assert.equal(context.meta.latestTimestamp, partialRows[partialRows.length - 1].timestamp);
  assertApprox(context.power.peakDemand.value, expectedPeak.powerConsumption);
  assert.equal(context.power.peakDemand.timestamp, expectedPeak.timestamp);
  assertApprox(context.grid.minimumHeadroom.value, expectedMinHeadroom.value);
  assert.equal(context.grid.minimumHeadroom.timestamp, expectedMinHeadroom.timestamp);
  assertApprox(context.price.min, expectedMinPrice, 0.001);
  assertApprox(context.price.max, expectedMaxPrice, 0.001);
  assertApprox(context.price.average, totalPrice / partialRows.length, 0.001);
});

test("buildAssistantContext keeps bounded series and latest values for the completed dataset", () => {
  const context = buildAssistantContext({
    fileName: "full.csv",
    processedRows: allRows,
    status: "completed",
    totalRows: allRows.length,
  });
  const latestRow = allRows[allRows.length - 1];

  assert.equal(context.meta.processedCount, allRows.length);
  assert.equal(context.meta.progress, 100);
  assert.equal(context.meta.latestTimestamp, latestRow.timestamp);
  assertApprox(context.price.latest, latestRow.electricityPrice, 0.001);
  assert.ok(context.series.powerConsumption.length <= 24);
  assert.ok(context.series.renewableEnergy.length <= 7);
  assert.ok(context.series.gridLoad.length <= 8);
  assert.ok(context.series.energyDistribution.length <= 3);
});
