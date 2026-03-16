import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, MessageSquare, MapPin } from "lucide-react";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  placeName: string;
  placeCategory: string;
}

type ChatMessage = {
  id: string;
  role: "user" | "provider";
  content: string;
};

const AUTO_REPLIES: Record<string, string> = {
  default: "Thanks for reaching out! We'll get back to you shortly. Is there anything specific you'd like to know?",
  hour: "We're open today from 8:00 AM to 9:00 PM. Feel free to drop by anytime!",
  book: "Sure! We have availability today. Would you prefer morning or afternoon?",
  price: "Our prices vary by service. The most popular option starts at $25. Want me to send you the full menu?",
  available: "Yes, we have slots available! When would you like to come in?",
};

function getAutoReply(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("hour") || lower.includes("open") || lower.includes("time")) return AUTO_REPLIES.hour;
  if (lower.includes("book") || lower.includes("reserv") || lower.includes("appointment")) return AUTO_REPLIES.book;
  if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) return AUTO_REPLIES.price;
  if (lower.includes("available") || lower.includes("slot") || lower.includes("today")) return AUTO_REPLIES.available;
  return AUTO_REPLIES.default;
}

export default function ChatDrawer({ isOpen, onClose, placeName, placeCategory }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "provider",
      content: `Hi! 👋 Welcome to ${placeName}. How can we help you today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Reset on reopen
  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          id: "1",
          role: "provider",
          content: `Hi! 👋 Welcome to ${placeName}. How can we help you today?`,
        },
      ]);
      setInput("");
    }
  }, [isOpen, placeName]);

  const sendMessage = () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "provider",
        content: getAutoReply(text),
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 1000 + Math.random() * 500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl h-[75dvh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{placeName}</h3>
                  <p className="text-[10px] text-muted-foreground">{placeCategory} · Usually replies instantly</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border/60 text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-border/60">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick replies */}
            <div className="flex-shrink-0 px-4 pb-2">
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {["What are your hours?", "Can I book now?", "How much?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="px-3 py-1.5 rounded-full bg-muted/60 text-[11px] font-medium text-muted-foreground whitespace-nowrap hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-border/50 safe-bottom">
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/60">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none px-3 py-2"
                  autoFocus
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={sendMessage}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                  disabled={!input.trim() || isTyping}
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
