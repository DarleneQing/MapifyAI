import { motion } from "framer-motion";

export type VibeTag = "quiet" | "lively" | "study-friendly" | "date-friendly" | "family" | "pet-friendly";

export interface VibeOption {
  key: VibeTag;
  label: string;
  icon: string;
}

export const VIBE_OPTIONS: VibeOption[] = [
  { key: "quiet", label: "Quiet", icon: "🤫" },
  { key: "lively", label: "Lively", icon: "🎉" },
  { key: "study-friendly", label: "Study", icon: "📚" },
  { key: "date-friendly", label: "Date Night", icon: "🌹" },
  { key: "family", label: "Family", icon: "👨‍👩‍👧" },
  { key: "pet-friendly", label: "Pet Friendly", icon: "🐾" },
];

// Map of place IDs to their vibe tags (legacy mock ids; real Zurich providers have no entry and are treated as matching any vibe when filtering)
export const PLACE_VIBES: Record<string, VibeTag[]> = {
  p1: ["quiet", "study-friendly"],
  p2: ["quiet", "study-friendly"],
  p3: ["lively", "family"],
  p4: ["quiet", "pet-friendly"],
  p5: ["date-friendly", "quiet"],
  p6: ["quiet", "study-friendly"],
  p7: ["lively"],
  p8: ["family", "pet-friendly"],
  p9: ["family"],
  p10: ["date-friendly", "lively"],
};

/** True if place should show given active vibe filter. Places with no vibes (e.g. real providers) match when any vibe is selected. */
export function placeMatchesVibes(placeId: string, activeVibes: VibeTag[]): boolean {
  if (activeVibes.length === 0) return true;
  const vibes = PLACE_VIBES[placeId] ?? [];
  if (vibes.length === 0) return true;
  return activeVibes.some((v) => vibes.includes(v));
}

interface VibeFilterProps {
  activeVibes: VibeTag[];
  onToggle: (vibe: VibeTag) => void;
  compact?: boolean;
}

export default function VibeFilter({ activeVibes, onToggle, compact = false }: VibeFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
      {VIBE_OPTIONS.map((vibe) => {
        const isActive = activeVibes.includes(vibe.key);
        return (
          <motion.button
            key={vibe.key}
            whileTap={{ scale: 0.93 }}
            onClick={() => onToggle(vibe.key)}
            className={`flex items-center gap-1 whitespace-nowrap rounded-full transition-all border ${
              compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
            } font-medium ${
              isActive
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60"
            }`}
          >
            <span className={compact ? "text-[10px]" : "text-xs"}>{vibe.icon}</span>
            {vibe.label}
          </motion.button>
        );
      })}
    </div>
  );
}
