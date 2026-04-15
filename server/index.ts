import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { chatQueryRequestSchema } from "./chatSchemas.js";
import { createOpenAIClientFromEnv, queryGroundedChat, type OpenAIClientLike } from "./chatService.js";
import { loadLocalEnv } from "./loadEnv.js";

loadLocalEnv();

type ServerDependencies = {
  openai?: OpenAIClientLike;
};

type ApiRequest = {
  body?: unknown;
  method?: string;
  url?: string;
};

type ApiResponse = {
  payload: unknown;
  statusCode: number;
};

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function handleChatApiRequest(
  request: ApiRequest,
  dependencies: ServerDependencies = {}
): Promise<ApiResponse> {
  const openai = dependencies.openai ?? createOpenAIClientFromEnv();

  if (!request.url) {
    return {
      statusCode: 400,
      payload: { error: "Missing request URL." },
    };
  }

  if (request.url === "/api/chat/query" && request.method === "POST") {
    const parsedRequest = chatQueryRequestSchema.safeParse(request.body ?? {});

    if (!parsedRequest.success) {
      return {
        statusCode: 400,
        payload: {
          error: "Invalid chat request payload.",
          details: parsedRequest.error.flatten(),
        },
      };
    }

    const chatResponse = await queryGroundedChat(parsedRequest.data, { openai });
    return {
      statusCode: 200,
      payload: chatResponse,
    };
  }

  if (request.url === "/api/chat/query") {
    return {
      statusCode: 405,
      payload: { error: "Method not allowed." },
    };
  }

  return {
    statusCode: 404,
    payload: { error: "Not found." },
  };
}

export function createChatApiServer(dependencies: ServerDependencies = {}) {
  const openai = dependencies.openai ?? createOpenAIClientFromEnv();

  return createServer(async (request, response) => {
    try {
      const body =
        request.method === "POST" && request.url === "/api/chat/query"
          ? await readJsonBody(request)
          : undefined;
      const result = await handleChatApiRequest(
        {
          body,
          method: request.method,
          url: request.url,
        },
        { openai }
      );
      sendJson(response, result.statusCode, result.payload);
    } catch (error) {
      console.error("Chat API request failed", error);
      sendJson(response, 500, {
        error: "Unable to process the chat request.",
      });
    }
  });
}

const isEntryPoint =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryPoint) {
  const port = Number(process.env.SMART_GRID_API_PORT ?? process.env.PORT ?? "8787");
  const server = createChatApiServer();

  server.listen(port, () => {
    console.log(`Smart Grid chat API listening on http://localhost:${port}`);
    if (!process.env.OPENAI_API_KEY) {
      console.log("OPENAI_API_KEY is not set. Chat requests will return a configuration hint.");
    }
  });
}
