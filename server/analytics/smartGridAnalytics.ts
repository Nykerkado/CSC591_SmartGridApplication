import { format, parse } from "date-fns";
import type { AssistantContext } from "../../src/shared/chat.js";
import type { RawMeasurementRecord } from "../storage/repositories.js";

const TIMESTAMP_FORMAT = "M/d/yyyy H:mm";
const RISK_WINDOW = 20;

export type SummaryResponse = {
  assistantContext: AssistantContext;
  job: {
    fileName: string | null;
    jobId: string;
    rowsProcessed: number;
    status: string;
  };
  kpis: {
    latestPrice: number;
    overloadEvents: number;
    renewableShare: number;
    transformerFaults: number;
  };
  rawSensorData: {
    latest: {
      current: number;
      humidity: number;
      powerConsumption: number;
      powerFactor: number;
      reactivePower: number;
      temperature: number;
      timestamp: string;
      voltage: number;
    } | null;
    recentMeasurements: Array<{
      current: number;
      humidity: number;
      powerConsumption: number;
      powerFactor: number;
      reactivePower: number;
      temperature: number;
      timestamp: string;
      voltage: number;
    }>;
  };
  series: {
    energyDistribution: Array<{ color: string; name: string; value: number }>;
    fluctuation: Array<{
      avgReactivePower: number;
      avgVoltageFluctuation: number;
      fluctuationScore: number;
      overloadCount: number;
      time: string;
      timestamp: string;
      transformerFaultCount: number;
    }>;
    gridLoad: Array<{ capacity: number; hour: string; load: number; timestamp: string }>;
    powerConsumption: Array<{
      consumption: number;
      forecast: number;
      overloadCondition: number;
      time: string;
      timestamp: string;
      transformerFault: number;
    }>;
    renewableEnergy: Array<{ date: string; solar: number; wind: number }>;
    riskIndex: Array<{
      overloadFrequency: number;
      riskIndex: number;
      riskLevel: "low" | "medium" | "high";
      time: string;
      timestamp: string;
      transformerFaultFrequency: number;
    }>;
  };
};

const SOURCE_COLORS = {
  Solar: "#fbbf24",
  Wind: "#22d3ee",
  "Grid Supply": "#64748b",
} as const;

const HOURLY_BUCKET_LABEL = "MMM d HH:00";

function parseTimestamp(timestamp: string) {
  return parse(timestamp, TIMESTAMP_FORMAT, new Date());
}

function bucketByHour(records: RawMeasurementRecord[]) {
  const buckets = new Map<
    string,
    {
      avgPowerFactorDrop: number;
      avgReactivePower: number;
      avgVoltageFluctuation: number;
      count: number;
      hour: string;
      overloadCount: number;
      timestamp: string;
      transformerFaultCount: number;
    }
  >();

  records.forEach((record) => {
    const parsed = parseTimestamp(record.timestamp);
    const bucketKey = format(parsed, "yyyy-MM-dd HH:00");
    const current = buckets.get(bucketKey) ?? {
      avgPowerFactorDrop: 0,
      avgReactivePower: 0,
      avgVoltageFluctuation: 0,
      count: 0,
      hour: format(parsed, HOURLY_BUCKET_LABEL),
      overloadCount: 0,
      timestamp: record.timestamp,
      transformerFaultCount: 0,
    };

    current.avgPowerFactorDrop += Math.max(0, 1 - record.powerFactor);
    current.avgReactivePower += Math.abs(record.reactivePower);
    current.avgVoltageFluctuation += Math.abs(record.voltageFluctuation);
    current.count += 1;
    current.overloadCount += record.overloadCondition;
    current.transformerFaultCount += record.transformerFault;
    buckets.set(bucketKey, current);
  });

  return Array.from(buckets.values()).map((bucket) => ({
    avgPowerFactorDrop: bucket.count === 0 ? 0 : bucket.avgPowerFactorDrop / bucket.count,
    avgReactivePower: bucket.count === 0 ? 0 : bucket.avgReactivePower / bucket.count,
    avgVoltageFluctuation: bucket.count === 0 ? 0 : bucket.avgVoltageFluctuation / bucket.count,
    count: bucket.count,
    overloadCount: bucket.overloadCount,
    time: bucket.hour,
    timestamp: bucket.timestamp,
    transformerFaultCount: bucket.transformerFaultCount,
  }));
}

