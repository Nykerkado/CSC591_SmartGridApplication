import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleJobRequest } from "./jobs/jobRoutes.js";
import { chatQueryRequestSchema } from "./chatSchemas.js";
import { createOpenAIClientFromEnv, queryGroundedChat, type OpenAIClientLike } from "./chatService.js";
import { handleAnalyticsRequest } from "./analytics/analyticsRoutes.js";
import { handleIngestRequest } from "./ingest/ingestRoutes.js";
import { loadLocalEnv } from "./loadEnv.js";
import { handleHealthRequest, type ApiResponse } from "./routes/healthRoutes.js";

loadLocalEnv();

type ServerDependencies = {
  openai?: OpenAIClientLike;
};

type ApiRequest = {
  body?: unknown;
  method?: string;
  url?: string;
};

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

function resolveClientDistDirectory() {
  const candidateProjectRoots = [
    process.cwd(),
    path.resolve(currentDirectory, "..", "..", ".."),
    path.resolve(currentDirectory, "..", ".."),
  ];

  for (const candidateRoot of candidateProjectRoots) {
    const candidateDistDirectory = path.join(candidateRoot, "dist");
    const candidateIndexPath = path.join(candidateDistDirectory, "index.html");

    if (existsSync(candidateIndexPath)) {
      return {
        clientDistDirectory: candidateDistDirectory,
        clientIndexPath: candidateIndexPath,
      };
    }
  }

  const fallbackDistDirectory = path.join(process.cwd(), "dist");
  return {
    clientDistDirectory: fallbackDistDirectory,
    clientIndexPath: path.join(fallbackDistDirectory, "index.html"),
  };
}

const { clientDistDirectory, clientIndexPath } = resolveClientDistDirectory();

const STATIC_CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response: ServerResponse, filePath: string) {
  const extension = path.extname(filePath);
  const contentType = STATIC_CONTENT_TYPES[extension] ?? "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
  });

  createReadStream(filePath).pipe(response);
}

async function tryHandleStaticAsset(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET" || !request.url || request.url.startsWith("/api")) {
    return false;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const normalizedPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = normalizedPath === "/" ? "index.html" : normalizedPath.replace(/^\/+/, "");
  const assetPath = path.resolve(clientDistDirectory, relativePath);

  if (!assetPath.startsWith(clientDistDirectory)) {
    response.writeHead(403);
    response.end("Forbidden");
    return true;
  }

  if (existsSync(assetPath)) {
    const assetStats = await stat(assetPath);
    if (assetStats.isFile()) {
      sendFile(response, assetPath);
      return true;
    }
  }

  if (existsSync(clientIndexPath)) {
    sendFile(response, clientIndexPath);
    return true;
  }

  return false;
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

  if (request.url === "/api/health" && request.method === "GET") {
    return handleHealthRequest();
  }

  const ingestResult = await handleIngestRequest(request);
  if (ingestResult) {
    return ingestResult;
  }

  const analyticsResult = await handleAnalyticsRequest(request);
  if (analyticsResult) {
    return analyticsResult;
  }

  const jobResult = await handleJobRequest(request);
  if (jobResult) {
    return jobResult;
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
      const servedStaticAsset = await tryHandleStaticAsset(request, response);
      if (servedStaticAsset) {
        return;
      }

      const body = request.method === "POST" ? await readJsonBody(request) : undefined;
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
    if (existsSync(clientIndexPath)) {
      console.log(`Serving dashboard UI from ${clientDistDirectory}`);
    } else {
      console.log("Client build not found. API routes are available, but the dashboard UI is not being served.");
    }
    if (!process.env.OPENAI_API_KEY) {
      console.log("OPENAI_API_KEY is not set. Chat requests will return a configuration hint.");
    }
  });
}
