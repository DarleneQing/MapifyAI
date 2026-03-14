import { useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import type { PlaceSummary } from "@/types";
import PlaceCard from "./PlaceCard";
import { useLang } from "@/i18n/LanguageContext";

interface BottomSheetProps {
  results: PlaceSummary[];
  isLoading: boolean;
  isStreaming: boolean;
  activePlace: string | null;
  onPlaceSelect: (placeId: string) => void;
  onPlaceDetail: (placeId: string) => void;
}

const SNAP_POINTS = {
  collapsed: 0.35,
  half: 0.55,
  full: 0.9,
};

export default function BottomSheet({
  results,
  isLoading,
  isStreaming,
  activePlace,
  onPlaceSelect,
  onPlaceDetail,
}: BottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sheetHeight = useMotionValue(window.innerHeight * SNAP_POINTS.half);
  const { t } = useLang();

  const borderRadius = useTransform(
    sheetHeight,
    [window.innerHeight * 0.35, window.innerHeight * 0.9],
    [20, 8]
  );

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const vh = window.innerHeight;
      const currentH = sheetHeight.get();
      const velocity = info.velocity.y;

      let target: number;
      if (velocity < -500) {
        target = currentH < vh * SNAP_POINTS.half ? vh * SNAP_POINTS.half : vh * SNAP_POINTS.full;
      } else if (velocity > 500) {
        target = currentH > vh * SNAP_POINTS.half ? vh * SNAP_POINTS.half : vh * SNAP_POINTS.collapsed;
      } else {
        const snapValues = [
          vh * SNAP_POINTS.collapsed,
          vh * SNAP_POINTS.half,
          vh * SNAP_POINTS.full,
        ];
        target = snapValues.reduce((a, b) =>
          Math.abs(b - currentH) < Math.abs(a - currentH) ? b : a
        );
      }
      sheetHeight.set(target);
    },
    [sheetHeight]
  );

  const skeletonCards = Array.from({ length: 4 }, (_, i) => (
    <div key={`skel-${i}`} className="mx-4 mb-2">
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
  ));

  return (
    <motion.div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 z-40"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
    >
      <motion.div
        className="bg-background/95 backdrop-blur-lg overflow-hidden flex flex-col border-t border-border/50"
        style={{
          height: sheetHeight,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        }}
      >
        {/* Drag Handle */}
        <motion.div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing pt-3 pb-2 px-5"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          onDrag={(_, info) => {
            const vh = window.innerHeight;
            const newH = Math.max(
              vh * SNAP_POINTS.collapsed,
              Math.min(vh * SNAP_POINTS.full, sheetHeight.get() - info.delta.y)
            );
            sheetHeight.set(newH);
          }}
          onDragEnd={handleDragEnd}
        >
          <div className="w-8 h-1 bg-border rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
              {isStreaming ? t.searching : t.resultsTitle}
            </p>
            <div className="flex items-center gap-1.5">
              {isStreaming && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
              <span className="text-xs text-muted-foreground">
                {t.resultsCount(results.length)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Scrollable Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto pb-safe-bottom pt-1">
          {isLoading && results.length === 0 ? (
            skeletonCards
          ) : (
            results.map((place, idx) => (
              <motion.div
                key={place.place_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.25 }}
              >
                <PlaceCard
                  place={place}
                  rank={idx + 1}
                  isActive={activePlace === place.place_id}
                  onSelect={() => onPlaceSelect(place.place_id)}
                  onDetail={() => onPlaceDetail(place.place_id)}
                />
              </motion.div>
            ))
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
      </motion.div>
    </motion.div>
  );
}
