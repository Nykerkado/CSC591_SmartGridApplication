import { format, parse } from "date-fns";

export type SmartGridRecord = {
  id: string;
  sequence: number;
  timestamp: string;
  voltage: number;
  current: number;
  powerConsumption: number;
  reactivePower: number;
  powerFactor: number;
  solarPower: number;
  windPower: number;
  gridSupply: number;
  voltageFluctuation: number;
  overloadCondition: number;
  transformerFault: number;
  temperature: number;
  humidity: number;
  electricityPrice: number;
  predictedLoad: number;
};

export type SimulationStatus = "idle" | "running" | "paused" | "completed";

export type SimulationSession = {
  id: "current";
  fileName: string;
  totalRows: number;
  processedCount: number;
  status: SimulationStatus;
  uploadedAt: string;
  sourceCsv: string;
};

export type PowerPoint = {
  time: string;
  timestamp: string;
  consumption: number;
  forecast: number;
  overloadCondition: number;
  transformerFault: number;
};

export type RenewablePoint = {
  date: string;
  solar: number;
  wind: number;
};

export type GridLoadPoint = {
  hour: string;
  timestamp: string;
  load: number;
  capacity: number;
};

export type SourcePoint = {
  name: string;
  value: number;
  color: string;
};

export type FaultEvent = {
  timestamp: string;
  time: string;
  value: number;
};

const TIMESTAMP_FORMAT = "M/d/yyyy H:mm";

const CSV_COLUMN_MAP = {
  timestamp: "Timestamp",
  voltage: "Voltage (V)",
  current: "Current (A)",
  powerConsumption: "Power Consumption (kW)",
  reactivePower: "Reactive Power (kVAR)",
  powerFactor: "Power Factor",
  solarPower: "Solar Power (kW)",
  windPower: "Wind Power (kW)",
  gridSupply: "Grid Supply (kW)",
  voltageFluctuation: "Voltage Fluctuation (%)",
  overloadCondition: "Overload Condition",
  transformerFault: "Transformer Fault",
  temperature: "Temperature (°C)",
  humidity: "Humidity (%)",
  electricityPrice: "Electricity Price (USD/kWh)",
  predictedLoad: "Predicted Load (kW)",
} as const;

const SOURCE_COLORS = {
  Solar: "#fbbf24",
  Wind: "#22d3ee",
  "Grid Supply": "#64748b",
} as const;

function toNumber(value: string | undefined) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitCsvLine(line: string) {
  return line.split(",").map((value) => value.trim());
}

export function parseSmartGridCsv(csvText: string) {
  const normalized = csvText.replace(/\r/g, "").trim();

  if (!normalized) {
    return [];
  }

  const [headerLine, ...rows] = normalized.split("\n");
  const headers = splitCsvLine(headerLine);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return rows
    .filter((row) => row.trim().length > 0)
    .map((row, sequence) => {
      const columns = splitCsvLine(row);
      const rawTimestamp = columns[headerIndex.get(CSV_COLUMN_MAP.timestamp) ?? -1] ?? "";

      return {
        id: `${rawTimestamp}-${sequence}`,
        sequence,
        timestamp: rawTimestamp,
        voltage: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.voltage) ?? -1]),
        current: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.current) ?? -1]),
        powerConsumption: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.powerConsumption) ?? -1]),
        reactivePower: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.reactivePower) ?? -1]),
        powerFactor: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.powerFactor) ?? -1]),
        solarPower: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.solarPower) ?? -1]),
        windPower: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.windPower) ?? -1]),
        gridSupply: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.gridSupply) ?? -1]),
        voltageFluctuation: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.voltageFluctuation) ?? -1]),
        overloadCondition: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.overloadCondition) ?? -1]),
        transformerFault: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.transformerFault) ?? -1]),
        temperature: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.temperature) ?? -1]),
        humidity: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.humidity) ?? -1]),
        electricityPrice: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.electricityPrice) ?? -1]),
        predictedLoad: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.predictedLoad) ?? -1]),
      };
    });
}

