import type { StorageRepository } from "../storage/repositories.js";
import type { CsvIngestRequest, SensorIngestRequest } from "./ingestSchemas.js";

export type IngestServiceDependencies = {
  repository: StorageRepository;
};

export type IngestResult = {
  jobId: string;
  status: "accepted";
  message: string;
  nextSteps: string[];
};

type ParsedMeasurement = Omit<
  Parameters<StorageRepository["saveRawMeasurements"]>[1][number],
  "createdAt" | "ingestionJobId" | "sourceId"
>;

const CSV_COLUMN_MAP = {
  current: "Current (A)",
  electricityPrice: "Electricity Price (USD/kWh)",
  gridSupply: "Grid Supply (kW)",
  humidity: "Humidity (%)",
  overloadCondition: "Overload Condition",
  powerConsumption: "Power Consumption (kW)",
  powerFactor: "Power Factor",
  predictedLoad: "Predicted Load (kW)",
  reactivePower: "Reactive Power (kVAR)",
  solarPower: "Solar Power (kW)",
  temperature: "Temperature (°C)",
  timestamp: "Timestamp",
  transformerFault: "Transformer Fault",
  voltage: "Voltage (V)",
  voltageFluctuation: "Voltage Fluctuation (%)",
  windPower: "Wind Power (kW)",
} as const;

function splitCsvLine(line: string) {
  return line.split(",").map((value) => value.trim());
}

function toNumber(value: string | undefined) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSmartGridCsv(csvText: string): ParsedMeasurement[] {
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
        current: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.current) ?? -1]),
        electricityPrice: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.electricityPrice) ?? -1]),
        gridSupply: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.gridSupply) ?? -1]),
        humidity: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.humidity) ?? -1]),
        id: `${rawTimestamp}-${sequence}`,
        overloadCondition: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.overloadCondition) ?? -1]),
        powerConsumption: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.powerConsumption) ?? -1]),
        powerFactor: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.powerFactor) ?? -1]),
        predictedLoad: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.predictedLoad) ?? -1]),
        reactivePower: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.reactivePower) ?? -1]),
        temperature: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.temperature) ?? -1]),
        timestamp: rawTimestamp,
        transformerFault: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.transformerFault) ?? -1]),
        voltage: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.voltage) ?? -1]),
        voltageFluctuation: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.voltageFluctuation) ?? -1]),
        windPower: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.windPower) ?? -1]),
        solarPower: toNumber(columns[headerIndex.get(CSV_COLUMN_MAP.solarPower) ?? -1]),
      };
    });
}

function buildAcceptedResult(jobId: string, message: string): IngestResult {
  return {
    jobId,
    status: "accepted",
    message,
    nextSteps: [
      `Poll GET /api/jobs/${jobId} for ingestion progress.`,
      "Use the dashboard analytics endpoints after processing completes.",
    ],
  };
}

const PROCESSING_INTERVAL_MS = 250;
const processingJobs = new Map<string, ReturnType<typeof setInterval>>();

async function startProcessingJob(
  jobId: string,
  request: { fileName: string },
  dependencies: IngestServiceDependencies
) {
  if (processingJobs.has(jobId)) {
    return;
  }

  const timer = setInterval(async () => {
    const [job, rawRows, processedRows] = await Promise.all([
      dependencies.repository.getJob(jobId),
      dependencies.repository.getRawMeasurementsByJob(jobId),
      dependencies.repository.getProcessedMeasurementsByJob(jobId),
    ]);

    if (!job) {
      clearInterval(timer);
      processingJobs.delete(jobId);
      return;
    }

    const nextRow = rawRows[processedRows.length];

    if (!nextRow) {
      await dependencies.repository.saveJob({
        ...job,
        completedAt: new Date().toISOString(),
        errorMessage: null,
        fileName: request.fileName,
        rowsProcessed: processedRows.length,
        status: "completed",
      });
      clearInterval(timer);
      processingJobs.delete(jobId);
      return;
    }

    await dependencies.repository.appendProcessedMeasurements([nextRow]);
    await dependencies.repository.saveJob({
      ...job,
      fileName: request.fileName,
      rowsProcessed: processedRows.length + 1,
      status: processedRows.length + 1 >= rawRows.length ? "completed" : "processing",
      completedAt:
        processedRows.length + 1 >= rawRows.length ? new Date().toISOString() : null,
    });

    if (processedRows.length + 1 >= rawRows.length) {
      clearInterval(timer);
      processingJobs.delete(jobId);
    }
  }, PROCESSING_INTERVAL_MS);

  processingJobs.set(jobId, timer);
}

