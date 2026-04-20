import type { ApiResponse } from "../routes/healthRoutes.js";
import { createRepositoryPlaceholder } from "../storage/repositories.js";
import { ingestCsv, ingestSensorBatch } from "./csvIngestService.js";
import { csvIngestRequestSchema, sensorIngestRequestSchema } from "./ingestSchemas.js";

const repository = createRepositoryPlaceholder();

export async function handleIngestRequest(
  request: {
    body?: unknown;
    method?: string;
    url?: string;
  }
): Promise<ApiResponse | null> {
  if (request.url === "/api/ingest/csv" && request.method === "POST") {
    const parsed = csvIngestRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return {
        statusCode: 400,
        payload: {
          error: "Invalid CSV ingest request payload.",
          details: parsed.error.flatten(),
        },
      };
    }

    const result = await ingestCsv(parsed.data, { repository });
    return {
      statusCode: 202,
      payload: result,
    };
  }

  if (request.url === "/api/ingest/sensor" && request.method === "POST") {
    const parsed = sensorIngestRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return {
        statusCode: 400,
        payload: {
          error: "Invalid sensor ingest request payload.",
          details: parsed.error.flatten(),
        },
      };
    }

    const result = await ingestSensorBatch(parsed.data, { repository });
    return {
      statusCode: 202,
      payload: result,
    };
  }

  if (
    request.url &&
    (request.url === "/api/ingest/csv" || request.url === "/api/ingest/sensor") &&
    request.method !== "POST"
  ) {
    return {
      statusCode: 405,
      payload: { error: "Method not allowed." },
    };
  }

  return null;
}
