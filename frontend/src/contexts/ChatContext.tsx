import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { PlaceSummary } from "@/types";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skills?: Skill[];
  placeCards?: PlaceSummary[];
  showViewAll?: boolean;
  showPipeline?: boolean;
};

export type Skill = {
  label: string;
  icon: string;
};

const SKILLS: Skill[] = [
  { label: "Find Places", icon: "🔍" },
  { label: "Book Table", icon: "📅" },
  { label: "Get Directions", icon: "🗺" },
  { label: "Compare Prices", icon: "💰" },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hi there! 👋 I'm your AI Agent. I can help you discover places, book appointments, and more. What would you like to do today?",
    skills: SKILLS,
  },
];

interface ChatContextValue {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (message: Message) => void;
  currentQuery: string | null;
  setCurrentQuery: (query: string | null) => void;
  lastSearchQuery: string | null;
  setLastSearchQuery: (query: string | null) => void;
  lastSearchResults: PlaceSummary[];
  setLastSearchResults: (results: PlaceSummary[]) => void;
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
  const [lastSearchResults, setLastSearchResults] = useState<PlaceSummary[]>([]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const resetChat = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
    setCurrentQuery(null);
    setLastSearchQuery(null);
    setLastSearchResults([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        addMessage,
        currentQuery,
        setCurrentQuery,
        lastSearchQuery,
        setLastSearchQuery,
        lastSearchResults,
        setLastSearchResults,
        resetChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
