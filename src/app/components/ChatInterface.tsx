import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { queryChatAssistant } from "../lib/chatClient";
import {
  DASHBOARD_ROLE_LABELS,
  type AssistantContext,
  type ChatHistoryMessage,
  type ChatQueryResponse,
  type DashboardRole,
} from "../../shared/chat";

type ChatInterfaceProps = {
  assistantContext: AssistantContext;
  hasUploadedCsv: boolean;
  isUploading?: boolean;
  role: DashboardRole;
  sessionKey: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  followUps?: string[];
  grounding?: string[];
  unsupportedReason?: string;
};

const defaultSuggestedQuestions = [
  "What is the current renewable share?",
  "When is peak demand so far?",
  "What is the latest electricity price?",
  "How many overload events have occurred?",
  "What is the current minimum headroom?",
  "How are solar and wind performing?",
];

function createWelcomeMessage(role: DashboardRole): Message {
  return {
    id: "welcome",
    role: "assistant",
    content: `I’m your grounded ${DASHBOARD_ROLE_LABELS[role]} assistant. I only answer from the uploaded smart-grid analytics shown in this dashboard.`,
    timestamp: new Date(),
    followUps: defaultSuggestedQuestions.slice(0, 3),
  };
}

function createFallbackMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    timestamp: new Date(),
    followUps: defaultSuggestedQuestions.slice(0, 2),
  };
}

function toHistory(messages: Message[]): ChatHistoryMessage[] {
  return messages
    .filter((message) => message.id !== "welcome")
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function toAssistantMessage(response: ChatQueryResponse): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: response.answer,
    timestamp: new Date(),
    followUps: response.followUps,
    grounding: response.grounding,
    unsupportedReason: response.unsupportedReason,
  };
}

export function ChatInterface({
  assistantContext,
  hasUploadedCsv,
  isUploading = false,
  role,
  sessionKey,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(() => [createWelcomeMessage(role)]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestedQuestions, setSuggestedQuestions] = useState(defaultSuggestedQuestions);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    requestGenerationRef.current += 1;
    setMessages([createWelcomeMessage(role)]);
    setInput("");
    setIsTyping(false);
    setShowSuggestions(true);
    setSuggestedQuestions(defaultSuggestedQuestions);
  }, [role, sessionKey]);

  const assistantNote = useMemo(() => {
    if (!hasUploadedCsv || isUploading) {
      return "Upload a CSV to enable grounded Q&A.";
    }

    if (assistantContext.meta.processedCount === 0) {
      return `CSV uploaded. Start the simulation to answer questions from the processed data.`;
    }

    if (assistantContext.meta.processedCount < assistantContext.meta.totalRows) {
      return `Answers are based on ${assistantContext.meta.processedCount.toLocaleString()} of ${assistantContext.meta.totalRows.toLocaleString()} processed rows through ${assistantContext.meta.latestTimestamp}.`;
    }

    return `Answers are based on the full processed dataset through ${assistantContext.meta.latestTimestamp}.`;
  }, [assistantContext.meta, hasUploadedCsv, isUploading]);

  const inputPlaceholder = hasUploadedCsv
    ? "Ask about renewable share, price, load, faults, or trends..."
    : "Upload a CSV to enable grounded Q&A";

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isTyping || isUploading || !hasUploadedCsv) {
      return;
    }

    const generation = requestGenerationRef.current;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    const historySnapshot = toHistory(messages);

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsTyping(true);
    setShowSuggestions(false);

    try {
      const response = await queryChatAssistant({
        role,
        question: trimmed,
        history: historySnapshot,
        context: assistantContext,
      });

      if (generation !== requestGenerationRef.current) {
        return;
      }

      const assistantMessage = toAssistantMessage(response);
      setMessages((current) => [...current, assistantMessage]);
      setSuggestedQuestions(
        response.followUps.length > 0 ? response.followUps : defaultSuggestedQuestions
      );
    } catch (error) {
      if (generation !== requestGenerationRef.current) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "The assistant is temporarily unavailable. Please try again.";
      setMessages((current) => [...current, createFallbackMessage(message)]);
      setSuggestedQuestions(defaultSuggestedQuestions);
    } finally {
      if (generation === requestGenerationRef.current) {
        setIsTyping(false);
      }
    }
  };

  const handleSend = () => {
    void sendMessage(input);
  };

  const handleSuggestedQuestion = (question: string) => {
    void sendMessage(question);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className="w-96 shrink-0 min-h-0 bg-white border-l flex flex-col overflow-hidden">
      <div className="shrink-0 p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-blue-600" />
          <h2 className="text-lg">Grounded AI Assistant</h2>
        </div>
        <p className="text-sm text-slate-600">Ask light questions about the uploaded grid analytics.</p>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {assistantNote}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === "user" ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                {message.role === "user" ? (
                  <User className="size-5 text-white" />
                ) : (
                  <Bot className="size-5 text-slate-700" />
                )}
              </div>

              <div className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block max-w-full p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>

                {message.role === "assistant" && message.grounding?.length ? (
                  <div className="mt-2 space-y-1 text-left">
                    {message.grounding.map((item) => (
                      <p key={item} className="text-xs text-slate-500">
                        {item}
                      </p>
                    ))}
                  </div>
                ) : null}

                {message.role === "assistant" && message.unsupportedReason ? (
                  <p className="mt-2 text-xs text-amber-700 text-left">{message.unsupportedReason}</p>
                ) : null}

                {message.role === "assistant" && message.followUps?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.followUps.map((question) => (
                      <button
                        key={`${message.id}-${question}`}
                        onClick={() => handleSuggestedQuestion(question)}
                        disabled={isTyping || isUploading || !hasUploadedCsv}
                        className="text-xs bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                ) : null}

                <p className="text-xs text-slate-500 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isTyping ? (
            <div className="flex gap-3" key="typing-indicator">
              <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <Bot className="size-5 text-slate-700" />
              </div>
              <div className="bg-slate-100 p-3 rounded-lg">
                <div className="flex gap-1">
                  <div
                    className="size-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="size-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="size-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {showSuggestions ? (
            <div className="space-y-2" key="suggestions">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Sparkles className="size-3" />
                <span>Suggested grounded questions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestedQuestion(question)}
                    disabled={isTyping || isUploading || !hasUploadedCsv}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 p-4 border-t space-y-2">
        {!showSuggestions ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSuggestions(true)}
            className="w-full text-xs"
          >
            <Sparkles className="size-3 mr-2" />
            Show suggested questions
          </Button>
        ) : null}

        <div className="flex gap-2">
          <Input
            placeholder={inputPlaceholder}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={!hasUploadedCsv || isTyping || isUploading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !hasUploadedCsv || isTyping || isUploading}
          >
            <Send className="size-4" />
          </Button>
        </div>

        <p className="text-xs text-slate-500">Press Enter to send. Answers stay grounded in the current dataset.</p>
      </div>
    </aside>
  );
}
