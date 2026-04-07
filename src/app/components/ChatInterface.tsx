import { useState, useRef, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Send, Bot, User, Sparkles } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const mockResponses = [
  "Based on the current grid data, renewable energy is contributing approximately 42% of total power generation, showing a 15% increase from last month.",
  "The grid load shows peak demand between 6-9 PM. I recommend scheduling maintenance during low-demand hours (2-5 AM) to minimize disruption.",
  "Historical trends indicate that solar output peaks at 1 PM, while wind generation is most consistent between 8 PM and 6 AM. This complementary pattern helps stabilize the grid.",
  "Current power consumption is within normal parameters. However, I notice a slight increase in demand from the industrial sector, which may require capacity adjustments.",
  "The renewable energy mix shows: Solar 28%, Wind 14%, Hydro 8%. Fossil fuels currently account for 50% of generation. Setting targets to increase renewables would improve sustainability.",
];

const suggestedQuestions = [
  "What's the current renewable energy percentage?",
  "When is peak demand today?",
  "How is solar performing?",
  "Show grid capacity status",
  "Compare renewables vs fossil fuels",
  "What are the energy trends?",
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your Smart Grid AI Assistant. Ask me anything about grid conditions, energy trends, or renewable contributions.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    setShowSuggestions(false);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className="w-96 bg-white border-l flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="size-5 text-blue-600" />
          <h2 className="text-lg">AI Assistant</h2>
        </div>
        <p className="text-sm text-slate-600">Ask questions about grid analytics</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === "user"
                    ? "bg-blue-600"
                    : "bg-slate-200"
                }`}
              >
                {message.role === "user" ? (
                  <User className="size-5 text-white" />
                ) : (
                  <Bot className="size-5 text-slate-700" />
                )}
              </div>
              <div
                className={`flex-1 ${
                  message.role === "user" ? "text-right" : ""
                }`}
              >
                <div
                  className={`inline-block p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3" key="typing-indicator">
              <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <Bot className="size-5 text-slate-700" />
              </div>
              <div className="bg-slate-100 p-3 rounded-lg">
                <div className="flex gap-1">
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {showSuggestions && (
            <div className="space-y-2" key="suggestions">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Sparkles className="size-3" />
                <span>Suggested questions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    disabled={isTyping}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-2">
        {!showSuggestions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSuggestions(true)}
            className="w-full text-xs"
          >
            <Sparkles className="size-3 mr-2" />
            Show suggested questions
          </Button>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Ask about grid data, trends, insights..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </aside>
  );
}