function parseTimestamp(timestamp: string) {
  return parse(timestamp, TIMESTAMP_FORMAT, new Date());
}

export function buildPowerConsumptionData(records: SmartGridRecord[]): PowerPoint[] {
  return records.slice(-24).map((record) => ({
    time: format(parseTimestamp(record.timestamp), "HH:mm"),
    timestamp: record.timestamp,
    consumption: Number(record.powerConsumption.toFixed(2)),
    forecast: Number(record.predictedLoad.toFixed(2)),
    overloadCondition: record.overloadCondition,
    transformerFault: record.transformerFault,
  }));
}

export function buildRenewableEnergyData(records: SmartGridRecord[]): RenewablePoint[] {
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

export function buildGridLoadData(records: SmartGridRecord[]): GridLoadPoint[] {
  const recentRecords = records.slice(-32);
  const hourlyTotals = new Map<
    string,
    { hour: string; timestamp: string; load: number; capacity: number; count: number }
  >();

  recentRecords.forEach((record) => {
    const parsedTimestamp = parseTimestamp(record.timestamp);
    const bucketKey = format(parsedTimestamp, "yyyy-MM-dd HH:00");
    const current = hourlyTotals.get(bucketKey) ?? {
      hour: format(parsedTimestamp, "MMM d HH:00"),
      timestamp: record.timestamp,
      load: 0,
      capacity: 0,
      count: 0,
    };

    current.load += record.powerConsumption;
    current.capacity += record.solarPower + record.windPower + record.gridSupply;
    current.count += 1;
    hourlyTotals.set(bucketKey, current);
  });

  return Array.from(hourlyTotals.entries())
    .slice(-8)
    .map(([, totals]) => ({
      hour: totals.hour,
      timestamp: totals.timestamp,
      load: Number((totals.load / totals.count).toFixed(2)),
      capacity: Number((totals.capacity / totals.count).toFixed(2)),
    }));
}

export function buildEnergyDistributionData(records: SmartGridRecord[]): SourcePoint[] {
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
    name,
    color: SOURCE_COLORS[name as keyof typeof SOURCE_COLORS],
    value: totalEnergy === 0 ? 0 : Number(((total / totalEnergy) * 100).toFixed(2)),
  }));
}

export function getSimulationStats(records: SmartGridRecord[]) {
  if (records.length === 0) {
    return {
      renewableShare: 0,
      overloadEvents: 0,
      transformerFaults: 0,
      overloadTimestamps: [] as string[],
      transformerFaultTimestamps: [] as string[],
      latestPrice: 0,
    };
  }

  const totals = records.reduce(
    (accumulator, record) => {
      accumulator.renewables += record.solarPower + record.windPower;
      accumulator.totalSupply += record.solarPower + record.windPower + record.gridSupply;
      accumulator.overloadEvents += record.overloadCondition;
      accumulator.transformerFaults += record.transformerFault;
      if (record.overloadCondition) {
        accumulator.overloadTimestamps.push(record.timestamp);
      }
      if (record.transformerFault) {
        accumulator.transformerFaultTimestamps.push(record.timestamp);
      }
      return accumulator;
    },
    {
      renewables: 0,
      totalSupply: 0,
      overloadEvents: 0,
      transformerFaults: 0,
      overloadTimestamps: [] as string[],
      transformerFaultTimestamps: [] as string[],
    }
  );

  return {
    renewableShare:
      totals.totalSupply === 0
        ? 0
        : Number(((totals.renewables / totals.totalSupply) * 100).toFixed(2)),
    overloadEvents: totals.overloadEvents,
    transformerFaults: totals.transformerFaults,
    overloadTimestamps: totals.overloadTimestamps,
    transformerFaultTimestamps: totals.transformerFaultTimestamps,
    latestPrice: Number(records[records.length - 1].electricityPrice.toFixed(3)),
  };
}
