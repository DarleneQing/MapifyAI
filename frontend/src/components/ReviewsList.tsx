import { useState, useEffect } from "react";
import { Star, ChevronDown } from "lucide-react";
import type { PlaceReview } from "@/types";
import { getPlaceReviews } from "@/services/api";

// Mock reviews for fallback
const MOCK_REVIEWS: PlaceReview[] = [
  { author_name: "Sarah M.", rating: 5, text: "Absolutely love this place! The atmosphere is wonderful and the service is top-notch. Will definitely come back.", time: "2026-03-01T10:00:00Z", language: "en" },
  { author_name: "李明", rating: 4, text: "很不错的地方，环境优雅，价格合理。唯一的缺点是周末人太多了。", time: "2026-02-20T14:00:00Z", language: "zh-CN" },
  { author_name: "Thomas K.", rating: 5, text: "Best coffee in the neighborhood. The baristas really know their craft. Highly recommended!", time: "2026-02-15T09:00:00Z", language: "en" },
  { author_name: "Anna B.", rating: 3, text: "Decent place but nothing extraordinary. The coffee was average and the wait was too long.", time: "2026-02-10T16:00:00Z", language: "en" },
  { author_name: "Marco P.", rating: 5, text: "Ein wunderbares Café! Perfekt zum Arbeiten und die Qualität ist hervorragend.", time: "2026-02-05T11:00:00Z", language: "de" },
];

type SortOption = "newest" | "highest_rating" | "lowest_rating";

interface Props {
  placeId: string;
}

export default function ReviewsList({ placeId }: Props) {
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    async function fetchReviews() {
      setLoading(true);
      try {
        const res = await getPlaceReviews(placeId, 1, pageSize, sort);
        if (!cancelled) {
          setReviews(res.reviews);
          setTotal(res.total);
          setHasMore(res.page * res.page_size < res.total);
          setPage(1);
          setLoading(false);
        }
      } catch {
        // Fallback to mock
        const sorted = [...MOCK_REVIEWS].sort((a, b) => {
          if (sort === "newest") return new Date(b.time).getTime() - new Date(a.time).getTime();
          if (sort === "highest_rating") return b.rating - a.rating;
          return a.rating - b.rating;
        });
        if (!cancelled) {
          setReviews(sorted);
          setTotal(sorted.length);
          setHasMore(false);
          setPage(1);
          setLoading(false);
        }
      }
    }
    fetchReviews();
    return () => { cancelled = true; };
  }, [placeId, sort]);

  const loadMore = async () => {
    const nextPage = page + 1;
    try {
      const res = await getPlaceReviews(placeId, nextPage, pageSize, sort);
      setReviews((prev) => [...prev, ...res.reviews]);
      setPage(nextPage);
      setHasMore(nextPage * pageSize < res.total);
    } catch {
      setHasMore(false);
    }
  };

  return (
    <div>
      {/* Sort controls */}
      <div className="flex gap-2 mb-3">
        {(["newest", "highest_rating", "lowest_rating"] as SortOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setSort(opt)}
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
              sort === opt
                ? "bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground"
            }`}
          >
            {opt === "newest" ? "Newest" : opt === "highest_rating" ? "Highest" : "Lowest"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse p-3 rounded-xl bg-muted/30">
              <div className="h-3 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((review, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">{review.author_name}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`w-2.5 h-2.5 ${i < review.rating ? "text-amber-500 fill-amber-500" : "text-muted"}`} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-foreground/70 leading-relaxed">{review.text}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(review.time).toLocaleDateString()}
              </p>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-2 text-xs font-medium text-primary flex items-center justify-center gap-1"
            >
              Load more <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