function normalize(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return value / max;
}

function getRiskLevel(riskIndex: number): "low" | "medium" | "high" {
  if (riskIndex >= 67) {
    return "high";
  }

  if (riskIndex >= 34) {
    return "medium";
  }

  return "low";
}

export function buildPowerConsumptionSeries(records: RawMeasurementRecord[]) {
  return records.slice(-24).map((record) => ({
    consumption: Number(record.powerConsumption.toFixed(2)),
    forecast: Number(record.predictedLoad.toFixed(2)),
    overloadCondition: record.overloadCondition,
    time: format(parseTimestamp(record.timestamp), "HH:mm"),
    timestamp: record.timestamp,
    transformerFault: record.transformerFault,
  }));
}

export function buildRenewableEnergySeries(records: RawMeasurementRecord[]) {
  const dailyTotals = new Map<string, { solar: number; wind: number }>();

  records.forEach((record) => {
    const day = format(parseTimestamp(record.timestamp), "MMM d");
    const current = dailyTotals.get(day) ?? { solar: 0, wind: 0 };
    current.solar += record.solarPower;
    current.wind += record.windPower;
    dailyTotals.set(day, current);
  });

  return Array.from(dailyTotals.entries())
    .slice(-7)
    .map(([date, totals]) => ({
      date,
      solar: Number(totals.solar.toFixed(2)),
      wind: Number(totals.wind.toFixed(2)),
    }));
}

export function buildGridLoadSeries(records: RawMeasurementRecord[]) {
  const recentRecords = records.slice(-32);
  const hourlyTotals = new Map<
    string,
    { capacity: number; count: number; hour: string; load: number; timestamp: string }
  >();

  recentRecords.forEach((record) => {
    const parsedTimestamp = parseTimestamp(record.timestamp);
    const bucketKey = format(parsedTimestamp, "yyyy-MM-dd HH:00");
    const current = hourlyTotals.get(bucketKey) ?? {
      capacity: 0,
      count: 0,
      hour: format(parsedTimestamp, "MMM d HH:00"),
      load: 0,
      timestamp: record.timestamp,
    };

    current.load += record.powerConsumption;
    current.capacity += record.solarPower + record.windPower + record.gridSupply;
    current.count += 1;
    hourlyTotals.set(bucketKey, current);
  });

  return Array.from(hourlyTotals.values())
    .slice(-8)
    .map((totals) => ({
      capacity: Number((totals.capacity / totals.count).toFixed(2)),
      hour: totals.hour,
      load: Number((totals.load / totals.count).toFixed(2)),
      timestamp: totals.timestamp,
    }));
}

export function buildEnergyDistributionSeries(records: RawMeasurementRecord[]) {
  const totals = {
    Solar: 0,
    Wind: 0,
    "Grid Supply": 0,
  };

  records.forEach((record) => {
    totals.Solar += record.solarPower;
    totals.Wind += record.windPower;
    totals["Grid Supply"] += record.gridSupply;
  });

  const totalEnergy = totals.Solar + totals.Wind + totals["Grid Supply"];

  return Object.entries(totals).map(([name, total]) => ({
    color: SOURCE_COLORS[name as keyof typeof SOURCE_COLORS],
    name,
    value: totalEnergy === 0 ? 0 : Number(((total / totalEnergy) * 100).toFixed(2)),
  }));
}

