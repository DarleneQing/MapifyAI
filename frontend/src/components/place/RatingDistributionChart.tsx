import type { RatingDistribution } from "@/types";
import { Star } from "lucide-react";

interface Props {
  distribution: RatingDistribution;
  total: number;
}

export default function RatingDistributionChart({ distribution, total }: Props) {
  const stars = ["5", "4", "3", "2", "1"];
  const maxCount = Math.max(...stars.map((s) => distribution[s] || 0), 1);

  return (
    <div className="space-y-1.5">
      {stars.map((star) => {
        const count = distribution[star] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
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
