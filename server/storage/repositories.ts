export type IngestionJobStatus = "uploaded" | "processing" | "completed" | "failed";

export type IngestionJobRecord = {
  id: string;
  sourceType: "csv" | "sensor";
  fileName: string | null;
  status: IngestionJobStatus;
  rowsReceived: number;
  rowsProcessed: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

export type RawMeasurementRecord = {
  id: string;
  ingestionJobId: string;
  sourceId: string | null;
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
  createdAt: string;
};

export type AggregatedWindowRecord = {
  id: string;
  windowStart: string;
  windowEnd: string;
  windowSize: "15m" | "1h" | "1d";
  avgLoad: number;
  avgCapacity: number;
  avgVoltageFluctuation: number;
  overloadCount: number;
  transformerFaultCount: number;
  renewableShare: number;
  riskIndex: number;
  riskLevel: "low" | "medium" | "high";
  latestPrice: number;
};

export type StorageRepository = {
  getJob(jobId: string): Promise<IngestionJobRecord | null>;
  getLatestJob(): Promise<IngestionJobRecord | null>;
  listJobs(): Promise<IngestionJobRecord[]>;
  saveJob(job: IngestionJobRecord): Promise<void>;
  appendProcessedMeasurements(records: RawMeasurementRecord[]): Promise<void>;
  getProcessedMeasurementsByJob(jobId: string): Promise<RawMeasurementRecord[]>;
  saveRawMeasurements(jobId: string, records: RawMeasurementRecord[]): Promise<void>;
  getRawMeasurementsByJob(jobId: string): Promise<RawMeasurementRecord[]>;
  saveAggregatedWindows(records: AggregatedWindowRecord[]): Promise<void>;
};

type InMemoryStore = {
  aggregatedWindows: Map<string, AggregatedWindowRecord[]>;
  jobs: Map<string, IngestionJobRecord>;
  processedMeasurements: Map<string, RawMeasurementRecord[]>;
  rawMeasurements: Map<string, RawMeasurementRecord[]>;
};

const store: InMemoryStore = {
  aggregatedWindows: new Map(),
  jobs: new Map(),
  processedMeasurements: new Map(),
  rawMeasurements: new Map(),
};

export function createRepositoryPlaceholder(): StorageRepository {
  return {
    async getJob(jobId) {
      return store.jobs.get(jobId) ?? null;
    },
    async getLatestJob() {
      const jobs = Array.from(store.jobs.values()).sort((left, right) =>
        left.startedAt.localeCompare(right.startedAt)
      );
      return jobs.at(-1) ?? null;
    },
    async listJobs() {
      return Array.from(store.jobs.values()).sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt)
      );
    },
    async saveJob(job) {
      store.jobs.set(job.id, job);
    },
    async appendProcessedMeasurements(records) {
      if (records.length === 0) {
        return;
      }

      const jobId = records[0].ingestionJobId;
      const current = store.processedMeasurements.get(jobId) ?? [];
      current.push(...records);
      store.processedMeasurements.set(jobId, current);
    },
    async getProcessedMeasurementsByJob(jobId) {
      return [...(store.processedMeasurements.get(jobId) ?? [])].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp)
      );
    },
    async saveRawMeasurements(jobId, records) {
      store.rawMeasurements.set(jobId, [...records]);
      store.processedMeasurements.set(jobId, []);
    },
    async getRawMeasurementsByJob(jobId) {
      return [...(store.rawMeasurements.get(jobId) ?? [])].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp)
      );
    },
    async saveAggregatedWindows(records) {
      records.forEach((record) => {
        const current = store.aggregatedWindows.get(record.id) ?? [];
        current.push(record);
        store.aggregatedWindows.set(record.id, current);
      });
    },
  };
}
