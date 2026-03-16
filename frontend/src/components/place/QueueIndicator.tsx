import { motion } from "framer-motion";
import { Users } from "lucide-react";
import type { QueueLevel } from "@/hooks/useQueueStatus";

interface QueueIndicatorProps {
  level: QueueLevel;
  waitMinutes: number;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const levelConfig = {
  low: { label: "No wait", dotColor: "bg-emerald-500", textColor: "text-emerald-600" },
  medium: { label: "~{min} min", dotColor: "bg-amber-500", textColor: "text-amber-600" },
  busy: { label: "Busy · ~{min} min", dotColor: "bg-destructive", textColor: "text-destructive" },
};

export default function QueueIndicator({ level, waitMinutes, compact = false, onClick }: QueueIndicatorProps) {
  const config = levelConfig[level];
  const label = config.label.replace("{min}", String(waitMinutes));

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5"
      >
        <span className={`w-2 h-2 rounded-full ${config.dotColor} ${level !== "low" ? "animate-pulse" : ""}`} />
        <span className={`text-[11px] ${config.textColor}`}>{label}</span>
      </button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40"
    >
      <span className={`w-2 h-2 rounded-full ${config.dotColor} ${level !== "low" ? "animate-pulse" : ""}`} />
      <span className={`text-[11px] font-medium ${config.textColor}`}>{label}</span>
      <Users className="w-3 h-3 text-muted-foreground" />
    </motion.button>
  );
}
