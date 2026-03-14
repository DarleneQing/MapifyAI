import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Train, MessageSquareText, BarChart3, Sparkles, CheckCircle2 } from "lucide-react";
import type { PipelineStage } from "@/hooks/useSearchStream";

const STAGES: {
  key: PipelineStage;
  label: string;
  detail: string;
  icon: React.ElementType;
}[] = [
  { key: "intent_parsed", label: "Understanding Intent", detail: "Parsing your natural language query…", icon: Brain },
  { key: "stores_crawled", label: "Discovering Places", detail: "Crawling nearby venues from multiple sources…", icon: Search },
  { key: "transit_computed", label: "Computing Routes", detail: "Calculating real-time transit options (SBB/ZVV)…", icon: Train },
  { key: "reviews_fetched", label: "Analyzing Reviews", detail: "Fetching & summarizing Google reviews…", icon: MessageSquareText },
  { key: "scores_computed", label: "Scoring & Ranking", detail: "Combining distance, rating, price & vibe signals…", icon: BarChart3 },
  { key: "recommendations_ready", label: "Generating Advice", detail: "Crafting personalized recommendations…", icon: Sparkles },
];

const ORDER: PipelineStage[] = STAGES.map((s) => s.key);

function stageIndex(stage: PipelineStage): number {
  const idx = ORDER.indexOf(stage);
  return idx === -1 ? (stage === "completed" ? ORDER.length : -1) : idx;
}

interface Props {
  stage: PipelineStage;
  isVisible: boolean;
}

export default function AgentPipeline({ stage, isVisible }: Props) {
  const currentIdx = stageIndex(stage);

  if (!isVisible || stage === "idle") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mx-4 mb-3 rounded-xl bg-card border border-border/60 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="relative w-5 h-5">
          <Sparkles className="w-5 h-5 text-primary" />
          {stage !== "completed" && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-ping" />
          )}
        </div>
        <span className="text-xs font-semibold text-foreground">
          {stage === "completed" ? "AI Agent — Done" : "AI Agent Reasoning…"}
        </span>
      </div>

      {/* Steps */}
      <div className="px-4 pb-3 space-y-1">
        <AnimatePresence>
          {STAGES.map((s, idx) => {
            const isDone = currentIdx > idx;
            const isActive = currentIdx === idx;
            const isPending = currentIdx < idx;

            if (isPending && stage !== "completed") return null;

            const Icon = s.icon;

            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-start gap-2.5 py-1"
              >
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {isDone || stage === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <Icon className="w-4 h-4 text-primary" />
                    </motion.div>
                  ) : (
                    <Icon className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] font-medium leading-tight ${
                      isDone || stage === "completed"
                        ? "text-foreground/70"
                        : isActive
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {s.label}
                  </p>
                  {isActive && stage !== "completed" && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[11px] text-muted-foreground mt-0.5"
                    >
                      {s.detail}
                    </motion.p>
                  )}
                </div>

                {/* Duration badge (mock) */}
                {(isDone || stage === "completed") && (
                  <span className="text-[10px] text-muted-foreground/60 mt-0.5 flex-shrink-0">
                    {(0.3 + idx * 0.2).toFixed(1)}s
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
