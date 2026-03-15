import { useRef, useEffect, useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, User, MapPin, Star, ExternalLink } from "lucide-react";
import BottomTabBar from "@/components/BottomTabBar";
import AgentPipeline from "@/components/AgentPipeline";
import { useSearchStream } from "@/hooks/useSearchStream";
import { usePreferences } from "@/hooks/usePreferences";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useChatContext, type Message, type Skill } from "@/contexts/ChatContext";

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { messages, setMessages, currentQuery, setCurrentQuery, lastSearchQuery, setLastSearchQuery, lastSearchResults, setLastSearchResults } = useChatContext();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoSent = useRef(false);
  const { preferences } = usePreferences();
  const { location } = useDeviceLocation();
  const { results, isLoading, pipelineStage, stepDurations, startSearch, reset } = useSearchStream(preferences);

  const urlQuery = searchParams.get("q");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, pipelineStage]);

  // When results come back from the API, create the assistant response
  useEffect(() => {
    if (pipelineStage === "completed" && results.length > 0 && currentQuery) {
      setLastSearchResults(results);
      setLastSearchQuery(currentQuery);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I found ${results.length} places for "${currentQuery}". Here are my top recommendations:`,
        placeCards: results.slice(0, 4),
        showViewAll: results.length > 0,
        showPipeline: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentQuery(null);
    }
  }, [pipelineStage, results, currentQuery, setLastSearchResults, setLastSearchQuery, setMessages, setCurrentQuery]);

  const processQuery = useCallback((queryText: string) => {
    if (!location) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I need your location to find places nearby. Please enable location access and try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    reset();
    setCurrentQuery(queryText);
    startSearch(queryText, location, { stream: true });
  }, [location, startSearch, reset]);

  // Auto-send from URL query (only if not already in conversation or just returned from another screen)
  useEffect(() => {
    if (!urlQuery || !location) return;
    // Already sent: in conversation, or same as last search (e.g. returned from place detail — do not start a new request)
    const alreadySent =
      hasAutoSent.current ||
      messages.some((m) => m.role === "user" && m.content === urlQuery) ||
      lastSearchQuery === urlQuery;
    if (alreadySent) {
      hasAutoSent.current = true;
      return;
    }
    hasAutoSent.current = true;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: urlQuery };
    setMessages((prev) => [...prev, userMsg]);
    processQuery(urlQuery);
  }, [urlQuery, location, processQuery, messages, setMessages, lastSearchQuery]);

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    const queryText = input.trim();
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: queryText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    processQuery(queryText);
  };

  const handleSkillClick = (skill: Skill) => {
    setInput(skill.label);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 safe-top border-b border-border/50">
        <div className="flex items-center justify-center px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">AI Agent</h1>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-40">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className="max-w-[80%]">
                {/* Completed pipeline summary for this message */}
                {msg.showPipeline && (
                  <AgentPipeline stage="completed" isVisible stepDurations={stepDurations} />
                )}

                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border/60 text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Skills */}
                {msg.skills && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.skills.map((skill) => (
                      <motion.button
                        key={skill.label}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSkillClick(skill)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/60 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                      >
                        <span>{skill.icon}</span>
                        {skill.label}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Place Cards */}
                {msg.placeCards && msg.placeCards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.placeCards.map((place) => (
                      <motion.div
                        key={place.place_id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(`/place/${place.place_id}`)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 cursor-pointer hover:bg-secondary/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-medium text-foreground">{place.rating.toFixed(1)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* View All */}
                {msg.showViewAll && msg.placeCards && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate("/recommendations", {
                      state: {
                        query: urlQuery || lastSearchQuery || "",
                        results: lastSearchResults.length > 0 ? lastSearchResults : msg.placeCards,
                      }
                    })}
                    className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold w-full justify-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View All Recommendations
                  </motion.button>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live reasoning pipeline while thinking */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2.5"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="max-w-[85%] w-full">
              <AgentPipeline stage={pipelineStage} isVisible stepDurations={stepDurations} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 safe-bottom">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/60 shadow-lg max-w-lg mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Ask your AI agent..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none px-3 py-2"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={sendMessage}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
            disabled={!input.trim() || isLoading}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
