import test from "node:test";
import assert from "node:assert/strict";
import { handleChatApiRequest } from "./index.js";
import type { ChatQueryRequest, ChatQueryResponse } from "../src/shared/chat.js";

console.log("\n=== Functional - Chat API ===");

function createBaseRequest(overrides: Partial<ChatQueryRequest> = {}): ChatQueryRequest {
  return {
    role: "grid-operator",
    question: "What is the current renewable share?",
    history: [],
    context: {
      meta: {
        fileName: "sample.csv",
        status: "running",
        processedCount: 12,
        totalRows: 50,
        progress: 24,
        startTimestamp: "1/1/2024 0:00",
        endTimestamp: "1/1/2024 2:45",
        latestTimestamp: "1/1/2024 2:45",
      },
      kpis: {
        renewableShare: 41.28,
        latestPrice: 0.417,
        overloadEvents: 2,
        transformerFaults: 1,
      },
      power: {
        minConsumption: { value: 1.19, timestamp: "1/1/2024 0:00" },
        maxConsumption: { value: 5.09, timestamp: "1/1/2024 0:15" },
        averageConsumption: 3.41,
        peakDemand: { value: 5.09, timestamp: "1/1/2024 0:15" },
        forecastGap: {
          averageAbsoluteGap: 0.15,
          averageSignedGap: 0.04,
          maximumAbsoluteGap: { value: 0.21, timestamp: "1/1/2024 0:15" },
        },
      },
      price: {
        min: 0.401,
        max: 0.492,
        average: 0.438,
        latest: 0.417,
      },
      renewables: {
        solarTotal: 420.22,
        windTotal: 311.73,
        bestSolarPeriod: { value: 46.61, timestamp: "1/1/2024 0:00" },
        bestWindPeriod: { value: 28.11, timestamp: "1/1/2024 1:15" },
      },
      grid: {
        averageLoad: 3.41,
        averageCapacity: 52.18,
        minimumHeadroom: { value: 10.51, timestamp: "1/1/2024 0:15" },
        peakDemandWindow: {
          timestamp: "1/1/2024 0:15",
          load: 5.09,
          capacity: 25.46,
          headroom: 20.37,
        },
      },
      faults: {
        recentOverloadTimestamps: ["1/1/2024 0:15"],
        recentTransformerFaultTimestamps: ["1/1/2024 1:45"],
      },
      series: {
        powerConsumption: [],
        renewableEnergy: [],
        gridLoad: [],
        energyDistribution: [],
      },
    },
    ...overrides,
  };
}

async function withHandler(
  responseFactory: () => Promise<ChatQueryResponse> | ChatQueryResponse,
  callback: (callApi: (request: ChatQueryRequest) => Promise<{ payload: unknown; statusCode: number }>) => Promise<void>
) {
  const callApi = (request: ChatQueryRequest) =>
    handleChatApiRequest(
      {
        body: request,
        method: "POST",
        url: "/api/chat/query",
      },
      {
        openai: {
          responses: {
            parse: async () => ({ output_parsed: await responseFactory() }),
          },
        },
      }
    );

  await callback(callApi);
}

test("POST /api/chat/query returns a grounded supported answer", async () => {
  await withHandler(
    () => ({
      supported: true,
      answer: "Renewables currently provide 41.28% of the total supply in the processed data.",
      grounding: [
        "Renewable share is 41.28%.",
        "12 of 50 rows have been processed through 1/1/2024 2:45.",
      ],
      followUps: ["What is the latest electricity price?"],
    }),
    async (callApi) => {
      const response = await callApi(createBaseRequest());

      assert.equal(response.statusCode, 200);
      const json = response.payload as ChatQueryResponse;
      assert.equal(json.supported, true);
      assert.match(json.answer, /41\.28%/);
    }
  );
});

test("POST /api/chat/query returns a grounded refusal for unsupported questions", async () => {
  await withHandler(
    () => ({
      supported: false,
      answer: "I can only answer questions grounded in the uploaded smart-grid analytics.",
      grounding: ["The request asked for information not present in the uploaded analytics context."],
      followUps: ["Ask about renewable share or peak demand instead."],
      unsupportedReason: "Question falls outside the available dataset analytics.",
    }),
    async (callApi) => {
      const response = await callApi(
        createBaseRequest({
          question: "What caused the outage in Raleigh?",
        })
      );

      assert.equal(response.statusCode, 200);
      const json = response.payload as ChatQueryResponse;
      assert.equal(json.supported, false);
      assert.match(json.answer, /smart-grid analytics/i);
    }
  );
});

test("POST /api/chat/query short-circuits when no data has been processed", async () => {
  let parseCalls = 0;
  const response = await handleChatApiRequest(
    {
      body: createBaseRequest({
        context: {
          ...createBaseRequest().context,
          meta: {
            ...createBaseRequest().context.meta,
            processedCount: 0,
          },
        },
      }),
      method: "POST",
      url: "/api/chat/query",
    },
    {
      openai: {
        responses: {
          parse: async () => {
            parseCalls += 1;
            return {
              output_parsed: {
                supported: true,
                answer: "This should not be called.",
                grounding: [],
                followUps: [],
              },
            };
          },
        },
      },
    }
  );

  assert.equal(response.statusCode, 200);
  const json = response.payload as ChatQueryResponse;
  assert.equal(json.supported, false);
  assert.equal(parseCalls, 0);
  assert.match(json.answer, /processed some smart-grid rows/i);
});

test("POST /api/chat/query returns a retryable fallback on OpenAI failure", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = await handleChatApiRequest(
      {
        body: createBaseRequest(),
        method: "POST",
        url: "/api/chat/query",
      },
      {
        openai: {
          responses: {
            parse: async () => {
              const error = new Error("rate limited") as Error & { status?: number };
              error.status = 429;
              throw error;
            },
          },
        },
      }
    );

    assert.equal(response.statusCode, 200);
    const json = response.payload as ChatQueryResponse;
    assert.equal(json.supported, false);
    assert.match(json.answer, /rate-limit|rate limited|try again/i);
  } finally {
    console.error = originalConsoleError;
  }
});
