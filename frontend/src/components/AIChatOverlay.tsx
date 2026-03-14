import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, ArrowRight, User, MapPin, Star,
  BarChart3, Zap, Clock, Users, TrendingUp, CalendarCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skills?: Skill[];
  placeCards?: PlaceCardData[];
  tips?: string[];
};

type Skill = { label: string; icon: string };
type PlaceCardData = {
  id: string;
  name: string;
  rating: number;
  category: string;
  address: string;
};

// ── Consumer skills ──
const CONSUMER_SKILLS: Skill[] = [
  { label: "Find Places", icon: "🔍" },
  { label: "Book Table", icon: "📅" },
  { label: "Get Directions", icon: "🗺" },
  { label: "Compare Prices", icon: "💰" },
];

// ── Merchant skills ──
const MERCHANT_SKILLS: Skill[] = [
  { label: "Today's Summary", icon: "📊" },
  { label: "Best Deal Timing", icon: "⏰" },
  { label: "Queue Advice", icon: "👥" },
  { label: "Boost Tips", icon: "🚀" },
];

// ── Merchant AI mock responses ──
const MERCHANT_RESPONSES: { match: string; text: string; tips?: string[] }[] = [
  {
    match: "summary",
    text: "📊 **Today's Dashboard Summary**\n\nYou had **342 views** today (+12% vs yesterday), completed **28 transactions** generating **CHF 1,240** in revenue. Your queue peaked at 7 people around 12:30.\n\n**Key insight:** Your afternoon traffic (2–4 PM) is 35% lower than the morning. Consider a flash deal to boost it!",
    tips: ["Afternoon flash deal could increase PM revenue by ~20%", "Queue wait time averaged 12 min — within healthy range"],
  },
  {
    match: "deal",
    text: "⏰ **Optimal Deal Timing Analysis**\n\nBased on your traffic patterns:\n\n• **Best time for flash deals:** 14:00–16:00 (low traffic window, deals can boost footfall by 25–40%)\n• **Avoid:** 11:30–13:00 (already at peak capacity)\n• **Weekend tip:** Saturday 10:00–11:00 is underserved — a breakfast combo deal could work well\n\n**Recommended:** Start with a 2-hour flash deal at 20–30% off during 14:00–16:00 on weekdays.",
    tips: ["20-30% discount is the sweet spot — higher doesn't convert better", "2-hour window creates urgency without hurting margins"],
  },
  {
    match: "queue",
    text: "👥 **Queue & Reservation Advice**\n\nCurrent patterns show:\n\n• **Average wait:** 12 min (good — under 15 min keeps satisfaction high)\n• **Drop-off risk:** When wait exceeds 20 min, ~30% of customers leave\n• **Suggestion:** Enable reservations for the 12:00–13:30 rush to reduce walk-in pressure\n\n**Pro tip:** Send a push notification when queue drops below 3 — nearby users who hesitated will come back!",
    tips: ["Consider opening reservations for lunch rush", "Auto-notify nearby users when queue is short"],
  },
  {
    match: "boost",
    text: "🚀 **Tips to Boost Your Visibility**\n\n1. **Update your photos** — listings with 5+ photos get 2x more views\n2. **Reply to reviews** — response rate affects your ranking score\n3. **Set your vibe tags** — \"study-friendly\" and \"quiet\" are trending in your area\n4. **Flash deals** on Tuesdays & Wednesdays (your slowest days) can lift traffic 30%\n\n**Quick win:** Add \"Free WiFi\" and \"Power outlets\" tags — searches for these are up 45% this month.",
    tips: ["Photo updates are the highest-ROI action", "Tuesday flash deals have 30% higher redemption"],
  },
  {
    match: "default",
    text: "I'm your merchant AI assistant! I can help with:\n\n• 📊 **Daily summaries** of your dashboard metrics\n• ⏰ **Deal timing** — when to publish flash deals for max impact\n• 👥 **Queue management** — when to accept walk-ins vs reservations\n• 🚀 **Growth tips** — how to boost visibility and revenue\n\nWhat would you like to know?",
  },
];

// ── Consumer AI mock responses ──
const CONSUMER_RESPONSES: { match: string; text: string; places?: PlaceCardData[] }[] = [
  {
    match: "coffee",
    text: "I found some great coffee spots near you! Here are my top picks:",
    places: [
      { id: "p1", name: "The Ground Brew", rating: 4.9, category: "Coffee", address: "12 Market Street" },
      { id: "p3", name: "Velvet Crumb", rating: 4.8, category: "Bakery & Coffee", address: "45 Elm Street" },
    ],
  },
  {
    match: "restaurant",
    text: "Here are some highly-rated restaurants nearby:",
    places: [
      { id: "p5", name: "The Sage Bistro", rating: 4.8, category: "Fine Dining", address: "Gastronomy Park" },
    ],
  },
  {
    match: "barber",
    text: "I found barber shops nearby with availability today:",
    places: [
      { id: "p7", name: "Scissors & Style", rating: 4.5, category: "Barber", address: "15 Main Street" },
    ],
  },
  {
    match: "default",
    text: "I'd be happy to help! I can find places, make bookings, compare prices, or get directions. What are you looking for?",
  },
];

