import type { ApiResponse } from "../routes/healthRoutes.js";
import {
  getDashboardSummary,
  getFluctuationAnalytics,
  getRiskIndexAnalytics,
} from "./dashboardAnalyticsService.js";

function parseQueryString(url: string) {
  const parsed = new URL(url, "http://localhost");
  return {
    jobId: parsed.searchParams.get("jobId") ?? undefined,
    windowSize:
      parsed.searchParams.get("windowSize") === "15m" ||
      parsed.searchParams.get("windowSize") === "1h" ||
      parsed.searchParams.get("windowSize") === "1d"
        ? (parsed.searchParams.get("windowSize") as "15m" | "1h" | "1d")
        : undefined,
  };
}

export async function handleAnalyticsRequest(
  request: {
    method?: string;
    url?: string;
  }
): Promise<ApiResponse | null> {
  if (!request.url) {
    return null;
  }

  const pathname = new URL(request.url, "http://localhost").pathname;
  const query = parseQueryString(request.url);

  if (pathname === "/api/dashboard/summary" && request.method === "GET") {
    return {
      statusCode: 200,
      payload: await getDashboardSummary(query),
    };
  }

  if (pathname === "/api/dashboard/fluctuation" && request.method === "GET") {
    return {
      statusCode: 200,
      payload: await getFluctuationAnalytics(query),
    };
  }

  if (pathname === "/api/dashboard/risk-index" && request.method === "GET") {
    return {
      statusCode: 200,
      payload: await getRiskIndexAnalytics(query),
    };
  }

  if (
    ["/api/dashboard/summary", "/api/dashboard/fluctuation", "/api/dashboard/risk-index"].includes(
      pathname
    ) &&
    request.method !== "GET"
  ) {
    return {
      statusCode: 405,
      payload: { error: "Method not allowed." },
    };
  }

  return null;
}
