import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  DASHBOARD_ROLE_LABELS,
  type ChatHistoryMessage,
  type ChatQueryRequest,
  type ChatQueryResponse,
} from "../src/shared/chat.js";
import { chatQueryResponseSchema } from "./chatSchemas.js";

const MODEL_NAME = "gpt-5.4-mini-2026-03-17";

type ParsedResponseLike = {
  output_parsed: ChatQueryResponse | null;
};

export type OpenAIClientLike = {
  responses: {
    parse: (params: Parameters<OpenAI["responses"]["parse"]>[0]) => Promise<ParsedResponseLike>;
  };
};

type ChatServiceDependencies = {
  openai?: OpenAIClientLike;
};

function buildNoDataResponse(request: ChatQueryRequest): ChatQueryResponse {
  return {
    supported: false,
    answer:
      request.context.meta.totalRows === 0
        ? "I can answer questions once a smart-grid CSV has been uploaded."
        : "I can answer once the simulation has processed some smart-grid rows. Upload the CSV and start the simulation first.",
    grounding: [
      `${request.context.meta.processedCount.toLocaleString()} processed rows are currently available.`,
    ],
    followUps:
      request.context.meta.totalRows === 0
        ? [
            "Upload a smart-grid CSV to begin.",
            "After uploading, start the simulation and ask again.",
          ]
        : [
            "Start the simulation and ask about renewable share.",
            "Ask again after more rows have been processed.",
          ],
    unsupportedReason: "No processed smart-grid analytics are available yet.",
  };
}

function buildConfigurationResponse(): ChatQueryResponse {
  return {
    supported: false,
    answer:
      "The assistant is not configured yet. Add `OPENAI_API_KEY` to your local environment before asking data questions.",
    grounding: ["The local chat API could not find an OpenAI API key."],
    followUps: [
      "Add OPENAI_API_KEY to your environment.",
      "Restart the local server and try again.",
    ],
    unsupportedReason: "OpenAI API key is missing.",
  };
}

function buildServiceFailureResponse(error: unknown): ChatQueryResponse {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  const retryMessage =
    status === 429
      ? "The assistant is being rate-limited right now. Please try again in a moment."
      : "The assistant is temporarily unavailable. Please try again in a moment.";

  return {
    supported: false,
    answer: retryMessage,
    grounding: ["The local chat service could not complete the OpenAI request."],
    followUps: [
      "Retry the same question in a moment.",
      "Ask a shorter question if the problem continues.",
    ],
  };
}

function buildInstructions(roleLabel: string) {
  return [
    `You are a smart-grid analytics assistant supporting a ${roleLabel}.`,
    "Use only the structured JSON context provided in the current user message.",
    "Do not use outside knowledge, generic energy facts, or guessed causes.",
    "Only support questions about renewable share, generation mix, electricity price, peak demand, load vs capacity, headroom, overloads, transformer faults, and simple trend/comparison summaries present in the context.",
    "If the question cannot be answered from the context, set supported=false and explain that you only answer from uploaded smart-grid analytics.",
    "Keep answers concise, concrete, and cite the exact metrics or timestamps you used in plain language.",
    "Grounding must be short factual snippets based directly on the context.",
    "Follow-up questions must stay within the available smart-grid analytics scope.",
  ].join("\n");
}

function buildPrompt(request: ChatQueryRequest) {
  const roleLabel = DASHBOARD_ROLE_LABELS[request.role];

  return {
    roleLabel,
    prompt: [
      `Dashboard role: ${roleLabel}`,
      `User question: ${request.question.trim()}`,
      "Current assistant context JSON:",
      JSON.stringify(request.context),
    ].join("\n\n"),
  };
}

export async function queryGroundedChat(
  request: ChatQueryRequest,
  dependencies: ChatServiceDependencies
): Promise<ChatQueryResponse> {
  if (request.context.meta.processedCount === 0) {
    return buildNoDataResponse(request);
  }

  if (!dependencies.openai) {
    return buildConfigurationResponse();
  }

  const { roleLabel, prompt } = buildPrompt(request);

  try {
    const response = await dependencies.openai.responses.parse({
      model: MODEL_NAME,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 450,
      instructions: buildInstructions(roleLabel),
      input: [
        ...request.history.map((message: ChatHistoryMessage) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(chatQueryResponseSchema, "grounded_grid_answer"),
      },
    });

    const parsed = response.output_parsed;

    if (!parsed) {
      return {
        supported: false,
        answer:
          "I couldn’t generate a grounded answer from the current smart-grid analytics. Please try rephrasing the question.",
        grounding: ["The model did not return a structured grounded response."],
        followUps: [
          "Ask for renewable share or peak demand.",
          "Try a shorter question focused on one metric.",
        ],
      };
    }

    return parsed;
  } catch (error) {
    console.error("Grounded chat query failed", error);
    return buildServiceFailureResponse(error);
  }
}

export function createOpenAIClientFromEnv(): OpenAIClientLike | undefined {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return undefined;
  }

  return new OpenAI({ apiKey }) as unknown as OpenAIClientLike;
}
