import { z } from "zod";

export const analyticsQuerySchema = z.object({
  jobId: z.string().min(1).optional(),
  windowSize: z.enum(["15m", "1h", "1d"]).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