export async function ingestCsv(
  request: CsvIngestRequest,
  dependencies: IngestServiceDependencies
): Promise<IngestResult> {
  const jobId = crypto.randomUUID();
  const parsedRows = parseSmartGridCsv(request.csvText);
  const startedAt = new Date().toISOString();

  await dependencies.repository.saveJob({
    id: jobId,
    sourceType: "csv",
    fileName: request.fileName,
    status: "uploaded",
    rowsReceived: parsedRows.length,
    rowsProcessed: 0,
    startedAt,
    completedAt: null,
    errorMessage: null,
  });

  if (parsedRows.length === 0) {
    await dependencies.repository.saveJob({
      id: jobId,
      sourceType: "csv",
      fileName: request.fileName,
      status: "failed",
      rowsReceived: 0,
      rowsProcessed: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      errorMessage: "The uploaded CSV did not contain any data rows.",
    });

    return buildAcceptedResult(
      jobId,
      "CSV ingestion was accepted, but the backend found no data rows to process."
    );
  }

  await dependencies.repository.saveRawMeasurements(
    jobId,
    parsedRows.map((record) => ({
      ...record,
      createdAt: new Date().toISOString(),
      ingestionJobId: jobId,
      sourceId: request.fileName,
    }))
  );

  await dependencies.repository.saveJob({
    id: jobId,
    sourceType: "csv",
    fileName: request.fileName,
    status: "processing",
    rowsReceived: parsedRows.length,
    rowsProcessed: 0,
    startedAt,
    completedAt: null,
    errorMessage: null,
  });

  await startProcessingJob(jobId, request, dependencies);

  return buildAcceptedResult(
    jobId,
    "CSV ingestion has been accepted. The backend is now processing rows incrementally for dashboard analytics."
  );
}

export async function ingestSensorBatch(
  request: SensorIngestRequest,
  dependencies: IngestServiceDependencies
): Promise<IngestResult> {
  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  await dependencies.repository.saveJob({
    id: jobId,
    sourceType: "sensor",
    fileName: null,
    status: "processing",
    rowsReceived: request.records.length,
    rowsProcessed: 0,
    startedAt,
    completedAt: null,
    errorMessage: null,
  });

  await dependencies.repository.saveRawMeasurements(
    jobId,
    request.records.map((record, index) => ({
      createdAt: new Date().toISOString(),
      current: record.current,
      electricityPrice: record.electricityPrice,
      gridSupply: record.gridSupply,
      humidity: record.humidity,
      id: `${request.sourceId}-${record.timestamp}-${index}`,
      ingestionJobId: jobId,
      overloadCondition: record.overloadCondition,
      powerConsumption: record.powerConsumption,
      powerFactor: record.powerFactor,
      predictedLoad: record.predictedLoad,
      reactivePower: record.reactivePower,
      solarPower: record.solarPower,
      sourceId: request.sourceId,
      temperature: record.temperature,
      timestamp: record.timestamp,
      transformerFault: record.transformerFault,
      voltage: record.voltage,
      voltageFluctuation: record.voltageFluctuation,
      windPower: record.windPower,
    }))
  );

  await startProcessingJob(jobId, { fileName: request.sourceId }, dependencies);

  return buildAcceptedResult(
    jobId,
    "Sensor batch ingestion has been accepted. The backend is now processing rows incrementally."
  );
}
