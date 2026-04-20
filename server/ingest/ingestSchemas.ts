import { z } from "zod";

export const csvIngestRequestSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1),
});

export const sensorIngestRequestSchema = z.object({
  sourceId: z.string().min(1),
  records: z
    .array(
      z.object({
        timestamp: z.string().min(1),
        voltage: z.number(),
        current: z.number(),
        powerConsumption: z.number(),
        reactivePower: z.number(),
        powerFactor: z.number(),
        solarPower: z.number(),
        windPower: z.number(),
        gridSupply: z.number(),
        voltageFluctuation: z.number(),
        overloadCondition: z.number(),
        transformerFault: z.number(),
        temperature: z.number(),
        humidity: z.number(),
        electricityPrice: z.number(),
        predictedLoad: z.number(),
      })
    )
    .min(1),
});

export type CsvIngestRequest = z.infer<typeof csvIngestRequestSchema>;
export type SensorIngestRequest = z.infer<typeof sensorIngestRequestSchema>;
