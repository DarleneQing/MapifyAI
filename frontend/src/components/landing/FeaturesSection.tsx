import { motion } from "framer-motion";
import { Brain, Train, Zap, MessageSquare, Users, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Natural Language In",
    desc: "Type like you think — our AI parses vague vibes into precise filters.",
  },
  {
    icon: Train,
    title: "Real-Time Transit",
    desc: "Live SBB data shows actual travel time, not just distance.",
  },
  {
    icon: Zap,
    title: "Flash Deals",
    desc: "Exclusive time-limited discounts from local merchants.",
  },
  {
    icon: MessageSquare,
    title: "AI Review Summaries",
    desc: "Strengths & limitations distilled from thousands of reviews.",
  },
  {
    icon: Users,
    title: "Virtual Queue",
    desc: "Join the waitlist remotely — skip the line, not the experience.",
  },
  {
    icon: BarChart3,
    title: "Merchant Dashboard",
    desc: "Businesses manage deals, queues, and analytics in one place.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-14 sm:py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-display mb-3">
            Two sides, <span className="text-gradient-primary">one platform</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            For explorers who discover and merchants who convert
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, type: "spring", bounce: 0 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-border/40"
            >
              <f.icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
