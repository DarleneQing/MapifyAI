import { motion } from "framer-motion";
import type { PlaceSummary } from "@/types";

interface MapPinsProps {
  places: PlaceSummary[];
  activePlace: string | null;
  onPinClick: (placeId: string) => void;
}

export default function MapPins({ places, activePlace, onPinClick }: MapPinsProps) {
  const getPosition = (place: PlaceSummary, idx: number) => {
    const hash = place.place_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const angle = (hash * 137.508 + idx * 60) % 360;
    const radius = Math.min(place.distance_km * 8, 35);
    const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
    const y = 45 + radius * Math.sin((angle * Math.PI) / 180);
    return { x: Math.max(10, Math.min(90, x)), y: Math.max(10, Math.min(75, y)) };
  };

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none">
      {places.map((place, idx) => {
        const pos = getPosition(place, idx);
        const isActive = activePlace === place.place_id;

        return (
          <motion.button
            key={place.place_id}
            className="absolute pointer-events-auto"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: isActive ? 1.15 : 1,
              opacity: 1,
            }}
            transition={{ type: "spring", delay: idx * 0.08, stiffness: 400, damping: 20 }}
            onClick={() => onPinClick(place.place_id)}
          >
            <div
              className={`relative flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card/90 text-foreground/80 border border-border/50 shadow-sm"
              }`}
            >
              <span className="font-semibold">{idx + 1}</span>
              <span className="max-w-[52px] truncate">{place.name.slice(0, 4)}</span>
            </div>

            {/* Pin tail */}
            <div
              className={`w-1.5 h-1.5 rotate-45 mx-auto -mt-[3px] transition-colors duration-200 ${
                isActive ? "bg-primary" : "bg-card/90"
              }`}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
