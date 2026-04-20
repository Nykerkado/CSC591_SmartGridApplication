import type { AssistantContext } from "../../shared/chat";
import type {
  FluctuationPoint,
  GridLoadPoint,
  PowerPoint,
  RenewablePoint,
  RiskPoint,
  SimulationStatus,
  SourcePoint,
} from "./smartGrid";

export type BackendJob = {
  completedAt: string | null;
  errorMessage: string | null;
  fileName: string | null;
  id: string;
  rowsProcessed: number;
  rowsReceived: number;
  sourceType: "csv" | "sensor";
  startedAt: string;
  status: SimulationStatus | "failed";
};

export type BackendSummary = {
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
  series: {
    energyDistribution: SourcePoint[];
    fluctuation: FluctuationPoint[];
    gridLoad: GridLoadPoint[];
    powerConsumption: PowerPoint[];
    renewableEnergy: RenewablePoint[];
    riskIndex: RiskPoint[];
  };
};

type BackendError = {
  error?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = await readJson<BackendError>(response);
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function ingestCsvFile(file: File) {
  const csvText = await file.text();

  const response = await fetch("/api/ingest/csv", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      csvText,
      fileName: file.name,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to upload the CSV file."));
  }

  return readJson<{
    jobId: string;
    message: string;
    nextSteps: string[];
    status: "accepted";
  }>(response);
}

export async function fetchJob(jobId: string) {
  const response = await fetch(`/api/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to fetch ingestion job status."));
  }

  const body = await readJson<{ job: BackendJob }>(response);
  return body.job;
}

export async function fetchDashboardSummary(jobId: string) {
  const response = await fetch(`/api/dashboard/summary?jobId=${encodeURIComponent(jobId)}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to fetch dashboard analytics."));
  }

  return readJson<BackendSummary>(response);
}
