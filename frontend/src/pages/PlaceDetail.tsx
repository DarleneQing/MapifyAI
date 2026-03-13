import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft, Share2, Heart, Star, MapPin, CheckCircle2,
  AlertCircle, Clock, Gavel, MessageSquare, Users, Phone,
  Globe, ExternalLink, Navigation, ChevronDown, ChevronUp,
  Facebook, Instagram, Train, Bus, Footprints,
} from "lucide-react";
import BidDrawer from "@/components/BidDrawer";
import ChatDrawer from "@/components/ChatDrawer";
import FlashDealBanner from "@/components/FlashDealBanner";
import QueueIndicator from "@/components/QueueIndicator";
import QueueDrawer from "@/components/QueueDrawer";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import RatingDistributionChart from "@/components/RatingDistributionChart";
import ReviewsList from "@/components/ReviewsList";
import PopularTimesChart from "@/components/PopularTimesChart";
import type { PlaceDetail as PlaceDetailType, FlashDeal, PlaceDetailResponse } from "@/types";
import { getPlaceDetail } from "@/services/api";
import { useSavedPlaces } from "@/contexts/SavedPlacesContext";

// ── Mock detail data aligned with PlaceDetail contract ──
const MOCK_DETAILS: Record<string, PlaceDetailResponse> = {
  p1: {
    request_id: null,
    detail: {
      place: {
        place_id: "p1",
        name: "The Ground Brew",
        address: "12 Market Street, Downtown",
        phone: "+41 44 123 45 67",
        website: "https://thegroundbrew.ch",
        location: { lat: 47.3785, lng: 8.5405 },
        rating: 4.9,
        rating_count: 2341,
        price_level: "medium",
        status: "open_now",
        opening_hours: { today_open: "07:00", today_close: "19:00", is_open_now: true },
        social_profiles: { instagram: "https://instagram.com/thegroundbrew" },
        popular_times: {
          mon: [5, 20, 45, 70, 85, 60, 40, 25, 10],
          tue: [5, 15, 40, 65, 80, 55, 35, 20, 10],
          wed: [5, 25, 50, 75, 90, 65, 45, 30, 10],
          thu: [5, 20, 45, 70, 85, 60, 40, 25, 10],
          fri: [10, 30, 55, 80, 95, 70, 50, 35, 15],
          sat: [15, 35, 60, 85, 95, 75, 55, 40, 20],
          sun: [10, 25, 40, 55, 65, 50, 35, 20, 10],
        },
        detailed_characteristics: ["Minimalist design", "Wheelchair accessible", "Outdoor seating"],
      },
      review_summary: {
        advantages: ["Exceptional single-origin espresso", "Minimalist Scandinavian interior design", "Friendly and knowledgeable baristas"],
        disadvantages: ["Limited seating during peak hours", "No food menu beyond pastries"],
        star_reasons: {
          five_star: ["Best espresso in town", "Perfect ambiance for work"],
          one_star: ["Crowded on weekends"],
        },
      },
      rating_distribution: { "1": 12, "2": 28, "3": 95, "4": 820, "5": 1386 },
      questions_and_answers: [
        { question: "Do you have Wi-Fi?", answer: "Yes, free high-speed Wi-Fi for all customers." },
        { question: "Is there outdoor seating?", answer: "Yes, we have a small terrace." },
      ],
      customer_updates: [
        { text: "New seasonal menu available starting March!", language: "en" },
      ],
      recommendation_reasons: ["Closest high-rated café", "Matches your preference for quiet spots", "Within walking distance"],
    },
  },
  p2: {
    request_id: null,
    detail: {
      place: {
        place_id: "p2", name: "Komorebi Tables", address: "88 Oak Avenue, Midtown",
        phone: "+41 44 234 56 78", website: "https://komorebitables.ch",
        location: { lat: 47.3755, lng: 8.5445 },
        rating: 4.7, rating_count: 1890, price_level: "medium", status: "closing_soon",
        opening_hours: { today_open: "08:00", today_close: "18:00", is_open_now: true },
        social_profiles: { facebook: "https://facebook.com/komorebitables" },
        popular_times: { mon: [5, 15, 35, 60, 75, 50, 30, 15, 5], tue: [5, 20, 40, 65, 80, 55, 35, 20, 5] },
        detailed_characteristics: ["High-speed WiFi", "Quiet environment", "Power outlets at every seat"],
      },
      review_summary: {
        advantages: ["High-speed WiFi throughout", "Very quiet environment for work", "Great tea selection"],
        disadvantages: ["Menu options are limited", "Can feel empty on weekdays"],
        star_reasons: { five_star: ["Perfect coworking spot"], one_star: ["Limited food options"] },
      },
      rating_distribution: { "1": 8, "2": 22, "3": 110, "4": 680, "5": 1070 },
      recommendation_reasons: ["Best WiFi among nearby cafés", "Quiet atmosphere matches your vibe"],
    },
  },
  p3: {
    request_id: null,
    detail: {
      place: {
        place_id: "p3", name: "Velvet Crumb", address: "45 Elm Street, West End",
        phone: "+41 44 345 67 89", website: null,
        location: { lat: 47.3800, lng: 8.5350 },
        rating: 4.8, rating_count: 3102, price_level: "low", status: "open_now",
        opening_hours: { today_open: "06:30", today_close: "17:00", is_open_now: true },
        popular_times: { mon: [10, 30, 60, 85, 90, 65, 40, 20, 5] },
        detailed_characteristics: ["Artisanal sourdough", "Trending", "Takeaway friendly"],
      },
      review_summary: {
        advantages: ["Award-winning artisanal sourdough", "Currently trending in the area", "Very affordable prices"],
        disadvantages: ["Can get crowded on weekends", "Small indoor space"],
        star_reasons: { five_star: ["Amazing bread", "Great value"], one_star: ["Too crowded"] },
      },
      rating_distribution: { "1": 15, "2": 35, "3": 150, "4": 1100, "5": 1802 },
      recommendation_reasons: ["Trending bakery near you", "Budget-friendly option"],
    },
  },
  p4: {
    request_id: null,
    detail: {
      place: {
        place_id: "p4", name: "Origin Roast", address: "200 Pine Road, Riverside",
        phone: null, website: "https://originroast.ch",
        location: { lat: 47.3745, lng: 8.5470 },
        rating: 4.6, rating_count: 876, price_level: "low", status: "open_now",
        opening_hours: { today_open: "07:30", today_close: "16:00", is_open_now: true },
        detailed_characteristics: ["Single origin", "Pour-over specialty"],
      },
      review_summary: {
        advantages: ["Within 200m of your location", "Excellent single-origin selection"],
        disadvantages: ["Small space, takeaway recommended"],
        star_reasons: { five_star: ["Unique coffee beans"], one_star: ["Too small"] },
      },
      rating_distribution: { "1": 5, "2": 12, "3": 60, "4": 350, "5": 449 },
      recommendation_reasons: ["Closest café to you", "Matches your coffee preference"],
    },
  },
  p5: {
    request_id: null,
    detail: {
      place: {
        place_id: "p5", name: "The Sage Bistro", address: "Gastronomy Park, Zürich",
        phone: "+41 44 567 89 01", website: "https://sagebistro.ch",
        location: { lat: 47.3730, lng: 8.5330 },
        rating: 4.8, rating_count: 212, price_level: "high", status: "open_now",
        opening_hours: { today_open: "11:00", today_close: "23:00", is_open_now: true },
        social_profiles: { instagram: "https://instagram.com/sagebistro", facebook: "https://facebook.com/sagebistro" },
        popular_times: { fri: [5, 10, 25, 45, 70, 90, 95, 85, 60], sat: [5, 10, 30, 50, 75, 95, 95, 85, 65] },
        detailed_characteristics: ["Farm-to-table", "Date night", "Reservation recommended"],
      },
      review_summary: {
        advantages: ["Incredible farm-to-table seasonal menu", "Atmospheric lighting perfect for dates", "Excellent wine selection"],
        disadvantages: ["Booking essential for weekend dinner", "Higher price point"],
        star_reasons: { five_star: ["Perfect date spot", "Exceptional cuisine"], one_star: ["Expensive"] },
      },
      rating_distribution: { "1": 2, "2": 5, "3": 15, "4": 60, "5": 130 },
      recommendation_reasons: ["Top farm-to-table for special occasions", "Great for date nights"],
    },
  },
  p6: {
    request_id: null,
    detail: {
      place: {
        place_id: "p6", name: "Blue Bottle Coffee", address: "299 Copper Lane, Uptown",
        phone: null, website: "https://bluebottlecoffee.com",
        location: { lat: 47.3820, lng: 8.5490 },
        rating: 4.3, rating_count: 654, price_level: "high", status: "closed",
        opening_hours: { today_open: "08:00", today_close: "17:00", is_open_now: false },
        detailed_characteristics: ["Japanese minimal", "Pour-over"],
      },
      review_summary: {
        advantages: ["Japanese minimalist aesthetic", "Expert pour-over technique"],
        disadvantages: ["Currently closed, check hours", "Premium pricing"],
        star_reasons: { five_star: ["Beautiful space", "Artisan coffee"], one_star: ["Overpriced"] },
      },
      rating_distribution: { "1": 20, "2": 35, "3": 80, "4": 250, "5": 269 },
      recommendation_reasons: ["Premium Japanese-style pour-over"],
    },
  },
};

