import type { ChatQueryRequest, ChatQueryResponse } from "../../shared/chat";

export async function queryChatAssistant(payload: ChatQueryRequest): Promise<ChatQueryResponse> {
  const response = await fetch("/api/chat/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to reach the smart-grid assistant.";

    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the default message when the error response is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as ChatQueryResponse;
}
