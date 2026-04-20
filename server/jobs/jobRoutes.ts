import type { ApiResponse } from "../routes/healthRoutes.js";
import { createRepositoryPlaceholder } from "../storage/repositories.js";

const repository = createRepositoryPlaceholder();

export async function handleJobRequest(
  request: {
    method?: string;
    url?: string;
  }
): Promise<ApiResponse | null> {
  if (!request.url) {
    return null;
  }

  const parsed = new URL(request.url, "http://localhost");
  const pathname = parsed.pathname;

  if (pathname === "/api/jobs" && request.method === "GET") {
    const jobs = await repository.listJobs();
    return {
      statusCode: 200,
      payload: { jobs },
    };
  }

  if (pathname.startsWith("/api/jobs/") && request.method === "GET") {
    const jobId = pathname.replace("/api/jobs/", "");
    const job = await repository.getJob(jobId);

    if (!job) {
      return {
        statusCode: 404,
        payload: { error: "Job not found." },
      };
    }

    return {
      statusCode: 200,
      payload: { job },
    };
  }

  if ((pathname === "/api/jobs" || pathname.startsWith("/api/jobs/")) && request.method !== "GET") {
    return {
      statusCode: 405,
      payload: { error: "Method not allowed." },
    };
  }

  return null;
}
