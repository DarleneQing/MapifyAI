import { motion } from "framer-motion";
import { Star, Train, Zap } from "lucide-react";

const results = [
  {
    rank: 1,
    name: "Café Henrici",
    rating: 4.6,
    reviews: 2841,
    transit: "12 min via S3",
    price: "CHF 20–40",
    vibe: "Cozy date spot",
    summary: "Beautiful riverside terrace with excellent pastries — a local favorite for quiet conversations.",
    deal: null,
  },
  {
    rank: 2,
    name: "Babu's",
    rating: 4.4,
    reviews: 3814,
    transit: "8 min via S2",
    price: "CHF 12–25",
    vibe: "Student hangout",
    summary: "Fresh brunch ingredients, friendly atmosphere — popular with ETH students on weekends.",
    deal: "Student deal · 10% off",
  },
  {
    rank: 3,
    name: "Café & Bar Sphères",
    rating: 4.3,
    reviews: 1592,
    transit: "22 min via Tram 4",
    price: "CHF 8–18",
    vibe: "Quiet study spot",
    summary: "Bookshop-cafe hybrid with artistic ambiance — perfect for solo work sessions.",
    deal: null,
  },
];

const ResultCardsSection = () => {
  return (
    <section className="py-14 sm:py-24 px-6">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-6 sm:mb-10 text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-display mb-3">
            Your <span className="text-gradient-accent">Top 3</span> ranked
          </h2>
          <p className="text-muted-foreground text-sm">
            Real places, real data — ranked for your vibe
          </p>
        </motion.div>

        <div className="space-y-4">
          {results.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, type: "spring", bounce: 0 }}
              className="glass-surface rounded-3xl p-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    #{r.rank}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{r.name}</h3>
                    <span className="text-xs text-muted-foreground">{r.price}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-star text-star" />
                  <span className="text-sm font-medium text-foreground">{r.rating}</span>
                  <span className="text-xs text-muted-foreground">({r.reviews.toLocaleString()})</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase bg-foreground/10 text-foreground px-2.5 py-1 rounded-lg">
                  <Train className="h-3 w-3" />
                  {r.transit}
                </span>
                <span className="inline-flex items-center text-xs border border-primary/30 text-primary px-2.5 py-1 rounded-full">
                  {r.vibe}
                </span>
                {r.deal && (
                  <span className="inline-flex items-center gap-1 text-xs border border-primary/30 text-primary px-2.5 py-1 rounded-full">
                    <Zap className="h-3 w-3" />
                    {r.deal}
                  </span>
                )}
              </div>

              {/* AI Summary */}
              <p className="text-sm italic text-muted-foreground leading-relaxed">
                "{r.summary}"
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ResultCardsSection;
