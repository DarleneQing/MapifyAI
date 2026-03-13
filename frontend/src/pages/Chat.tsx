import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, User, MapPin, Star, ExternalLink } from "lucide-react";
import BottomTabBar from "@/components/BottomTabBar";
import AgentPipeline from "@/components/AgentPipeline";
import type { PipelineStage } from "@/hooks/useSearchStream";
import { usePreferences } from "@/hooks/usePreferences";
import { sortByPreferences } from "@/lib/preferenceScoring";
import type { PlaceSummary } from "@/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skills?: Skill[];
  placeCards?: PlaceCardData[];
  showViewAll?: boolean;
  /** If true, show pipeline reasoning inline before this message */
  showPipeline?: boolean;
};

type Skill = {
  label: string;
  icon: string;
};

type PlaceCardData = {
  id: string;
  name: string;
  rating: number;
  category: string;
  address: string;
};

const SKILLS: Skill[] = [
  { label: "Find Places", icon: "🔍" },
  { label: "Book Table", icon: "📅" },
  { label: "Get Directions", icon: "🗺" },
  { label: "Compare Prices", icon: "💰" },
];

// Place card data with scoring-compatible fields
const AI_PLACE_DATA: Record<string, PlaceCardData & { price_level: string; distance_km: number }> = {
  p1: { id: "p1", name: "The Ground Brew", rating: 4.9, category: "Coffee", address: "12 Market Street", price_level: "medium", distance_km: 0.2 },
  p2: { id: "p2", name: "Komorebi Tables", rating: 4.7, category: "Japanese Fusion", address: "88 Oak Avenue", price_level: "medium", distance_km: 0.5 },
  p3: { id: "p3", name: "Velvet Crumb", rating: 4.8, category: "Bakery & Coffee", address: "45 Elm Street", price_level: "low", distance_km: 0.8 },
  p4: { id: "p4", name: "Origin Roast", rating: 4.6, category: "Coffee", address: "200 Pine Road", price_level: "low", distance_km: 0.2 },
  p5: { id: "p5", name: "The Sage Bistro", rating: 4.8, category: "Fine Dining", address: "Gastronomy Park", price_level: "high", distance_km: 1.5 },
  p6: { id: "p6", name: "Blue Bottle Coffee", rating: 4.3, category: "Coffee", address: "299 Copper Lane", price_level: "high", distance_km: 3.0 },
  sharp: { id: "sharp", name: "Sharp Edge Barber", rating: 4.7, category: "Barber", address: "22 Main St", price_level: "medium", distance_km: 0.4 },
  gentleman: { id: "gentleman", name: "The Gentleman's Cut", rating: 4.5, category: "Barber", address: "55 Oak Blvd", price_level: "medium", distance_km: 0.9 },
};

const AI_RESPONSES: { match: string; text: string; placeIds: string[] }[] = [
  {
    match: "coffee",
    text: "I found some great coffee spots near you! Here are my top picks based on your preferences:",
    placeIds: ["p1", "p3", "p4", "p6"],
  },
  {
    match: "restaurant",
    text: "Here are some highly-rated restaurants that match your taste profile:",
    placeIds: ["p5", "p2"],
  },
  {
    match: "barber",
    text: "I found barber shops nearby with good ratings and availability today:",
    placeIds: ["sharp", "gentleman"],
  },
  {
    match: "study",
    text: "I found quiet study-friendly spaces with low crowd density. Here are the best options:",
    placeIds: ["p2", "p1", "p4"],
  },
  {
    match: "default",
    text: "Let me search for that! Here's what I found based on your preferences and location:",
    placeIds: ["p1", "p5", "p3", "p4"],
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hi there! 👋 I'm your AI Agent. I can help you discover places, book appointments, and more. What would you like to do today?",
    skills: SKILLS,
  },
];