// Flash deal data (kept separate for frontend-only features)
const FLASH_DEALS: Record<string, FlashDeal> = {
  p1: { title: "Espresso Happy Hour", discount: "-40%", expires_at: new Date(Date.now() + 3600000).toISOString(), remaining: 12 },
  p3: { title: "Buy 2 Get 1 Free", discount: "3 for 2", expires_at: new Date(Date.now() + 1800000).toISOString(), remaining: 5 },
  p5: { title: "Dinner Set Menu", discount: "-30%", expires_at: new Date(Date.now() + 7200000).toISOString(), remaining: 8 },
};

const BIDDING_PLACES = ["p1", "p3", "p5", "p7", "p8"];

const heroGradients = [
  "from-amber-800/80 via-amber-700/60 to-amber-900/80",
  "from-stone-700/80 via-stone-600/60 to-stone-800/80",
  "from-emerald-800/80 via-emerald-700/60 to-emerald-900/80",
];

const PRICE_DISPLAY: Record<string, string> = { low: "$", medium: "$$", high: "$$$" };

const transportIcon = (type: string) => {
  switch (type) {
    case "tram": case "train": return <Train className="w-3 h-3" />;
    case "bus": return <Bus className="w-3 h-3" />;
    case "walk": return <Footprints className="w-3 h-3" />;
    default: return null;
  }
};

