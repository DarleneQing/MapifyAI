import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MoreHorizontal, Search } from "lucide-react";
import PlaceCard from "@/components/PlaceCard";
import AgentPipeline from "@/components/AgentPipeline";
import BottomTabBar from "@/components/BottomTabBar";
import VibeFilter, { PLACE_VIBES, type VibeTag } from "@/components/VibeFilter";
import { useSearchStream } from "@/hooks/useSearchStream";
import { useLang } from "@/i18n/LanguageContext";
import { usePreferences } from "@/hooks/usePreferences";

const FILTER_CHIPS = ["For You", "Breakfast", "Quiet Spots", "Outdoor"];

export default function Recommendations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "coffee shops nearby";
  const [activeFilter, setActiveFilter] = useState("For You");
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const [activeVibes, setActiveVibes] = useState<VibeTag[]>([]);
  const { preferences } = usePreferences();
  const { results, isLoading, isStreaming, pipelineStage, startSearch } = useSearchStream(preferences);
  const { t } = useLang();

  useEffect(() => {
    startSearch(query, { lat: 31.2304, lng: 121.4737 });
  }, [query, startSearch]);

  const handleVibeToggle = (vibe: VibeTag) => {
    setActiveVibes((prev) => prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]);
  };

  const filteredResults = useMemo(() => {
    if (activeVibes.length === 0) return results;
    return results.filter((place) =>
      activeVibes.some((v) => (PLACE_VIBES[place.place_id] || []).includes(v))
    );
  }, [results, activeVibes]);

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/")}
            className="p-1"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </motion.button>
          <h1 className="text-base font-semibold text-foreground">AI Recommendations</h1>
          <motion.button whileTap={{ scale: 0.9 }} className="p-1">
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        </div>
      </div>

      {/* Search query display */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Looking for {query}...
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex-shrink-0 px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTER_CHIPS.map((chip) => (
            <motion.button
              key={chip}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveFilter(chip)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === chip
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {chip}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Vibe filter */}
      <div className="flex-shrink-0 px-4 pb-3">
        <VibeFilter activeVibes={activeVibes} onToggle={handleVibeToggle} compact />
      </div>

      {/* Results header */}
      <div className="flex-shrink-0 px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
          {t.resultsTitle}{activeVibes.length > 0 ? ` · ${filteredResults.length} matched` : ""}
        </p>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence>
          {(isStreaming || (pipelineStage !== "idle" && pipelineStage !== "completed")) && (
            <AgentPipeline stage={pipelineStage} isVisible />
          )}
        </AnimatePresence>

        {pipelineStage === "completed" && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10"
          >
            <p className="text-sm text-foreground">
              ✨ Based on your preferences, here are our <span className="font-semibold text-primary">{filteredResults.length} recommendations</span> for "{query}".
            </p>
          </motion.div>
        )}

        {isLoading && results.length === 0 ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="mx-4 mb-2">
              <div className="rounded-xl p-3 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <AnimatePresence>
            {filteredResults.map((place, idx) => (
              <motion.div
                key={place.place_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                <PlaceCard
                  place={place}
                  rank={idx + 1}
                  isActive={activePlace === place.place_id}
                  onSelect={() => setActivePlace(place.place_id)}
                  onDetail={() => navigate(`/place/${place.place_id}`)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && filteredResults.length === 0 && activeVibes.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm font-medium">No matches for selected vibes</p>
            <p className="text-xs mt-1">Try removing some vibe filters</p>
          </div>
        )}

        {isStreaming && results.length > 0 && (
          <div className="mx-4 mb-2">
            <div className="rounded-xl p-3 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
