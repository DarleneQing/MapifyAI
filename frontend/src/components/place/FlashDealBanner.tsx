import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Clock, Tag } from "lucide-react";
import type { FlashDeal } from "@/types";

interface FlashDealBannerProps {
  deal: FlashDeal;
  variant?: "compact" | "full";
  onClaim?: () => void;
}

function useCountdown(expiresAt: string) {
  const expiryMs = new Date(expiresAt).getTime();
  const isValidDate = Number.isFinite(expiryMs);

  const [timeLeft, setTimeLeft] = useState(() => {
    if (!isValidDate) return 0;
    const diff = expiryMs - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (!isValidDate || timeLeft <= 0) return;
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      const secs = Number.isFinite(diff) ? Math.max(0, Math.floor(diff / 1000)) : 0;
      setTimeLeft(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, timeLeft, isValidDate]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return {
    hours,
    minutes,
    seconds,
    expired: timeLeft <= 0,
    totalSeconds: timeLeft,
    validDate: isValidDate,
    expiresAtLabel: expiresAt,
  };
}

export default function FlashDealBanner({ deal, variant = "compact", onClaim }: FlashDealBannerProps) {
  const { hours, minutes, seconds, expired, totalSeconds, validDate, expiresAtLabel } = useCountdown(deal.expires_at);
  const isUrgent = validDate && totalSeconds < 600; // < 10 min

  if (expired && validDate) return null;

  const pad = (n: number) => (Number.isFinite(n) ? n : 0).toString().padStart(2, "0");

  if (variant === "compact") {
    const timeDisplay = validDate
      ? hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`
      : expiresAtLabel;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1"
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <Zap className={`w-3 h-3 flex-shrink-0 text-destructive mt-0.5 ${isUrgent ? "animate-pulse" : ""}`} />
          <p className="text-[11px] min-w-0 flex-1 line-clamp-2 text-destructive/90" title={`${deal.discount}${deal.title ? ` · ${deal.title}` : ""}`}>
            <span className="font-bold text-destructive">{deal.discount}</span>
            {deal.title && <span className="text-destructive/80"> · {deal.title}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-destructive/70 flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {timeDisplay}
          </span>
          {deal.remaining != null && (
            <span className="text-[10px] text-destructive/50 flex-shrink-0">
              {deal.remaining} left
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  // Full variant — used on detail page
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-destructive/20 bg-gradient-to-r from-destructive/5 via-destructive/10 to-destructive/5 p-4 mb-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-full bg-destructive/15 flex items-center justify-center ${isUrgent ? "animate-pulse" : ""}`}>
          <Zap className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-destructive">
            ⚡ FLASH DEAL
          </p>
          <p className="text-sm font-bold text-foreground">{deal.title}</p>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground">
          <Tag className="w-3 h-3" />
          <span className="text-xs font-bold">{deal.discount}</span>
        </div>
      </div>

      {/* Countdown or expiry label */}
      <div className="flex items-center gap-3 mb-3">
        {validDate ? (
          <div className="flex items-center gap-1">
            {[
              { label: "HRS", value: pad(hours) },
              { label: "MIN", value: pad(minutes) },
              { label: "SEC", value: pad(seconds) },
            ].map((unit) => (
              <div key={unit.label} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-lg bg-foreground/5 border border-border/50 flex items-center justify-center">
                  <span className="text-base font-bold font-mono text-foreground">{unit.value}</span>
                </div>
                <span className="text-[8px] font-semibold text-muted-foreground mt-0.5">{unit.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{expiresAtLabel}</span>
          </div>
        )}
        {deal.remaining != null && (
          <div className="flex-1 text-right">
            <p className="text-xs text-muted-foreground">Spots left</p>
            <p className={`text-lg font-bold ${deal.remaining <= 5 ? "text-destructive" : "text-foreground"}`}>
              {deal.remaining}
            </p>
          </div>
        )}
      </div>

      {onClaim && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClaim}
          className="w-full py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Claim Deal
        </motion.button>
      )}
    </motion.div>
  );
}
