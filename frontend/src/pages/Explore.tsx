import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, Bookmark, MessageCircle, Users } from "lucide-react";
import BottomTabBar from "@/components/BottomTabBar";
import ChatDrawer from "@/components/ChatDrawer";
import FlashDealBanner from "@/components/FlashDealBanner";
import QueueIndicator from "@/components/QueueIndicator";
import QueueDrawer from "@/components/QueueDrawer";
import VibeFilter, { PLACE_VIBES, type VibeTag } from "@/components/VibeFilter";
import NotificationCenter from "@/components/NotificationCenter";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import { useNotifications } from "@/hooks/useNotifications";
import type { FlashDeal } from "@/types";

const CATEGORIES = [
  { key: "all", label: "All", icon: "🔥" },
  { key: "barber", label: "Barber", icon: "✂️" },
  { key: "dining", label: "Dining", icon: "🍽" },
  { key: "coffee", label: "Coffee", icon: "☕" },
  { key: "car_wash", label: "Car Wash", icon: "🚗" },
  { key: "hotel", label: "Hotels", icon: "🏨" },
];

const ALL_PLACES: {
  id: string; name: string; category: string; address: string; rating: number;
  ratingCount: number; status: "open_now" | "closing_soon" | "closed";
  tags: string[]; priceLevel: string; flashDeal?: FlashDeal;
}[] = [
  { id: "p1", name: "The Ground Brew", category: "coffee", address: "12 Market Street", rating: 4.9, ratingCount: 2341, status: "open_now", tags: ["Minimalist design", "Strong espresso"], priceLevel: "$$", flashDeal: { title: "Espresso Happy Hour", discount: "-40%", expires_at: new Date(Date.now() + 3600000).toISOString(), remaining: 12 } },
  { id: "p2", name: "Komorebi Tables", category: "dining", address: "88 Oak Avenue", rating: 4.7, ratingCount: 1890, status: "closing_soon", tags: ["High-speed WiFi", "Quiet environment"], priceLevel: "$$" },
  { id: "p3", name: "Velvet Crumb", category: "coffee", address: "45 Elm Street", rating: 4.8, ratingCount: 3102, status: "open_now", tags: ["Artisanal sourdough", "Trending"], priceLevel: "$", flashDeal: { title: "Buy 2 Get 1 Free", discount: "3 for 2", expires_at: new Date(Date.now() + 1800000).toISOString(), remaining: 5 } },
  { id: "p4", name: "Origin Roast", category: "coffee", address: "200 Pine Road", rating: 4.6, ratingCount: 876, status: "open_now", tags: ["Near you", "Single origin"], priceLevel: "$" },
  { id: "p5", name: "The Sage Bistro", category: "dining", address: "Gastronomy Park, Central", rating: 4.8, ratingCount: 212, status: "open_now", tags: ["Farm-to-table", "Date night"], priceLevel: "$$$", flashDeal: { title: "Dinner Set Menu", discount: "-30%", expires_at: new Date(Date.now() + 7200000).toISOString(), remaining: 8 } },
  { id: "p6", name: "Blue Bottle Coffee", category: "coffee", address: "299 Copper Lane", rating: 4.3, ratingCount: 654, status: "closed", tags: ["Japanese minimal", "Pour-over"], priceLevel: "$$$" },
  { id: "p7", name: "Sharp Edge Barber", category: "barber", address: "22 Main St", rating: 4.7, ratingCount: 430, status: "open_now", tags: ["Walk-in welcome", "Classic cuts"], priceLevel: "$$" },
  { id: "p8", name: "The Gentleman's Cut", category: "barber", address: "55 Oak Blvd", rating: 4.5, ratingCount: 318, status: "open_now", tags: ["Beard grooming", "Hot towel"], priceLevel: "$$" },
  { id: "p9", name: "Fresh Auto Wash", category: "car_wash", address: "100 River Drive", rating: 4.2, ratingCount: 560, status: "open_now", tags: ["Express wash", "Eco-friendly"], priceLevel: "$", flashDeal: { title: "Premium Wash", discount: "-50%", expires_at: new Date(Date.now() + 2400000).toISOString(), remaining: 3 } },
  { id: "p10", name: "Grand View Hotel", category: "hotel", address: "1 Skyline Ave", rating: 4.9, ratingCount: 1205, status: "open_now", tags: ["Rooftop pool", "City view"], priceLevel: "$$$" },
];

const statusMap: Record<string, { label: string; color: string }> = {
  open_now: { label: "Open", color: "text-emerald-600" },
  closing_soon: { label: "Closing soon", color: "text-amber-600" },
  closed: { label: "Closed", color: "text-destructive" },
};