export function buildFluctuationSeries(records: RawMeasurementRecord[]) {
  const buckets = bucketByHour(records.slice(-32));
  const maxVoltageFluctuation = Math.max(...buckets.map((bucket) => bucket.avgVoltageFluctuation), 0);
  const maxReactivePower = Math.max(...buckets.map((bucket) => bucket.avgReactivePower), 0);
  const maxPowerFactorDrop = Math.max(...buckets.map((bucket) => bucket.avgPowerFactorDrop), 0);

  return buckets.slice(-8).map((bucket) => ({
    avgReactivePower: Number(bucket.avgReactivePower.toFixed(2)),
    avgVoltageFluctuation: Number(bucket.avgVoltageFluctuation.toFixed(2)),
    fluctuationScore: Number(
      (
        (normalize(bucket.avgVoltageFluctuation, maxVoltageFluctuation) * 0.5 +
          normalize(bucket.avgReactivePower, maxReactivePower) * 0.3 +
          normalize(bucket.avgPowerFactorDrop, maxPowerFactorDrop) * 0.2) *
        100
      ).toFixed(1)
    ),
    overloadCount: bucket.overloadCount,
    time: bucket.time,
    timestamp: bucket.timestamp,
    transformerFaultCount: bucket.transformerFaultCount,
  }));
}

export function buildRiskIndexSeries(records: RawMeasurementRecord[]) {
  const fluctuationSeries = buildFluctuationSeries(records);

  return fluctuationSeries.map((bucket) => {
    const overloadFrequency = bucket.overloadCount / Math.max(RISK_WINDOW / 4, 1);
    const transformerFaultFrequency = bucket.transformerFaultCount / Math.max(RISK_WINDOW / 4, 1);
    const normalizedFluctuation = bucket.fluctuationScore / 100;
    const riskIndex = Number(
      (
        (Math.min(overloadFrequency, 1) * 0.45 +
          Math.min(transformerFaultFrequency, 1) * 0.35 +
          normalizedFluctuation * 0.2) *
        100
      ).toFixed(1)
    );

    return {
      overloadFrequency: Number(overloadFrequency.toFixed(2)),
      riskIndex,
      riskLevel: getRiskLevel(riskIndex),
      time: bucket.time,
      timestamp: bucket.timestamp,
      transformerFaultFrequency: Number(transformerFaultFrequency.toFixed(2)),
    };
  });
}

