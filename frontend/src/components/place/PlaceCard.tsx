import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Star, Bookmark, MessageCircle, Zap, Train, Bus, Footprints, MapPin, Banknote } from "lucide-react";
import FlashDealBanner from "@/components/place/FlashDealBanner";
import type { PlaceSummary } from "@/types";
import { useLang } from "@/i18n/LanguageContext";
import { PLACE_VIBES } from "@/components/explore/VibeFilter";
import { useSavedPlaces } from "@/contexts/SavedPlacesContext";
import { useQueueStatus } from "@/hooks/useQueueStatus";

interface PlaceCardProps {
  place: PlaceSummary;
  rank: number;
  isActive: boolean;
  onSelect: () => void;
  onDetail: () => void;
}

export default function PlaceCard({ place, rank, isActive, onSelect, onDetail }: PlaceCardProps) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedPlaces();
  const { getQueueInfo } = useQueueStatus();
  const saved = isSaved(place.place_id);


  const statusMap: Record<string, { label: string; color: string }> = {
    open_now: { label: t.open, color: "text-emerald-600" },
    closing_soon: { label: t.closingSoon, color: "text-amber-600" },
    closed: { label: t.closed, color: "text-destructive" },
  };

  const status = statusMap[place.status] ?? { label: place.status, color: "text-muted-foreground" };

  const placeholderColors = [
    "bg-amber-100 dark:bg-amber-900/30",
    "bg-orange-100 dark:bg-orange-900/30",
    "bg-rose-100 dark:bg-rose-900/30",
    "bg-stone-100 dark:bg-stone-900/30",
    "bg-emerald-100 dark:bg-emerald-900/30",
    "bg-sky-100 dark:bg-sky-900/30",
  ];

  return (
    <>
      <motion.div
        className="mx-4 mb-1 cursor-pointer"
        whileTap={{ scale: 0.98 }}
        onClick={onDetail}
        layout
      >
        <div
          className={`rounded-xl p-3 transition-all duration-200 ${
            isActive
              ? "bg-card ring-1 ring-primary/20 shadow-sm"
              : "bg-transparent hover:bg-card/60"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <div className={`w-12 h-12 rounded-xl ${placeholderColors[(rank - 1) % placeholderColors.length]} flex items-center justify-center overflow-hidden`}>
                <span className="text-lg opacity-60">{place.name.charAt(0)}</span>
              </div>
              {place.flash_deal && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center animate-pulse">
                  <Zap className="w-3 h-3 text-destructive-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-0.5">
                <h4 className="font-semibold text-sm text-foreground leading-tight">{place.name}</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const q = getQueueInfo(place.place_id);
                    toggleSave({
                      id: place.place_id,
                      name: place.name,
                      rating: place.rating,
                      category: "Place",
                      address: place.address,
                      priceLevel: place.price_level || "",
                      status: place.status as "open_now" | "closing_soon" | "closed",
                      tags: place.reason_tags?.slice(0, 2) || [],
                      savedAt: "Just now",
                      queueSnapshot: q ? { level: q.level, waitMinutes: q.waitMinutes, peopleAhead: q.peopleAhead } : undefined,
                    });
                  }}
                  className="flex-shrink-0 mt-0.5"
                >
                  <Bookmark className={`w-3.5 h-3.5 transition-colors ${saved ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  {place.rating.toFixed(1)}
                </span>
                <span>·</span>
                <span className={`font-medium ${status.color}`}>{status.label}</span>
              </div>

              {/* Vibe tags */}
              {(PLACE_VIBES[place.place_id] || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {(PLACE_VIBES[place.place_id] || []).map((v) => (
                    <span key={v} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-primary/8 text-primary border border-primary/15 capitalize">
                      {v.replace("-", " ")}
                    </span>
                  ))}
                </div>
              )}

              {/* Distance · Price · Transit (one line, above summary) */}
              {(typeof place.distance_km === "number" || place.price_level || place.transit) && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
                  {typeof place.distance_km === "number" && (
                    <>
                      <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                      <span>{place.distance_km.toFixed(1)} km</span>
                    </>
                  )}
                  {typeof place.distance_km === "number" && (place.price_level || place.transit) && <span className="text-muted-foreground/60">·</span>}
                  {place.price_level && (
                    <>
                      <Banknote className="w-3 h-3 text-primary flex-shrink-0" />
                      <span>{place.price_level}</span>
                    </>
                  )}
                  {place.price_level && place.transit && <span className="text-muted-foreground/60">·</span>}
                  {place.transit && (
                    <>
                      {place.transit.transport_types?.map((t, i) => (
                        <span key={i} className="text-primary">
                          {t === "tram" || t === "train" ? <Train className="w-3 h-3 inline" /> :
                           t === "bus" ? <Bus className="w-3 h-3 inline" /> :
                           <Footprints className="w-3 h-3 inline" />}
                        </span>
                      ))}
                      <span>{place.transit.summary || `${place.transit.duration_minutes} min`}</span>
                    </>
                  )}
                </div>
              )}

              {/* Matches your priority (from reason_tags) */}
              {(() => {
                const priorityReason = place.reason_tags?.find((r) => r.startsWith("Matches your priority:"));
                return priorityReason ? (
                  <p className="text-[11px] text-primary font-medium mt-1">{priorityReason}</p>
                ) : null;
              })()}

              {/* Summary: orchestrator one_sentence_recommendation (per backend_llm_integration_analysis) when present, else review summary or reason_tags */}
              {(place.one_sentence_recommendation || place.review_summary_text || (place.reason_tags?.length ?? 0) > 0) && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  {place.one_sentence_recommendation ? (
                    place.one_sentence_recommendation
                  ) : place.review_summary_text ? (
                    place.review_summary_text
                  ) : (
                    <>
                      <span className="font-medium text-foreground/70">{t.whyThis}</span>{" "}
                      {place.reason_tags?.join(", ") ?? ""}.
                    </>
                  )}
                </p>
              )}

              {/* Flash Deal Banner */}
              {place.flash_deal && (
                <FlashDealBanner deal={place.flash_deal} variant="compact" />
              )}

              {/* Queue Status */}
              {place.queue_status && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    place.queue_status === "low" ? "bg-emerald-500" :
                    place.queue_status === "medium" ? "bg-amber-500" : "bg-destructive"
                  }`} />
                  <span className="text-[11px] text-muted-foreground">
                    {place.queue_status === "low" ? "No wait" :
                     place.queue_status === "medium" ? "~10 min wait" : "Busy · ~25 min"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/chat");
                  }}
                  className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