export default function PlaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bidOpen, setBidOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [detail, setDetail] = useState<PlaceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const { getQueueInfo, userQueue, joinQueue, leaveQueue } = useQueueStatus();
  const { isSaved, toggleSave } = useSavedPlaces();

  const requestId = searchParams.get("request_id");
  const hasBidding = BIDDING_PLACES.includes(id || "");
  const flashDeal = FLASH_DEALS[id || ""];

  // Try fetching from API, fall back to mock
  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
      setLoading(true);
      try {
        const res = await getPlaceDetail(id || "", requestId || undefined);
        if (!cancelled) {
          setDetail(res.detail);
          setLoading(false);
        }
      } catch {
        // Fall back to mock
        const mock = MOCK_DETAILS[id || ""] || MOCK_DETAILS.p5;
        if (!cancelled) {
          setDetail(mock.detail);
          setLoading(false);
        }
      }
    }
    fetchDetail();
    return () => { cancelled = true; };
  }, [id, requestId]);

  if (loading || !detail) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const { place, review_summary, rating_distribution, recommendation_reasons, questions_and_answers, customer_updates } = detail;
  const gradientIdx = (id?.charCodeAt(1) || 0) % heroGradients.length;

  const statusMap: Record<string, { label: string; color: string }> = {
    open_now: { label: "Open Now", color: "text-emerald-600" },
    closing_soon: { label: "Closing Soon", color: "text-amber-600" },
    closed: { label: "Closed", color: "text-destructive" },
  };
  const status = statusMap[place.status] ?? { label: place.status, color: "text-muted-foreground" };

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`, "_blank");
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-y-auto">
      {/* Hero Image Area */}
      <div className="relative h-72 flex-shrink-0">
        <div className={`absolute inset-0 bg-gradient-to-br ${heroGradients[gradientIdx]}`} />
        <div className="absolute top-0 left-0 right-0 z-10 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-background" />
            </motion.button>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.9 }}
                className="w-9 h-9 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center">
                <Share2 className="w-4 h-4 text-background" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (!detail) return;
                  toggleSave({
                    id: place.place_id,
                    name: place.name,
                    rating: place.rating,
                    category: place.price_level || "Place",
                    address: place.address,
                    priceLevel: place.price_level === "cheap" ? "$" : place.price_level === "medium" ? "$$" : "$$$",
                    status: place.status as "open_now" | "closing_soon" | "closed",
                    tags: place.detailed_characteristics?.slice(0, 2) || [],
                    savedAt: "Just now",
                  });
                }}
                className="w-9 h-9 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center">
                <Heart className={`w-4 h-4 transition-colors ${isSaved(place.place_id) ? "text-primary fill-primary" : "text-background"}`} />
              </motion.button>
            </div>
          </div>
        </div>

        {hasBidding && (
          <div className="absolute top-16 right-4 z-10">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold shadow-md">
              <Gavel className="w-3 h-3" /> BIDDING AVAILABLE
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-background" : "bg-background/40"}`} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-5 -mt-4 bg-background rounded-t-3xl relative z-10">
        {/* Badge row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-primary">CURATED CHOICE</span>
            {hasBidding && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground text-[9px] font-semibold">
                <Gavel className="w-2.5 h-2.5" /> BID
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="text-sm font-semibold text-foreground">{place.rating}</span>
            <span className="text-xs text-muted-foreground">({place.rating_count})</span>
          </div>
        </div>

        {/* Name & Address */}
        <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'DM Serif Display', 'Noto Serif SC', serif" }}>
          {place.name}
        </h1>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <MapPin className="w-3 h-3" />
          <span>{place.address}</span>
        </div>

        {/* Status & Hours */}
        <div className="flex items-center gap-3 mb-4 text-xs">
          <span className={`font-semibold ${status.color}`}>{status.label}</span>
          {place.opening_hours && (
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {place.opening_hours.today_open} – {place.opening_hours.today_close}
            </span>
          )}
          <span className="text-muted-foreground">{PRICE_DISPLAY[place.price_level] || place.price_level}</span>
        </div>

        {/* Contact & Navigation buttons */}
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
          {place.phone && (
            <a href={`tel:${place.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 text-xs font-medium text-foreground whitespace-nowrap">
              <Phone className="w-3.5 h-3.5 text-primary" /> Call
            </a>
          )}
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 text-xs font-medium text-foreground whitespace-nowrap">
              <Globe className="w-3.5 h-3.5 text-primary" /> Website
            </a>
          )}
          <button onClick={openGoogleMaps}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 text-xs font-medium text-foreground whitespace-nowrap">
            <Navigation className="w-3.5 h-3.5 text-primary" /> Navigate
          </button>
          {place.social_profiles?.instagram && (
            <a href={place.social_profiles.instagram} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 text-xs font-medium text-foreground whitespace-nowrap">
              <Instagram className="w-3.5 h-3.5 text-primary" /> Instagram
            </a>
          )}
          {place.social_profiles?.facebook && (
            <a href={place.social_profiles.facebook} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 text-xs font-medium text-foreground whitespace-nowrap">
              <Facebook className="w-3.5 h-3.5 text-primary" /> Facebook
            </a>
          )}
        </div>

        {/* Flash Deal */}
        {flashDeal && <FlashDealBanner deal={flashDeal} variant="full" onClaim={() => {}} />}

        {/* Recommendation Reasons */}
        {recommendation_reasons && recommendation_reasons.length > 0 && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-primary mb-2">WHY WE RECOMMEND THIS</p>
            {recommendation_reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 mb-1">
                <span className="text-primary text-sm mt-0.5">✦</span>
                <span className="text-sm text-foreground/80">{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI Insights — Review Summary */}
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <span className="text-base">✦</span> AI Insights
          </h2>

          <div className="mb-3">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-primary mb-2">STRENGTHS</p>
            {review_summary.advantages.map((s, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/80">{s}</span>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-amber-600 mb-2">CONSIDERATIONS</p>
            {review_summary.disadvantages.map((c, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/80">{c}</span>
              </div>
            ))}
          </div>

          {/* Star Reasons */}
          {review_summary.star_reasons && (
            <div className="grid grid-cols-2 gap-3">
              {review_summary.star_reasons.five_star && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30">
                  <p className="text-[10px] font-bold text-emerald-600 mb-1.5 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-emerald-500" /> 5★ Reasons
                  </p>
                  {review_summary.star_reasons.five_star.map((r, i) => (
                    <p key={i} className="text-[11px] text-foreground/70 mb-0.5">• {r}</p>
                  ))}
                </div>
              )}
              {review_summary.star_reasons.one_star && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30">
                  <p className="text-[10px] font-bold text-red-600 mb-1.5 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-red-500" /> 1★ Reasons
                  </p>
                  {review_summary.star_reasons.one_star.map((r, i) => (
                    <p key={i} className="text-[11px] text-foreground/70 mb-0.5">• {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rating Distribution */}
        {rating_distribution && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Rating Distribution</h2>
            <RatingDistributionChart distribution={rating_distribution} total={place.rating_count} />
          </div>
        )}

        {/* Popular Times */}
        {place.popular_times && Object.keys(place.popular_times).length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Popular Times</h2>
            <PopularTimesChart data={place.popular_times} />
          </div>
        )}

        {/* Characteristics */}
        {place.detailed_characteristics && place.detailed_characteristics.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-2">Features</h2>
            <div className="flex flex-wrap gap-2">
              {place.detailed_characteristics.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/30">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Q&A Section */}
        {questions_and_answers && questions_and_answers.length > 0 && (
          <div className="mb-5">
            <button onClick={() => setShowQA(!showQA)}
              className="flex items-center justify-between w-full text-sm font-semibold text-foreground mb-2">
              <span>Q&A ({questions_and_answers.length})</span>
              {showQA ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showQA && (
              <div className="space-y-3">
                {questions_and_answers.map((qa, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/30">
                    <p className="text-xs font-semibold text-foreground mb-1">Q: {qa.question}</p>
                    <p className="text-xs text-muted-foreground">A: {qa.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Customer Updates */}
        {customer_updates && customer_updates.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-2">Updates</h2>
            {customer_updates.map((u, i) => (
              <div key={i} className="p-3 rounded-xl bg-accent/10 border border-accent/20 mb-2">
                <p className="text-xs text-foreground">{u.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reviews Section */}
        <div className="mb-5">
          <button onClick={() => setShowReviews(!showReviews)}
            className="flex items-center justify-between w-full text-sm font-semibold text-foreground mb-2">
            <span>Reviews ({place.rating_count})</span>
            {showReviews ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showReviews && <ReviewsList placeId={place.place_id} />}
        </div>

        {/* Queue Status */}
        {(() => {
          const queueInfo = getQueueInfo(id || "");
          if (!queueInfo) return null;
          return (
            <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">QUEUE STATUS</p>
                <QueueIndicator level={queueInfo.level} waitMinutes={queueInfo.waitMinutes} compact />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{queueInfo.peopleAhead} in queue</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{queueInfo.waitMinutes} min wait</span>
              </div>
            </div>
          );
        })()}

        {/* Action buttons */}
        <div className="flex gap-3 pb-8">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setChatOpen(true)}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setQueueOpen(true)}
            className="flex-1 py-3 rounded-xl border border-primary/30 text-primary text-sm font-semibold flex items-center justify-center gap-2">
            <Users className="w-4 h-4" /> Join Queue
          </motion.button>
        </div>
      </div>

      <BidDrawer isOpen={bidOpen} onClose={() => setBidOpen(false)} placeName={place.name} priceLevel={PRICE_DISPLAY[place.price_level] || "$$"} />
      <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} placeName={place.name} placeCategory={place.address} />
      <QueueDrawer
        isOpen={queueOpen} onClose={() => setQueueOpen(false)}
        placeName={place.name} placeId={id || ""}
        queueInfo={getQueueInfo(id || "")} userQueue={userQueue}
        onJoin={() => id && joinQueue(id, place.name)} onLeave={leaveQueue}
      />
    </div>
  );
}
