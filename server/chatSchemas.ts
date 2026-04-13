import { z } from "zod";

const metricPointSchema = z.object({
  value: z.number(),
  timestamp: z.string().nullable(),
});

const seriesPowerPointSchema = z.object({
  time: z.string(),
  timestamp: z.string(),
  consumption: z.number(),
  forecast: z.number(),
  overloadCondition: z.number(),
  transformerFault: z.number(),
});

const seriesRenewablePointSchema = z.object({
  date: z.string(),
  solar: z.number(),
  wind: z.number(),
});

const seriesGridPointSchema = z.object({
  hour: z.string(),
  timestamp: z.string(),
  load: z.number(),
  capacity: z.number(),
});

const seriesDistributionPointSchema = z.object({
  name: z.string(),
  value: z.number(),
  color: z.string(),
});

export const assistantContextSchema = z.object({
  meta: z.object({
    fileName: z.string(),
    status: z.enum(["idle", "running", "paused", "completed"]),
    processedCount: z.number().int().nonnegative(),
    totalRows: z.number().int().nonnegative(),
    progress: z.number().min(0).max(100),
    startTimestamp: z.string().nullable(),
    endTimestamp: z.string().nullable(),
    latestTimestamp: z.string().nullable(),
  }),
  kpis: z.object({
    renewableShare: z.number(),
    latestPrice: z.number(),
    overloadEvents: z.number().nonnegative(),
    transformerFaults: z.number().nonnegative(),
  }),
  power: z.object({
    minConsumption: metricPointSchema,
    maxConsumption: metricPointSchema,
    averageConsumption: z.number(),
    peakDemand: metricPointSchema,
    forecastGap: z.object({
      averageAbsoluteGap: z.number(),
      averageSignedGap: z.number(),
      maximumAbsoluteGap: metricPointSchema,
    }),
  }),
  price: z.object({
    min: z.number(),
    max: z.number(),
    average: z.number(),
    latest: z.number(),
  }),
  renewables: z.object({
    solarTotal: z.number(),
    windTotal: z.number(),
    bestSolarPeriod: metricPointSchema,
    bestWindPeriod: metricPointSchema,
  }),
  grid: z.object({
    averageLoad: z.number(),
    averageCapacity: z.number(),
    minimumHeadroom: metricPointSchema,
    peakDemandWindow: z.object({
      timestamp: z.string().nullable(),
      load: z.number(),
      capacity: z.number(),
      headroom: z.number(),
    }),
  }),
  faults: z.object({
    recentOverloadTimestamps: z.array(z.string()).max(5),
    recentTransformerFaultTimestamps: z.array(z.string()).max(5),
  }),
  series: z.object({
    powerConsumption: z.array(seriesPowerPointSchema).max(24),
    renewableEnergy: z.array(seriesRenewablePointSchema).max(7),
    gridLoad: z.array(seriesGridPointSchema).max(8),
    energyDistribution: z.array(seriesDistributionPointSchema).max(3),
  }),
});

export const chatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1_500),
});

export const chatQueryRequestSchema = z.object({
  role: z.enum(["grid-operator", "energy-analyst", "system-admin"]),
  question: z.string().trim().min(1).max(1_500),
  history: z.array(chatHistoryMessageSchema).max(6),
  context: assistantContextSchema,
});

export const chatQueryResponseSchema = z.object({
  answer: z.string().trim().min(1).max(2_000),
  supported: z.boolean(),
  grounding: z.array(z.string().trim().min(1).max(240)).max(4),
  followUps: z.array(z.string().trim().min(1).max(160)).max(3),
  unsupportedReason: z.string().trim().min(1).max(500).nullable(),
});

export type ChatQueryRequestInput = z.infer<typeof chatQueryRequestSchema>;
export type ChatQueryResponseOutput = z.infer<typeof chatQueryResponseSchema>;