export default function AIChatOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isMerchant } = useAuth();

  const initialMessages: Message[] = [
    {
      id: "1",
      role: "assistant",
      content: isMerchant
        ? `Hi ${user?.shopName || "there"}! 👋 I'm your merchant AI assistant. How can I help you run your business today?`
        : "Hi! 👋 I'm your AI Agent. How can I help you today?",
      skills: isMerchant ? MERCHANT_SKILLS : CONSUMER_SKILLS,
    },
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset messages when role changes
  useEffect(() => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: isMerchant
          ? `Hi ${user?.shopName || "there"}! 👋 I'm your merchant AI assistant. How can I help you run your business today?`
          : "Hi! 👋 I'm your AI Agent. How can I help you today?",
        skills: isMerchant ? MERCHANT_SKILLS : CONSUMER_SKILLS,
      },
    ]);
  }, [isMerchant, user?.shopName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const findMerchantResponse = (query: string) => {
    const q = query.toLowerCase();
    return (
      MERCHANT_RESPONSES.find(
        (r) =>
          r.match !== "default" &&
          (q.includes(r.match) ||
            (r.match === "summary" && (q.includes("overview") || q.includes("today") || q.includes("report") || q.includes("数据") || q.includes("总结"))) ||
            (r.match === "deal" && (q.includes("coupon") || q.includes("优惠") || q.includes("秒杀") || q.includes("flash") || q.includes("timing") || q.includes("when"))) ||
            (r.match === "queue" && (q.includes("wait") || q.includes("排队") || q.includes("reservation") || q.includes("预定") || q.includes("walk-in"))) ||
            (r.match === "boost" && (q.includes("grow") || q.includes("visibility") || q.includes("tip") || q.includes("improve") || q.includes("建议"))))
      ) || MERCHANT_RESPONSES.find((r) => r.match === "default")!
    );
  };

  const sendMessage = () => {
    if (!input.trim() || isTyping) return;
    const query = input.trim();
    setInput("");

    // For consumer users, redirect to recommendations
    if (!isMerchant) {
      setIsOpen(false);
      navigate(`/recommendations?q=${encodeURIComponent(query)}`);
      return;
    }

    // For merchant users, respond in-chat
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const resp = findMerchantResponse(query);
      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: resp.text,
        tips: resp.tips,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  const handleSkillClick = (skill: Skill) => {
    if (isMerchant) {
      // For merchants, auto-send the skill as a query
      const query = skill.label;
      const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: query };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      setTimeout(() => {
        const resp = findMerchantResponse(query);
        const assistantMsg: Message = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: resp.text,
          tips: resp.tips,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      }, 1200 + Math.random() * 800);
    } else {
      setInput(skill.label);
    }
  };

  const handlePlaceClick = (placeId: string) => {
    setIsOpen(false);
    navigate(`/place/${placeId}`);
  };

  // Show FAB on merchant dashboard too
  const hideFAB =
    !isMerchant && (location.pathname === "/" || location.pathname === "/chat");
  const showExploreHide = location.pathname === "/" && !isMerchant;
  
  // On recommendations page, FAB should navigate back to chat (to preserve conversation)
  const shouldNavigateToChat = location.pathname === "/recommendations" && !isMerchant;

  const handleFABClick = () => {
    if (shouldNavigateToChat) {
      navigate("/chat");
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && !hideFAB && location.pathname !== "/chat" && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleFABClick}
            className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center"
            style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.4)" }}
          >
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            />

            {/* Chat Panel */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 h-[85dvh] bg-background rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">
                    {isMerchant ? "Merchant Assistant" : "AI Agent"}
                  </h2>
                  {isMerchant && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      PRO
                    </span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-card border border-border/60 text-foreground rounded-bl-md"
                          }`}
                        >
                          {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                            part.startsWith("**") && part.endsWith("**") ? (
                              <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </div>

                        {/* Tips (merchant) */}
                        {msg.tips && msg.tips.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {msg.tips.map((tip, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10"
                              >
                                <TrendingUp className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-foreground/80">{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}

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
                                onClick={() => handlePlaceClick(place.id)}
                                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 cursor-pointer hover:bg-secondary/50 transition-colors"
                              >
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {place.category} · {place.address}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span className="text-xs font-medium text-foreground">{place.rating}</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
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

                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border/60">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                )}
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
                    placeholder={isMerchant ? "Ask about your business..." : "Ask anything..."}
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
    </>
  );
}
