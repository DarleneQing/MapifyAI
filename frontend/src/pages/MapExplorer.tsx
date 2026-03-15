import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Search, Mic, Navigation, MapPin, Star, Heart, LocateFixed } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useSearchStream } from "@/hooks/useSearchStream";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";

// ── Custom marker icons ──
function createPinIcon(name: string, isSelected: boolean) {
  const bg = isSelected ? "hsl(var(--primary))" : "hsl(var(--card))";
  const text = isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))";
  const border = isSelected ? "" : "border:1px solid hsl(var(--border)/0.6);";
  return L.divIcon({
    className: "custom-pin",
    html: `
      <div style="display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:600;background:${bg};color:${text};box-shadow:0 2px 6px rgba(0,0,0,0.15);${border}white-space:nowrap;max-width:80px;">
        <span style="overflow:hidden;text-overflow:ellipsis;max-width:60px;">${name}</span>
      </div>
      <div style="width:6px;height:6px;transform:rotate(45deg);margin:-2px auto 0;background:${bg};"></div>
    `,
    iconSize: [0, 0],
    iconAnchor: [40, 28],
  });
}

function createUserLocationIcon() {
  return L.divIcon({
    className: "user-location-pin",
    html: `
      <div style="position:relative;width:14px;height:14px;">
        <div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.4);"></div>
        <div style="position:absolute;top:-5px;left:-5px;width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.15);"></div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function MapExplorer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q");
  const { location } = useDeviceLocation();
  const { results, startSearch } = useSearchStream();
  const [activePlace, setActivePlace] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const searchedQueryRef = useRef<string | null>(null);

  const lat = location?.lat ?? 47.3769;
  const lng = location?.lng ?? 8.5417;

  useEffect(() => {
    if (query && location && searchedQueryRef.current !== query) {
      searchedQueryRef.current = query;
      startSearch(query, { lat, lng });
    }
  }, [query, location, lat, lng, startSearch]);

  const activeResult = results.find((r) => r.place_id === activePlace);

  // Generate pseudo-coordinates for results
  const resultsWithCoords = results.map((r, i) => ({
    ...r,
    _lat: lat + (Math.sin(i * 1.8) * 0.008),
    _lng: lng + (Math.cos(i * 1.8) * 0.008),
  }));

  const handleMarkerClick = useCallback((placeId: string) => {
    setActivePlace(placeId);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    map.on("click", () => {
      setActivePlace(null);
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
      userMarkerRef.current.setLatLng([lat, lng]);
    } else {
      userMarkerRef.current = L.marker([lat, lng], {
        icon: createUserLocationIcon(),
        interactive: false,
      }).addTo(map);
    }
  }, [lat, lng]);

  // Update result markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    resultsWithCoords.forEach((place) => {
      const isSelected = activePlace === place.place_id;
      const marker = L.marker([place._lat, place._lng], {
        icon: createPinIcon(
          place.name.split(" ").slice(0, 2).join(" "),
          isSelected
        ),
      }).addTo(map);

      marker.on("click", () => handleMarkerClick(place.place_id));
      markersRef.current.push(marker);
    });
  }, [resultsWithCoords, activePlace, handleMarkerClick]);

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden">
      {/* ── Leaflet Map ── */}
      <div className="absolute inset-0 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 z-[400] pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, hsl(var(--background) / 0.5) 0%, transparent 10%, transparent 80%, hsl(var(--background) / 0.4) 100%)`,
          }}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm border border-border/30"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </motion.button>

          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-full bg-card/90 backdrop-blur-sm shadow-sm border border-border/30">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {query ? query : "Search destinations..."}
            </span>
            <Mic className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute right-3 top-1/3 z-[500] flex flex-col gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => mapRef.current?.setView([lat, lng], 14, { animate: true })}
          className="w-9 h-9 rounded-xl bg-card/95 backdrop-blur-sm border border-border/40 flex items-center justify-center shadow-md"
        >
          <LocateFixed className="w-4 h-4 text-muted-foreground" />
        </motion.button>
      </div>

      {/* Active place card overlay */}
      <AnimatePresence>
        {activeResult && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-20 left-4 right-4 z-[500]"
          >
            <div
              className="bg-card rounded-2xl shadow-lg overflow-hidden cursor-pointer border border-border/30"
              onClick={() => navigate(`/place/${activeResult.place_id}`)}
            >
              {/* Thumbnail area */}
              <div className="h-28 bg-gradient-to-br from-muted to-secondary flex items-center justify-center relative">
                <MapPin className="w-8 h-8 text-muted-foreground/40" />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Heart className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </div>

              <div className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-foreground text-sm">{activeResult.name}</h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-medium text-foreground">
                      {activeResult.rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({activeResult.rating_count})
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{activeResult.address}</p>

                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted text-sm font-medium text-foreground">
                    <Navigation className="w-3.5 h-3.5" />
                    Directions
                  </button>
                  <button className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomTabBar />
    </div>
  );
}
