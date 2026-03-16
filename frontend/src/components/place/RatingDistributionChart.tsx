import type { RatingDistribution } from "@/types";
import { Star } from "lucide-react";

interface Props {
  distribution: RatingDistribution;
  total: number;
}

export default function RatingDistributionChart({ distribution, total }: Props) {
  const stars = ["5", "4", "3", "2", "1"];
  const counts = stars.map((s) => distribution[s] || 0);
  const effectiveTotal = total > 0 ? total : counts.reduce((sum, c) => sum + c, 0);
  const maxCount = Math.max(...counts, 1);

  // Pre-compute rounded percentages that sum to exactly 100
  const roundedPercents: Record<string, number> = {};
  if (effectiveTotal > 0) {
    const rawPercents = counts.map((c) => (c / effectiveTotal) * 100);
    let accumulated = 0;
    stars.forEach((star, idx) => {
      if (idx < stars.length - 1) {
        const r = Math.round(rawPercents[idx]);
        roundedPercents[star] = r;
        accumulated += r;
      } else {
        roundedPercents[star] = Math.max(0, 100 - accumulated);
      }
    });
  } else {
    stars.forEach((star) => {
      roundedPercents[star] = 0;
    });
  }

  return (
    <div className="space-y-1.5">
      {stars.map((star) => {
        const count = distribution[star] || 0;
        const pct = roundedPercents[star] ?? 0;
        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground w-4 text-right flex items-center gap-0.5">
              {star} <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
            </span>
            <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
