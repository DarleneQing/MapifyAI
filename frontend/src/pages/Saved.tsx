import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, MapPin, Clock, MessageCircle, Bookmark, Users, Undo2 } from "lucide-react";
import BottomTabBar from "@/components/layout/BottomTabBar";
import ChatDrawer from "@/components/chat/ChatDrawer";
import FlashDealBanner from "@/components/place/FlashDealBanner";
import QueueIndicator from "@/components/place/QueueIndicator";
import QueueDrawer from "@/components/place/QueueDrawer";
import { PLACE_VIBES } from "@/components/explore/VibeFilter";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import { useSavedPlaces, type SavedPlace } from "@/contexts/SavedPlacesContext";
import type { FlashDeal } from "@/types";

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
];

export default function Saved() {
  const navigate = useNavigate();
  const [chatTarget, setChatTarget] = useState<{ name: string; category: string } | null>(null);
  const [queueTarget, setQueueTarget] = useState<{ id: string; name: string } | null>(null);
  const { getQueueInfo, userQueue, joinQueue, leaveQueue } = useQueueStatus();
  const { savedPlaces, removeSaved, toggleSave } = useSavedPlaces();
  const [undoItem, setUndoItem] = useState<SavedPlace | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRemove = (place: SavedPlace) => {
    removeSaved(place.id);
    setUndoItem(place);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 4000);
  };

  const handleUndo = () => {
    if (undoItem) {
      toggleSave(undoItem);
      setUndoItem(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="flex-shrink-0 safe-top border-b border-border/50">
        <div className="flex items-center justify-center px-5 py-3">
          <h1 className="text-base font-semibold text-foreground">Saved Places</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {savedPlaces.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Bookmark className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No saved places yet</p>
            <p className="text-xs mt-1">Tap the ♡ or bookmark icon to save places</p>
          </div>
        )}
        {savedPlaces.map((place, idx) => {
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
                      <button onClick={(e) => { e.stopPropagation(); handleRemove(place); }}>
                        <Bookmark className="w-3.5 h-3.5 text-primary fill-primary flex-shrink-0 mt-0.5" />
                      </button>
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
                    {/* Vibe tags + reason tags */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatTarget({ name: place.name, category: place.category });
                        }}
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

      {/* Undo snackbar */}
      <AnimatePresence>
        {undoItem && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-4 right-4 z-40 flex items-center justify-between px-4 py-3 rounded-2xl bg-foreground text-background shadow-lg"
          >
            <span className="text-sm font-medium">Removed "{undoItem.name}"</span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              <Undo2 className="w-3 h-3" />
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomTabBar />
    </div>
  );
}