export function buildSummaryKpis(records: RawMeasurementRecord[]) {
  if (records.length === 0) {
    return {
      latestPrice: 0,
      overloadEvents: 0,
      renewableShare: 0,
      transformerFaults: 0,
    };
  }

  const totals = records.reduce(
    (accumulator, record) => {
      accumulator.totalRenewables += record.solarPower + record.windPower;
      accumulator.totalSupply += record.solarPower + record.windPower + record.gridSupply;
      accumulator.overloadEvents += record.overloadCondition;
      accumulator.transformerFaults += record.transformerFault;
      return accumulator;
    },
    { overloadEvents: 0, totalRenewables: 0, totalSupply: 0, transformerFaults: 0 }
  );

  return {
    latestPrice: Number(records[records.length - 1].electricityPrice.toFixed(3)),
    overloadEvents: totals.overloadEvents,
    renewableShare:
      totals.totalSupply === 0
        ? 0
        : Number(((totals.totalRenewables / totals.totalSupply) * 100).toFixed(2)),
    transformerFaults: totals.transformerFaults,
  };
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildRawSensorData(records: RawMeasurementRecord[]) {
  const mapMeasurement = (record: RawMeasurementRecord) => ({
    current: round(record.current),
    humidity: round(record.humidity),
    powerConsumption: round(record.powerConsumption),
    powerFactor: round(record.powerFactor, 3),
    reactivePower: round(record.reactivePower),
    temperature: round(record.temperature),
    timestamp: record.timestamp,
    voltage: round(record.voltage),
  });

  return {
    latest: records.length > 0 ? mapMeasurement(records[records.length - 1]) : null,
    recentMeasurements: records.slice(-8).reverse().map(mapMeasurement),
  };
}

function buildEmptyPoint() {
  return {
    timestamp: null as string | null,
    value: 0,
  };
}

export function buildAssistantContextFromMeasurements(
  fileName: string,
  records: RawMeasurementRecord[],
  status: "idle" | "running" | "paused" | "completed"
): AssistantContext {
  const kpis = buildSummaryKpis(records);
  const powerConsumption = buildPowerConsumptionSeries(records);
  const renewableEnergy = buildRenewableEnergySeries(records);
  const gridLoad = buildGridLoadSeries(records);
  const energyDistribution = buildEnergyDistributionSeries(records);

  if (records.length === 0) {
    return {
      meta: {
        endTimestamp: null,
        fileName,
        latestTimestamp: null,
        processedCount: 0,
        progress: 0,
        startTimestamp: null,
        status,
        totalRows: 0,
      },
      kpis,
      power: {
        averageConsumption: 0,
        forecastGap: {
          averageAbsoluteGap: 0,
          averageSignedGap: 0,
          maximumAbsoluteGap: buildEmptyPoint(),
        },
        maxConsumption: buildEmptyPoint(),
        minConsumption: buildEmptyPoint(),
        peakDemand: buildEmptyPoint(),
      },
      price: {
        average: 0,
        latest: 0,
        max: 0,
        min: 0,
      },
      renewables: {
        bestSolarPeriod: buildEmptyPoint(),
        bestWindPeriod: buildEmptyPoint(),
        solarTotal: 0,
        windTotal: 0,
      },
      grid: {
        averageCapacity: 0,
        averageLoad: 0,
        minimumHeadroom: buildEmptyPoint(),
        peakDemandWindow: {
          capacity: 0,
          headroom: 0,
          load: 0,
          timestamp: null,
        },
      },
      faults: {
        recentOverloadTimestamps: [],
        recentTransformerFaultTimestamps: [],
      },
      series: {
        energyDistribution,
        gridLoad,
        powerConsumption,
        renewableEnergy,
      },
    };
  }

  const summary = records.reduce(
    (accumulator, record) => {
      const load = record.powerConsumption;
      const capacity = record.solarPower + record.windPower + record.gridSupply;
      const headroom = capacity - load;
      const signedGap = record.predictedLoad - record.powerConsumption;
      const absoluteGap = Math.abs(signedGap);

      accumulator.totalConsumption += load;
      accumulator.totalPrice += record.electricityPrice;
      accumulator.totalSolar += record.solarPower;
      accumulator.totalWind += record.windPower;
      accumulator.totalCapacity += capacity;
      accumulator.totalLoad += load;
      accumulator.totalSignedGap += signedGap;
      accumulator.totalAbsoluteGap += absoluteGap;

      if (record.overloadCondition) {
        accumulator.overloadTimestamps.push(record.timestamp);
      }

      if (record.transformerFault) {
        accumulator.transformerFaultTimestamps.push(record.timestamp);
      }

      if (load < accumulator.minConsumption.value) {
        accumulator.minConsumption = { timestamp: record.timestamp, value: load };
      }

      if (load > accumulator.maxConsumption.value) {
        accumulator.maxConsumption = { timestamp: record.timestamp, value: load };
      }

      if (load > accumulator.peakDemand.value) {
        accumulator.peakDemand = { timestamp: record.timestamp, value: load };
        accumulator.peakDemandCapacity = capacity;
      }

      if (record.electricityPrice < accumulator.minPrice) {
        accumulator.minPrice = record.electricityPrice;
      }

      if (record.electricityPrice > accumulator.maxPrice) {
        accumulator.maxPrice = record.electricityPrice;
      }

      if (record.solarPower > accumulator.bestSolarPeriod.value) {
        accumulator.bestSolarPeriod = { timestamp: record.timestamp, value: record.solarPower };
      }

      if (record.windPower > accumulator.bestWindPeriod.value) {
        accumulator.bestWindPeriod = { timestamp: record.timestamp, value: record.windPower };
      }

      if (headroom < accumulator.minimumHeadroom.value) {
        accumulator.minimumHeadroom = { timestamp: record.timestamp, value: headroom };
      }

      if (absoluteGap > accumulator.maximumAbsoluteGap.value) {
        accumulator.maximumAbsoluteGap = { timestamp: record.timestamp, value: absoluteGap };
      }

      return accumulator;
    },
    {
      bestSolarPeriod: buildEmptyPoint(),
      bestWindPeriod: buildEmptyPoint(),
      maxConsumption: buildEmptyPoint(),
      maximumAbsoluteGap: buildEmptyPoint(),
      minConsumption: { timestamp: null as string | null, value: Number.POSITIVE_INFINITY },
      minimumHeadroom: { timestamp: null as string | null, value: Number.POSITIVE_INFINITY },
      maxPrice: Number.NEGATIVE_INFINITY,
      minPrice: Number.POSITIVE_INFINITY,
      overloadTimestamps: [] as string[],
      peakDemand: buildEmptyPoint(),
      peakDemandCapacity: 0,
      totalAbsoluteGap: 0,
      totalCapacity: 0,
      totalConsumption: 0,
      totalLoad: 0,
      totalPrice: 0,
      totalSignedGap: 0,
      totalSolar: 0,
      totalWind: 0,
      transformerFaultTimestamps: [] as string[],
    }
  );

  const latestRecord = records[records.length - 1];
  const totalRows = records.length;

  return {
    meta: {
      endTimestamp: latestRecord.timestamp,
      fileName,
      latestTimestamp: latestRecord.timestamp,
      processedCount: totalRows,
      progress: totalRows === 0 ? 0 : 100,
      startTimestamp: records[0]?.timestamp ?? null,
      status,
      totalRows,
    },
    kpis,
    power: {
      averageConsumption: round(summary.totalConsumption / totalRows),
      forecastGap: {
        averageAbsoluteGap: round(summary.totalAbsoluteGap / totalRows),
        averageSignedGap: round(summary.totalSignedGap / totalRows),
        maximumAbsoluteGap: {
          timestamp: summary.maximumAbsoluteGap.timestamp,
          value: round(summary.maximumAbsoluteGap.value),
        },
      },
      maxConsumption: {
        timestamp: summary.maxConsumption.timestamp,
        value: round(summary.maxConsumption.value),
      },
      minConsumption: {
        timestamp: summary.minConsumption.timestamp,
        value: round(summary.minConsumption.value),
      },
      peakDemand: {
        timestamp: summary.peakDemand.timestamp,
        value: round(summary.peakDemand.value),
      },
    },
    price: {
      average: round(summary.totalPrice / totalRows, 3),
      latest: round(latestRecord.electricityPrice, 3),
      max: round(summary.maxPrice, 3),
      min: round(summary.minPrice, 3),
    },
    renewables: {
      bestSolarPeriod: {
        timestamp: summary.bestSolarPeriod.timestamp,
        value: round(summary.bestSolarPeriod.value),
      },
      bestWindPeriod: {
        timestamp: summary.bestWindPeriod.timestamp,
        value: round(summary.bestWindPeriod.value),
      },
      solarTotal: round(summary.totalSolar),
      windTotal: round(summary.totalWind),
    },
    grid: {
      averageCapacity: round(summary.totalCapacity / totalRows),
      averageLoad: round(summary.totalLoad / totalRows),
      minimumHeadroom: {
        timestamp: summary.minimumHeadroom.timestamp,
        value: round(summary.minimumHeadroom.value),
      },
      peakDemandWindow: {
        capacity: round(summary.peakDemandCapacity),
        headroom: round(summary.peakDemandCapacity - summary.peakDemand.value),
        load: round(summary.peakDemand.value),
        timestamp: summary.peakDemand.timestamp,
      },
    },
    faults: {
      recentOverloadTimestamps: summary.overloadTimestamps.slice(-5),
      recentTransformerFaultTimestamps: summary.transformerFaultTimestamps.slice(-5),
    },
    series: {
      energyDistribution,
      gridLoad,
      powerConsumption,
      renewableEnergy,
    },
  };
}
