export type ApiResponse = {
  payload: unknown;
  statusCode: number;
};

export function handleHealthRequest(): ApiResponse {
  return {
    statusCode: 200,
    payload: {
      status: "ok",
      service: "smart-grid-api",
      timestamp: new Date().toISOString(),
    },
  };
}
