import type { AnalyticsQuery } from "./analyticsSchemas.js";
import { createRepositoryPlaceholder } from "../storage/repositories.js";
import {
  buildAssistantContextFromMeasurements,
  buildEnergyDistributionSeries,
  buildFluctuationSeries,
  buildGridLoadSeries,
  buildPowerConsumptionSeries,
  buildRenewableEnergySeries,
  buildRiskIndexSeries,
  buildSummaryKpis,
  type SummaryResponse,
} from "./smartGridAnalytics.js";

export type DashboardAnalyticsResponse = {
  architecture: "backend-owned";
  message: string;
  recommendedEndpoints: string[];
  requestedQuery: AnalyticsQuery;
};

function buildNotImplementedMessage(domain: string) {
  return `${domain} analytics should be computed in the backend processing layer after ingestion, cleaning, and aggregation.`;
}

const repository = createRepositoryPlaceholder();

async function resolveJob(query: AnalyticsQuery) {
  if (query.jobId) {
    return repository.getJob(query.jobId);
  }

  return repository.getLatestJob();
}

export async function getDashboardSummary(
  query: AnalyticsQuery
): Promise<DashboardAnalyticsResponse | SummaryResponse> {
  const job = await resolveJob(query);

  if (!job) {
    return {
      architecture: "backend-owned",
      message: "No ingestion job is available yet. Upload a CSV to let the backend compute dashboard analytics.",
      requestedQuery: query,
      recommendedEndpoints: [
        "POST /api/ingest/csv",
        "GET /api/jobs",
      ],
    };
  }

  const measurements = await repository.getProcessedMeasurementsByJob(job.id);
  const kpis = buildSummaryKpis(measurements);

  return {
    assistantContext: buildAssistantContextFromMeasurements(
      job.fileName ?? "uploaded-data.csv",
      measurements,
      job.status === "failed" ? "idle" : "completed"
    ),
    job: {
      fileName: job.fileName,
      jobId: job.id,
      rowsProcessed: measurements.length,
      status: job.status,
    },
    kpis,
    series: {
      energyDistribution: buildEnergyDistributionSeries(measurements),
      fluctuation: buildFluctuationSeries(measurements),
      gridLoad: buildGridLoadSeries(measurements),
      powerConsumption: buildPowerConsumptionSeries(measurements),
      renewableEnergy: buildRenewableEnergySeries(measurements),
      riskIndex: buildRiskIndexSeries(measurements),
    },
  };
}

type SeriesResponse<TSeries> = {
  job: {
    fileName: string | null;
    jobId: string;
    status: string;
  };
  series: TSeries;
};

async function buildSeriesResponse<TSeries>(
  query: AnalyticsQuery,
  builder: (
    measurements: Awaited<ReturnType<typeof repository.getProcessedMeasurementsByJob>>
  ) => TSeries
): Promise<DashboardAnalyticsResponse | SeriesResponse<TSeries>> {
  const job = await resolveJob(query);

  if (!job) {
    return {
      architecture: "backend-owned",
      message: "No ingestion job is available yet. Upload a CSV to let the backend compute dashboard analytics.",
      requestedQuery: query,
      recommendedEndpoints: ["POST /api/ingest/csv"],
    };
  }

  const measurements = await repository.getProcessedMeasurementsByJob(job.id);

  return {
    job: {
      fileName: job.fileName,
      jobId: job.id,
      status: job.status,
    },
    series: builder(measurements),
  };
}

export async function getFluctuationAnalytics(
  query: AnalyticsQuery
): Promise<DashboardAnalyticsResponse | SeriesResponse<ReturnType<typeof buildFluctuationSeries>>> {
  return buildSeriesResponse(query, buildFluctuationSeries);
}

export async function getRiskIndexAnalytics(
  query: AnalyticsQuery
): Promise<DashboardAnalyticsResponse | SeriesResponse<ReturnType<typeof buildRiskIndexSeries>>> {
  return buildSeriesResponse(query, buildRiskIndexSeries);
}
