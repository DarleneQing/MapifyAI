import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MoreHorizontal, Search } from "lucide-react";
import PlaceCard from "@/components/place/PlaceCard";
import FlashDealBanner from "@/components/place/FlashDealBanner";
import AgentPipeline from "@/components/chat/AgentPipeline";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useSearchStream, type PipelineStage } from "@/hooks/useSearchStream";
import { useLang } from "@/i18n/LanguageContext";
import { usePreferences } from "@/hooks/usePreferences";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useChatContext } from "@/contexts/ChatContext";
import type { PlaceSummary } from "@/types";

interface LocationState {
  query?: string;
  results?: PlaceSummary[];
}

type DemoDeal = {
  id: string;
  merchant_name: string;
  title: string;
  discount: string;
  expires_at: string;
  remaining: number;
};

// Frontend-local demo deals for display only.
const DEMO_DEALS: DemoDeal[] = [
  {
    id: "demo-deal-1",
    merchant_name: "Sage Corner Cafe",
    title: "Lunch Set Promo",
    discount: "20% off",
    expires_at: "Today 18:00",
    remaining: 6,
  },
  {
    id: "demo-deal-2",
    merchant_name: "Urban Noodle Bar",
    title: "Happy Hour Combo",
    discount: "Buy 2 get 1",
    expires_at: "Today 22:00",
    remaining: 5,
  },
  {
    id: "demo-deal-3",
    merchant_name: "Lakeview Bakery",
    title: "Weekend Special",
    discount: "15% off",
    expires_at: "Sun 23:59",
    remaining: 8,
  },
  {
    id: "demo-deal-4",
    merchant_name: "Nordic Grill",
    title: "Early Bird Offer",
    discount: "CHF 10 off",
    expires_at: "Tomorrow 11:00",
    remaining: 7,
  },
];

export default function Recommendations() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [searchParams] = useSearchParams();
  
  // Get persisted data from ChatContext
  const { lastSearchResults: contextResults, lastSearchQuery: contextQuery, setLastSearchResults } = useChatContext();
  
  // Get data from navigation state (passed from Chat) or URL params
  const locationState = routerLocation.state as LocationState | null;
  const passedResults = locationState?.results;
  const passedQuery = locationState?.query;
  const urlQuery = searchParams.get("q");
  
  // Priority: navigation state > context > URL params
  const query = passedQuery || contextQuery || urlQuery;
  
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const { preferences } = usePreferences();
  const { results: apiResults, isLoading, isStreaming, pipelineStage: apiPipelineStage, startSearch } = useSearchStream(preferences);
  const { t } = useLang();
  const { location } = useDeviceLocation();
  const searchedQueryRef = useRef<string | null>(null);

  // Priority for results: navigation state > context > API results
  const availableResults = passedResults && passedResults.length > 0 
    ? passedResults 
    : contextResults && contextResults.length > 0 
      ? contextResults 
      : apiResults;
  
  const results = availableResults;
  const hasPersistedResults = (passedResults && passedResults.length > 0) || (contextResults && contextResults.length > 0);
  const pipelineStage: PipelineStage = hasPersistedResults ? "completed" : apiPipelineStage;

  // Store results in context when they come from navigation state (for persistence across tabs)
  useEffect(() => {
    if (passedResults && passedResults.length > 0 && contextResults.length === 0) {
      setLastSearchResults(passedResults);
    }
  }, [passedResults, contextResults.length, setLastSearchResults]);

  // Only call API if no results available from any source
  useEffect(() => {
    if (!hasPersistedResults && query && location && searchedQueryRef.current !== query) {
      searchedQueryRef.current = query;
      startSearch(query, location);
    }
  }, [hasPersistedResults, query, location, startSearch]);

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

      {/* Results header */}
      <div className="flex-shrink-0 px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
          {t.resultsTitle}
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
              ✨ Based on your preferences, here are our <span className="font-semibold text-primary">{results.length} recommendations</span> for "{query}".
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
            {results.map((place, idx) => (
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

        {!isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm font-medium">No matches for selected vibes</p>
            <p className="text-xs mt-1">Try removing some vibe filters</p>
          </div>
        )}

        {/* Separate demo-only deals section; independent from live recommendation results */}
        <div className="mx-4 mt-4 mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-2">
            Featured Deals (Demo)
          </p>
          <div className="space-y-2">
            {DEMO_DEALS.map((deal) => (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/60 bg-card p-3"
              >
                <p className="text-sm font-semibold text-foreground">{deal.merchant_name}</p>
                <FlashDealBanner
                  deal={{
                    title: deal.title,
                    discount: deal.discount,
                    expires_at: deal.expires_at,
                    remaining: deal.remaining,
                  }}
                  variant="compact"
                />
              </motion.div>
            ))}
          </div>
        </div>

        {!query && !hasPersistedResults && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No search query</p>
            <p className="text-xs mt-1">Start a search from the home page to see recommendations</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/")}
              className="mt-4 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              Go to Home
            </motion.button>
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