const placeholderColors = [
  "bg-amber-100 dark:bg-amber-900/30",
  "bg-orange-100 dark:bg-orange-900/30",
  "bg-rose-100 dark:bg-rose-900/30",
  "bg-stone-100 dark:bg-stone-900/30",
  "bg-emerald-100 dark:bg-emerald-900/30",
  "bg-sky-100 dark:bg-sky-900/30",
];

export default function Explore() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatTarget, setChatTarget] = useState<{ name: string; category: string } | null>(null);
  const [queueTarget, setQueueTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeVibes, setActiveVibes] = useState<VibeTag[]>([]);
  const { getQueueInfo, userQueue, joinQueue, leaveQueue } = useQueueStatus();
  const { notifications, unreadCount, latestPush, markRead, markAllRead, dismissToast } = useNotifications();

  const handleVibeToggle = (vibe: VibeTag) => {
    setActiveVibes((prev) => prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]);
  };

  const filtered = ALL_PLACES.filter((p) => {
    const matchCategory = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchVibe = activeVibes.length === 0 || activeVibes.some((v) => (PLACE_VIBES[p.id] || []).includes(v));
    return matchCategory && matchSearch && matchVibe;
  });

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Floating queue position banner */}
      {userQueue && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-0 left-0 right-0 z-40 safe-top"
        >
          <div
            className="mx-4 mt-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground flex items-center justify-between cursor-pointer shadow-lg"
            onClick={() => setQueueTarget({ id: userQueue.placeId, name: userQueue.placeName })}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-semibold">{userQueue.placeName}</span>
            </div>
            <span className="text-xs font-bold">#{userQueue.position} · ~{userQueue.estimatedWaitMinutes}min</span>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className={`flex-shrink-0 safe-top ${userQueue ? "mt-12" : ""}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Explore</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{filtered.length} nearby</span>
            </div>
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              latestPush={latestPush}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onDismissToast={dismissToast}
            />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search places, services..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <motion.button
              key={cat.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.key
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Vibe filter */}
      <div className="flex-shrink-0 px-4 pb-3">
        <VibeFilter activeVibes={activeVibes} onToggle={handleVibeToggle} />
      </div>

      {/* Results header */}
      <div className="flex-shrink-0 px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
          {filtered.length} places found
        </p>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence>
          {filtered.map((place, idx) => {
            const status = statusMap[place.status];
            const queueInfo = getQueueInfo(place.id);
            return (
              <motion.div
                key={place.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="mx-4 mb-1 cursor-pointer"
                onClick={() => navigate(`/place/${place.id}`)}
              >
                <div className="rounded-xl p-3 hover:bg-card/60 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${placeholderColors[idx % placeholderColors.length]} flex items-center justify-center`}>
                      <span className="text-lg opacity-60">{place.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-0.5">
                        <h4 className="font-semibold text-sm text-foreground leading-tight">{place.name}</h4>
                        <Bookmark className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {place.rating.toFixed(1)}
                        </span>
                        <span>·</span>
                        <span className={`font-medium ${status.color}`}>{status.label}</span>
                        {queueInfo && place.status !== "closed" && (
                          <>
                            <span>·</span>
                            <QueueIndicator
                              level={queueInfo.level}
                              waitMinutes={queueInfo.waitMinutes}
                              compact
                              onClick={(e) => {
                                e.stopPropagation();
                                setQueueTarget({ id: place.id, name: place.name });
                              }}
                            />
                          </>
                        )}
                      </div>
                      {/* Tags + Vibes */}
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {(PLACE_VIBES[place.id] || []).map((v) => (
                          <span key={v} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-primary/8 text-primary border border-primary/15">
                            {v}
                          </span>
                        ))}
                        {place.tags.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {place.tags.join(", ")}
                          </span>
                        )}
                      </div>
                      {/* Flash Deal */}
                      {place.flashDeal && (
                        <FlashDealBanner deal={place.flashDeal} variant="compact" />
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setChatTarget({ name: place.name, category: place.category }); }}
                          className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          Chat
                        </button>
                        {queueInfo && place.status !== "closed" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQueueTarget({ id: place.id, name: place.name });
                            }}
                            className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Users className="w-3 h-3" />
                            Queue
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No places found</p>
            <p className="text-xs mt-1">Try a different search or category</p>
          </div>
        )}
      </div>

      <ChatDrawer
        isOpen={!!chatTarget}
        onClose={() => setChatTarget(null)}
        placeName={chatTarget?.name || ""}
        placeCategory={chatTarget?.category || ""}
      />

      <QueueDrawer
        isOpen={!!queueTarget}
        onClose={() => setQueueTarget(null)}
        placeName={queueTarget?.name || ""}
        placeId={queueTarget?.id || ""}
        queueInfo={queueTarget ? getQueueInfo(queueTarget.id) : null}
        userQueue={userQueue}
        onJoin={() => queueTarget && joinQueue(queueTarget.id, queueTarget.name)}
        onLeave={leaveQueue}
      />

      <BottomTabBar />
    </div>
  );
}
