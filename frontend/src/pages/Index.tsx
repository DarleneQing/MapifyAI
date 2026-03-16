import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, MapPin, Star, ArrowRight, Mic, ChevronUp, Bookmark, MessageCircle, LocateFixed, Users, Sparkles } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import ChatDrawer from "@/components/chat/ChatDrawer";
import QueueDrawer from "@/components/place/QueueDrawer";
import QueueIndicator from "@/components/place/QueueIndicator";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import VibeFilter, { placeMatchesVibes, PLACE_VIBES, type VibeTag } from "@/components/explore/VibeFilter";
import NotificationCenter from "@/components/layout/NotificationCenter";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import { getIndexMerchants, getMerchantIdsWithDiscount, getDealForPlaceId } from "@/data/providers";

// Real Zurich providers (crawled data from backend seed)
const MERCHANTS = getIndexMerchants();
const MERCHANT_IDS_WITH_DISCOUNT = getMerchantIdsWithDiscount();

const CATEGORIES = [
  { label: "Restaurant", icon: "🍽", category: "restaurant" },
  { label: "Cafe", icon: "☕", category: "cafe" },
  { label: "Bar", icon: "🍸", category: "bar" },
  { label: "Haircut", icon: "✂️", category: "haircut" },
  { label: "Massage", icon: "💆", category: "massage" },
  { label: "Dentist", icon: "🦷", category: "dentist" },
  { label: "Repair", icon: "🔧", category: "repair" },
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

// ── Custom Leaflet marker icons ──
function createPinIcon(name: string, isSelected: boolean, delay: number = 0) {
  const bg = isSelected ? "#d6336c" : "#ffffff";
  const text = isSelected ? "#fff" : "#333";
  const tagColor = isSelected ? "#fff" : "#999";
  const arrowColor = bg;
  const shadowStyle = isSelected
    ? "filter:drop-shadow(0 3px 8px rgba(214,51,108,0.4));"
    : "filter:drop-shadow(0 2px 6px rgba(0,0,0,0.15));";
  const tagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${tagColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="${tagColor}"/></svg>`;

  // Only animate on initial render (delay > 0), not on selection changes
  const animationStyle = delay > 0 
    ? `animation:pin-drop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both;`
    : "";

  return L.divIcon({
    className: "custom-pin",
    html: `
      <div style="position:absolute;left:50%;transform:translateX(-50%);bottom:0;${shadowStyle}${animationStyle}">
        <div style="display:flex;align-items:center;gap:5px;padding:6px 12px 6px 10px;border-radius:20px;font-size:13px;font-weight:600;background:${bg};color:${text};white-space:nowrap;">
          ${tagSvg}
          <span style="overflow:hidden;text-overflow:ellipsis;max-width:100px;line-height:1.2;">${name}</span>
        </div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid ${arrowColor};margin:-1px auto 0;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createUserLocationIcon() {
  return L.divIcon({
    className: "user-location-pin",
    html: `
      <div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;top:-10px;left:-10px;width:40px;height:40px;border-radius:50%;background:rgba(59,130,246,0.15);animation:pulse-ring 2s ease-out infinite;"></div>
        <div style="width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3.5px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.5);"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const Index = () => {
  const navigate = useNavigate();
  const { location } = useDeviceLocation();
  const [query, setQuery] = useState("");
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeVibes, setActiveVibes] = useState<VibeTag[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ name: string; category: string } | null>(null);
  const [queueTarget, setQueueTarget] = useState<{ id: string; name: string } | null>(null);
  const { getQueueInfo, userQueue, joinQueue, leaveQueue } = useQueueStatus();
  const { notifications, unreadCount, latestPush, markRead, markAllRead, dismissToast } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiSearchEnabled, setAiSearchEnabled] = useState(true);
  const [localSearchFilter, setLocalSearchFilter] = useState("");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const centerLat = location?.lat ?? 47.3769;
  const centerLng = location?.lng ?? 8.5417;

  const handleVibeToggle = (vibe: VibeTag) => {
    setActiveVibes((prev) => prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]);
  };

  const filteredMerchants = useMemo(() => {
    return MERCHANTS.filter((m) => {
      const hasDiscount = MERCHANT_IDS_WITH_DISCOUNT.has(m.id);
      const matchCategory = !activeCategory || m.category === activeCategory;
      const matchVibe = placeMatchesVibes(m.id, activeVibes);
      const matchSearch =
        !localSearchFilter ||
        [m.name, m.category, ...m.tags].some((s) =>
          s.toLowerCase().includes(localSearchFilter.toLowerCase())
        );
      // When a category chip is selected: show related stores in that category (ignore discount).
      // When no category: show only places with discounts (original "places nearby" behavior).
      if (activeCategory) {
        return matchCategory && matchVibe && matchSearch;
      }
      return hasDiscount && matchVibe && matchSearch;
    });
  }, [activeCategory, activeVibes, localSearchFilter]);

  const selectedMerchant = MERCHANTS.find((m) => m.id === selectedPin);

  const handleSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (aiSearchEnabled) {
        if (!trimmed) return;
        const combined = [...activeVibes, trimmed].filter(Boolean).join(" ");
        navigate(`/chat?q=${encodeURIComponent(combined)}`);
      } else {
        if (!trimmed) {
          setLocalSearchFilter("");
          return;
        }
        navigate(`/explore?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [navigate, activeVibes, aiSearchEnabled]
  );

  const handlePinClick = useCallback((id: string) => {
    setSelectedPin((prev) => (prev === id ? null : id));
  }, []);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.setView([centerLat, centerLng], 14, { animate: true });
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    map.on("click", () => {
      setSelectedPin(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([centerLat, centerLng]);
    } else {
      userMarkerRef.current = L.marker([centerLat, centerLng], {
        icon: createUserLocationIcon(),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [centerLat, centerLng]);

  // Create merchant markers (only when filtered list changes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredMerchants.forEach((merchant, idx) => {
      const marker = L.marker([merchant.lat, merchant.lng], {
        icon: createPinIcon(
          merchant.name.split(" ").slice(0, 2).join(" "),
          false, // Start unselected, selection handled separately
          idx * 80 // stagger delay per pin
        ),
      }).addTo(map);

      (marker as any)._merchantId = merchant.id;
      (marker as any)._merchantName = merchant.name;
      marker.on("click", () => handlePinClick(merchant.id));
      markersRef.current.push(marker);
    });
  }, [filteredMerchants, handlePinClick]);

  // Update selected marker icon (no animation, just style change)
  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const id = (marker as any)._merchantId;
      const name = (marker as any)._merchantName;
      const isSelected = selectedPin === id;
      marker.setIcon(
        createPinIcon(
          name.split(" ").slice(0, 2).join(" "),
          isSelected,
          0 // No animation delay for selection changes
        )
      );
    });
  }, [selectedPin]);

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden">
      {/* ── Full-screen Leaflet Map ── */}
      <div className="absolute inset-0 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Gradient overlays for UI readability */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] z-[400] pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.75) 60%, hsl(var(--background) / 0.95) 100%)`,
          }}
        />
      </div>

      {/* ── Recenter button ── */}
      {!notifOpen && (
        <button
          onClick={handleRecenter}
          className="absolute right-3 bottom-[290px] z-[600] w-11 h-11 rounded-full bg-card border border-border/30 shadow-md flex items-center justify-center active:scale-90 transition-transform"
          title="Back to my location"
        >
          <LocateFixed className="w-5 h-5 text-primary" />
        </button>
      )}

      {/* ── Top: Places nearby + Explore all + Notifications ── */}
      <div className="relative z-[500] safe-top px-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSheetOpen(true)}
            className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-card/95 backdrop-blur-sm border border-border/40 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-medium text-foreground">
                {filteredMerchants.length} places nearby
              </span>
            </div>
            <div className="flex items-center gap-1 text-primary">
              <ChevronUp className="w-3 h-3 rotate-180" />
              <span className="text-[11px] font-semibold">Explore all</span>
            </div>
          </button>
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadCount}
            latestPush={latestPush}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDismissToast={dismissToast}
            onOpenChange={setNotifOpen}
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.category}
              onClick={() =>
                setActiveCategory(activeCategory === cat.category ? null : cat.category)
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap shadow-sm transition-all ${
                activeCategory === cat.category
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border/50"
              }`}
            >
              <span className="text-xs">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Selected Pin Preview Card ── */}
      <AnimatePresence>
        {selectedMerchant && !sheetOpen && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-[140px] left-3 right-3 z-[500]"
          >
            <div
              className="bg-card rounded-xl shadow-lg border border-border/50 p-3 cursor-pointer"
              onClick={() => navigate(`/place/${selectedMerchant.id}`)}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <span className="text-base">{selectedMerchant.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="text-[13px] font-semibold text-foreground truncate">{selectedMerchant.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      {selectedMerchant.rating}
                    </span>
                    <span>·</span>
                    <span>{selectedMerchant.category}</span>
                    {(() => {
                      const qi = getQueueInfo(selectedMerchant.id);
                      if (!qi || selectedMerchant.status === "closed") return null;
                      return (
                        <>
                          <span>·</span>
                          <QueueIndicator level={qi.level} waitMinutes={qi.waitMinutes} compact />
                        </>
                      );
                    })()}
                  </div>
                  {(() => {
                    const deal = getDealForPlaceId(selectedMerchant.id);
                    if (!deal) return null;
                    return (
                      <div className="text-[10px] text-primary font-medium mb-1.5">
                        {deal.title} · {deal.discount}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/place/${selectedMerchant.id}`); }}
                      className="px-2.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold"
                    >
                      View Details
                    </button>
                    {(() => {
                      const qi = getQueueInfo(selectedMerchant.id);
                      if (!qi || qi.level === "low" || selectedMerchant.status === "closed") return null;
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setQueueTarget({ id: selectedMerchant.id, name: selectedMerchant.name }); }}
                          className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold flex items-center gap-0.5"
                        >
                          <Users className="w-2.5 h-2.5" /> Join Queue
                        </button>
                      );
                    })()}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSelectedPin(null); }} className="p-0.5">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom: Greeting + Search ── */}
      {!sheetOpen && !selectedMerchant && !notifOpen && (
        <div className="absolute bottom-14 left-0 right-0 z-[500] px-4 pb-2">
          <div className="glass-strong rounded-2xl px-4 pt-2 pb-3 space-y-3">
            {/* AI search toggle */}
            <div className="flex items-center justify-between gap-1.5 py-0.5">
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-medium text-foreground">AI search</span>
              </div>
              <div className="scale-75 origin-right">
                <Switch
                  checked={aiSearchEnabled}
                  onCheckedChange={(checked) => {
                    setAiSearchEnabled(checked);
                    if (checked) setLocalSearchFilter("");
                  }}
                  aria-label="Toggle AI search"
                />
              </div>
            </div>

            {/* Greeting */}
            <div className="text-center">
              <h1 className="text-lg font-bold text-foreground tracking-tight leading-snug">
                What are you looking for? ✨
              </h1>
              <p className="text-xs text-muted-foreground/70 mt-0.5 font-medium">
                Discover, book & get discounts on local services
              </p>
            </div>

            {/* Search area: treat greeting + vibes + input as one active region */}
            <div
              tabIndex={-1}
              onFocusCapture={() => setIsFocused(true)}
              onBlurCapture={(e) => {
                const next = e.relatedTarget as Node | null;
                if (!e.currentTarget.contains(next)) {
                  setIsFocused(false);
                }
              }}
              className="space-y-2"
            >
              {/* Vibe filter: only when search area is active */}
              {isFocused && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  <VibeFilter activeVibes={activeVibes} onToggle={handleVibeToggle} compact />
                </div>
              )}

              {/* Search input */}
              <div
                className={`flex items-center gap-2 rounded-2xl bg-background/60 border border-border/30 px-3 py-2 transition-all ${
                  isFocused ? "ring-2 ring-primary/25 border-primary/30" : ""
                }`}
              >
                <Search className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch(query);
                  }}
                  placeholder="Try &quot;best coffee nearby&quot;..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                />
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-full hover:bg-muted/50 transition-colors flex-shrink-0">
                    <Mic className="w-4 h-4 text-muted-foreground/50" />
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSearch(query)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                      query.trim()
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-primary/15 text-primary"
                    }`}
                    disabled={!query.trim()}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Explore Drop-down Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="absolute inset-0 z-[600] bg-foreground/10"
            />
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute top-0 left-0 right-0 z-[700] bg-background rounded-b-2xl shadow-2xl flex flex-col"
              style={{ height: "78dvh" }}
            >
              {/* Header */}
              <div className="safe-top px-4 pt-3 pb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Explore Nearby</h2>
                <span className="text-[10px] text-muted-foreground">{filteredMerchants.length} places</span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto pb-4">
                {filteredMerchants.map((place, idx) => {
                  const status = statusMap[place.status];
                  return (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="mx-3 mb-0.5 cursor-pointer"
                      onClick={() => navigate(`/place/${place.id}`)}
                    >
                      <div className="rounded-lg p-2.5 hover:bg-card/60 transition-all">
                        <div className="flex items-start gap-2.5">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${placeholderColors[idx % placeholderColors.length]} flex items-center justify-center`}>
                            <span className="text-sm opacity-60">{place.name.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-0.5">
                              <h4 className="font-semibold text-[13px] text-foreground leading-tight">{place.name}</h4>
                              <Bookmark className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                              <span className="flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                {place.rating.toFixed(1)}
                              </span>
                              <span>·</span>
                              <span className={`font-medium ${status.color}`}>{status.label}</span>
                            </div>
                            {(() => {
                              const deal = getDealForPlaceId(place.id);
                              if (!deal) return null;
                              return (
                                <p className="text-[10px] text-primary font-medium mb-0.5">
                                  {deal.title} · {deal.discount}
                                </p>
                              );
                            })()}
                            {place.tags.length > 0 && (
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                {place.tags.join(", ")}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); setChatTarget({ name: place.name, category: place.category }); }}
                                className="flex items-center gap-0.5 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                              >
                                <MessageCircle className="w-2.5 h-2.5" />
                                Chat
                              </button>
                              {(() => {
                                const qi = getQueueInfo(place.id);
                                if (!qi || qi.level === "low" || place.status === "closed") return null;
                                return (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setQueueTarget({ id: place.id, name: place.name }); }}
                                    className="flex items-center gap-0.5 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  >
                                    <Users className="w-2.5 h-2.5" />
                                    Join Queue
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Close handle */}
              <div
                className="flex flex-col items-center py-2 cursor-pointer border-t border-border/30"
                onClick={() => setSheetOpen(false)}
              >
                <div className="flex items-center gap-1 text-primary">
                  <ChevronUp className="w-3 h-3" />
                  <span className="text-[10px] font-semibold">Close</span>
                </div>
                <div className="w-8 h-0.5 rounded-full bg-muted mt-1.5" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
};

export default Index;
