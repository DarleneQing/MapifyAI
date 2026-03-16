import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Star, Bookmark, MessageCircle, Users, Search } from "lucide-react";
import BottomTabBar from "@/components/layout/BottomTabBar";
import ChatDrawer from "@/components/chat/ChatDrawer";
import FlashDealBanner from "@/components/place/FlashDealBanner";
import QueueIndicator from "@/components/place/QueueIndicator";
import QueueDrawer from "@/components/place/QueueDrawer";
import { placeMatchesVibes, PLACE_VIBES, type VibeTag } from "@/components/explore/VibeFilter";
import NotificationCenter from "@/components/layout/NotificationCenter";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import { useNotifications } from "@/hooks/useNotifications";
import { getExplorePlaces, getMerchantIdsWithDiscount, getDealForPlaceId } from "@/data/providers";

// Real Zurich providers (crawled data from backend seed)
const ALL_PLACES = getExplorePlaces();
const MERCHANT_IDS_WITH_DISCOUNT = getMerchantIdsWithDiscount();

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
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatTarget, setChatTarget] = useState<{ name: string; category: string } | null>(null);
  const [queueTarget, setQueueTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeVibes, setActiveVibes] = useState<VibeTag[]>([]);
  const { getQueueInfo, userQueue, joinQueue, leaveQueue } = useQueueStatus();
  const { notifications, unreadCount, latestPush, markRead, markAllRead, dismissToast } = useNotifications();

  // Sync keyword from URL (e.g. when navigating from home with AI search off)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null && q !== "") setSearchQuery(q);
  }, [searchParams]);

  const handleVibeToggle = (vibe: VibeTag) => {
    setActiveVibes((prev) => prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]);
  };

  const hasSearch = searchQuery.trim().length > 0;
  const candidatePlaces = hasSearch
    ? ALL_PLACES
    : ALL_PLACES.filter((p) => MERCHANT_IDS_WITH_DISCOUNT.has(p.id)).map((p) => {
        const deal = getDealForPlaceId(p.id);
        return deal ? { ...p, flashDeal: deal } : p;
      });

  const filtered = candidatePlaces.filter((p) => {
    const matchCategory = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchVibe = placeMatchesVibes(p.id, activeVibes);
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

      {/* Results header */}
      <div className="flex-shrink-0 px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
          {hasSearch ? `${filtered.length} places found` : `${filtered.length} stores with discounts`}
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