// Pipeline stages with timing (ms)
const PIPELINE_SEQUENCE: { stage: PipelineStage; delay: number }[] = [
  { stage: "intent_parsed", delay: 600 },
  { stage: "stores_crawled", delay: 1800 },
  { stage: "transit_computed", delay: 2800 },
  { stage: "reviews_fetched", delay: 3600 },
  { stage: "scores_computed", delay: 4400 },
  { stage: "recommendations_ready", delay: 5000 },
  { stage: "completed", delay: 5600 },
];

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoSent = useRef(false);
  const timersRef = useRef<number[]>([]);
  const { preferences } = usePreferences();

  const urlQuery = searchParams.get("q");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking, pipelineStage]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  /** Convert placeIds to PlaceCardData[], sorted by user preferences */
  const resolvePlaces = useCallback((placeIds: string[]): PlaceCardData[] => {
    const rawCards = placeIds
      .map((id) => AI_PLACE_DATA[id])
      .filter(Boolean);

    if (!preferences) return rawCards;

    // Build PlaceSummary-compatible objects for scoring
    const asSummaries: PlaceSummary[] = rawCards.map((c) => ({
      place_id: c.id,
      name: c.name,
      address: c.address,
      distance_km: c.distance_km,
      price_level: c.price_level,
      rating: c.rating,
      rating_count: 100,
      recommendation_score: 0.5,
      status: "open_now",
      reason_tags: [],
    }));

    const sorted = sortByPreferences(asSummaries, preferences);
    return sorted.map((s) => AI_PLACE_DATA[s.place_id]).filter(Boolean);
  }, [preferences]);

  const processQuery = useCallback((queryText: string) => {
    setIsThinking(true);
    setPipelineStage("idle");
    clearTimers();

    const startDelay = 200;
    const t0 = window.setTimeout(() => setPipelineStage("intent_parsed"), startDelay);
    timersRef.current.push(t0);

    PIPELINE_SEQUENCE.forEach(({ stage, delay }) => {
      const t = window.setTimeout(() => setPipelineStage(stage), startDelay + delay);
      timersRef.current.push(t);
    });

    const totalDelay = startDelay + PIPELINE_SEQUENCE[PIPELINE_SEQUENCE.length - 1].delay + 400;
    const tFinal = window.setTimeout(() => {
      const lower = queryText.toLowerCase();
      const matched = AI_RESPONSES.find((r) => r.match !== "default" && lower.includes(r.match))
        || AI_RESPONSES.find((r) => r.match === "default")!;

      const sortedPlaces = resolvePlaces(matched.placeIds);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: matched.text,
        placeCards: sortedPlaces,
        showViewAll: sortedPlaces.length > 0,
        showPipeline: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
      setPipelineStage("idle");
    }, totalDelay);
    timersRef.current.push(tFinal);
  }, [resolvePlaces]);

  // Auto-send from URL query
  useEffect(() => {
    if (urlQuery && !hasAutoSent.current) {
      hasAutoSent.current = true;
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: urlQuery };
      setMessages((prev) => [...prev, userMsg]);
      processQuery(urlQuery);
    }
  }, [urlQuery, processQuery]);

  const sendMessage = () => {
    if (!input.trim() || isThinking) return;
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
                  <AgentPipeline stage="completed" isVisible />
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
                {msg.placeCards && (
                  <div className="mt-3 space-y-2">
                    {msg.placeCards.map((place) => (
                      <motion.div
                        key={place.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(`/place/${place.id}`)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 cursor-pointer hover:bg-secondary/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                          <p className="text-xs text-muted-foreground">{place.category} · {place.address}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-medium text-foreground">{place.rating}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* View All */}
                {msg.showViewAll && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/recommendations?q=${encodeURIComponent(urlQuery || "")}`)}
                    className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold w-full justify-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View All AI Recommendations
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
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2.5"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="max-w-[85%] w-full">
              <AgentPipeline stage={pipelineStage} isVisible />
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
            disabled={!input.trim() || isThinking}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
